import { calculateDurationMinutes, intoDate } from "@real1ty-obsidian-plugins";

import { stripISOSuffix } from "../../utils/event-frontmatter";
import type { AIEventSummary } from "./ai-context-builder";

// ─── Types ──────────────────────────────────────────────────────────

export interface DayEntry {
	title: string;
	start: Date;
	end: Date;
	startRaw: string;
	endRaw: string;
}

export type DayMap = Map<string, DayEntry[]>;

export interface TimedCreateOp {
	type: "create";
	title: string;
	start: string;
	end: string;
	allDay?: boolean;
	categories?: string[];
	location?: string;
	participants?: string[];
}

type AIMode = "query" | "manipulation" | "planning";

export interface SemanticValidationContext {
	mode: AIMode;
	currentEvents?: AIEventSummary[] | undefined;
	intervalStart?: string | undefined;
	intervalEnd?: string | undefined;
	gapDetection: boolean;
	dayCoverage: boolean;
}

// ─── Validation Functions ───────────────────────────────────────────

export function validateEndAfterStart(ops: TimedCreateOp[]): string[] {
	const errors: string[] = [];
	for (const op of ops) {
		const startDate = intoDate(op.start);
		const endDate = intoDate(op.end);
		if (startDate && endDate && endDate <= startDate) {
			errors.push(`Event "${op.title}" has end (${op.end}) not after start (${op.start}).`);
		}
	}
	return errors;
}

export function buildDayMap(ops: TimedCreateOp[], currentEvents?: AIEventSummary[]): DayMap {
	const byDay: DayMap = new Map();

	const addEntry = (dayKey: string, title: string, start: string, end: string): void => {
		const startDate = intoDate(start);
		const endDate = intoDate(end);
		if (!startDate || !endDate) return;
		const entry: DayEntry = {
			title,
			start: startDate,
			end: endDate,
			startRaw: stripISOSuffix(start),
			endRaw: stripISOSuffix(end),
		};
		const existing = byDay.get(dayKey);
		if (existing) {
			existing.push(entry);
		} else {
			byDay.set(dayKey, [entry]);
		}
	};

	for (const op of ops) {
		addEntry(op.start.slice(0, 10), op.title, op.start, op.end);
	}

	if (currentEvents) {
		for (const ev of currentEvents) {
			if (ev.allDay || !ev.end) continue;
			addEntry(ev.start.slice(0, 10), ev.title + " (existing)", ev.start, ev.end);
		}
	}

	return byDay;
}

export function validateNoOverlaps(byDay: DayMap): string[] {
	const errors: string[] = [];
	for (const [day, dayEvents] of byDay) {
		const sorted = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
		for (let i = 0; i < sorted.length - 1; i++) {
			if (sorted[i].end > sorted[i + 1].start) {
				errors.push(
					`Overlap on ${day}: "${sorted[i].title}" ends at ${sorted[i].endRaw} but "${sorted[i + 1].title}" starts at ${sorted[i + 1].startRaw}.`
				);
			}
		}
	}
	return errors;
}

export function validateNoGaps(byDay: DayMap): string[] {
	const errors: string[] = [];
	for (const [day, dayEvents] of byDay) {
		const sorted = [...dayEvents].sort((a, b) => a.start.getTime() - b.start.getTime());
		for (let i = 0; i < sorted.length - 1; i++) {
			const gapMins = calculateDurationMinutes(sorted[i].end, sorted[i + 1].start);
			if (gapMins > 0) {
				errors.push(
					`Gap on ${day}: ${gapMins}min gap between "${sorted[i].title}" (ends ${sorted[i].endRaw.slice(11, 16)}) and "${sorted[i + 1].title}" (starts ${sorted[i + 1].startRaw.slice(11, 16)}). Events must be contiguous — the next event should start exactly when the previous one ends.`
				);
			}
		}
	}
	return errors;
}

export function validateDayCoverage(byDay: DayMap, intervalStart: string, intervalEnd: string): string[] {
	const errors: string[] = [];
	const start = intoDate(intervalStart);
	const end = intoDate(intervalEnd);
	if (!start || !end) return errors;

	const current = new Date(start);
	while (current < end) {
		const dayKey = current.toISOString().slice(0, 10);
		if (!byDay.has(dayKey)) {
			errors.push(`Missing coverage: no events on ${dayKey}.`);
		}
		current.setDate(current.getDate() + 1);
	}
	return errors;
}

export function validateWithinBounds(ops: TimedCreateOp[], intervalStart: string, intervalEnd: string): string[] {
	const errors: string[] = [];
	const boundStart = intoDate(intervalStart);
	const boundEnd = intoDate(intervalEnd);
	if (!boundStart || !boundEnd) return errors;

	for (const op of ops) {
		const opStart = intoDate(op.start);
		const opEnd = intoDate(op.end);
		if (opStart && opEnd && (opStart < boundStart || opEnd > boundEnd)) {
			errors.push(`Event "${op.title}" (${op.start} - ${op.end}) is outside interval boundaries.`);
		}
	}
	return errors;
}

interface AnyOperation {
	type: string;
}

export function validateOperationsSemantically(
	operations: AnyOperation[],
	context: SemanticValidationContext
): string[] {
	const createOps: TimedCreateOp[] = [];
	for (const op of operations) {
		if (op.type === "create") {
			createOps.push(op as TimedCreateOp);
		}
	}
	const timedCreateOps = createOps.filter((op) => !op.allDay);

	const errors = validateEndAfterStart(timedCreateOps);

	const byDay = buildDayMap(timedCreateOps, context.currentEvents);
	errors.push(...validateNoOverlaps(byDay));

	if (context.mode === "planning") {
		if (context.gapDetection) {
			errors.push(...validateNoGaps(byDay));
		}
		if (context.dayCoverage && context.intervalStart && context.intervalEnd) {
			errors.push(...validateDayCoverage(byDay, context.intervalStart, context.intervalEnd));
		}
	}

	if (context.intervalStart && context.intervalEnd) {
		errors.push(...validateWithinBounds(timedCreateOps, context.intervalStart, context.intervalEnd));
	}

	return errors;
}
