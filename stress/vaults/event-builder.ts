import type { GeneratedEvent, SeededRandom } from "@real1ty-obsidian-plugins/testing/stress";

import { buildEventMarkdown, type SeedEventInput } from "../../e2e/fixtures/seed-events";
import type { PrismaVaultProfile } from "./profiles";

// Deterministic Prisma event factory. Events are spread across a FROZEN anchor
// year (never `today`) so the generated vault is byte-identical run-to-run.
// Generic mock data only — never real names/categories.

const ANCHOR_YEAR = 2026;
const EVENT_TITLES = ["Team Meeting", "Workout", "Project Planning", "Weekly Review", "Standup", "Focus Block"];
const CATEGORIES = ["Work", "Personal", "Fitness", "Errands"];

// Prisma recurrence DSL (src/types/recurring.ts): presets or `FREQ;INTERVAL=N`.
// Weighted toward bounded frequencies so a month view doesn't expand to millions
// of instances — daily is the heaviest per-range, so it's a minority.
const RECURRENCE_TYPES = ["weekly", "monthly", "daily", "MONTHLY;INTERVAL=2", "weekly"] as const;
const WEEKLY_TYPES = new Set(["weekly", "bi-weekly"]);
const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"];
// How many years before the anchor a recurring series starts — exercises the
// visible-range fast-forward (`advanceOccurrenceToRangeStart`).
const MIN_YEARS_BACK = 3;
const MAX_YEARS_BACK = 6;

function pad(value: number): string {
	return String(value).padStart(2, "0");
}

export function buildPrismaEvent(rng: SeededRandom, index: number, _profile: PrismaVaultProfile): GeneratedEvent {
	const dayOfYear = index % 365;
	const date = new Date(Date.UTC(ANCHOR_YEAR, 0, 1 + dayOfYear));
	const month = pad(date.getUTCMonth() + 1);
	const day = pad(date.getUTCDate());
	const hour = 8 + rng.int(0, 9);

	const input: SeedEventInput = {
		title: `${rng.pick(EVENT_TITLES)} ${String(index + 1).padStart(5, "0")}`,
		startDate: `${ANCHOR_YEAR}-${month}-${day}T${pad(hour)}:00`,
		endDate: `${ANCHOR_YEAR}-${month}-${day}T${pad(hour + 1)}:00`,
		category: rng.pick(CATEGORIES),
	};

	return {
		relativePath: `Event-${String(index).padStart(5, "0")}.md`,
		content: buildEventMarkdown(input),
	};
}

/**
 * Deterministic recurring source. Open-ended (no `RRuleUntil`) and started years
 * before the anchor so every visible range expands occurrences. `RRuleID` is set
 * explicitly via `extra` so the plugin never generates a UUID and writes it back
 * (which would mutate the vault and break determinism).
 */
export function buildPrismaRecurringEvent(
	rng: SeededRandom,
	index: number,
	_profile: PrismaVaultProfile
): GeneratedEvent {
	const rrule = rng.pick(RECURRENCE_TYPES);
	const startYear = ANCHOR_YEAR - (MIN_YEARS_BACK + rng.int(0, MAX_YEARS_BACK - MIN_YEARS_BACK));
	const dayOfYear = index % 365;
	const date = new Date(Date.UTC(startYear, 0, 1 + dayOfYear));
	const month = pad(date.getUTCMonth() + 1);
	const day = pad(date.getUTCDate());
	const hour = 8 + rng.int(0, 9);

	const input: SeedEventInput = {
		title: `${rng.pick(EVENT_TITLES)} Recurring ${String(index + 1).padStart(5, "0")}`,
		startDate: `${startYear}-${month}-${day}T${pad(hour)}:00`,
		endDate: `${startYear}-${month}-${day}T${pad(hour + 1)}:00`,
		category: rng.pick(CATEGORIES),
		rrule,
		...(WEEKLY_TYPES.has(rrule) ? { rruleSpec: rng.pick(WEEKDAYS) } : {}),
		extra: { RRuleID: `rec-${String(index).padStart(5, "0")}` },
	};

	return {
		relativePath: `Recurring-${String(index).padStart(5, "0")}.md`,
		content: buildEventMarkdown(input),
	};
}
