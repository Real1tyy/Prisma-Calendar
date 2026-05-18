import { isTimedEvent, type CalendarEvent } from "../../types/calendar";
import { getEventDuration, pickDurationFormatter } from "./duration";

export interface CapacityResult {
	capacityMs: number;
	usedMs: number;
	remainingMs: number;
	percentUsed: number;
	boundaryStart: number;
	boundaryEnd: number;
}

const MS_PER_HOUR = 3_600_000;

/**
 * Infers the earliest start time and latest end time from a set of timed events.
 * Returns fractional hours (e.g. 9.5 for 9:30). No rounding — uses exact event times.
 * Falls back to provided defaults when no timed events exist.
 */
export function inferBoundaries(
	events: CalendarEvent[],
	fallbackStart: number,
	fallbackEnd: number
): { startHour: number; endHour: number } {
	let minHour = Infinity;
	let maxHour = -Infinity;

	for (const event of events) {
		if (!isTimedEvent(event)) continue;

		const start = new Date(event.start);
		const end = new Date(event.end);

		const startFrac = start.getHours() + start.getMinutes() / 60;
		const endFrac = end.getHours() + end.getMinutes() / 60;

		if (startFrac < minHour) minHour = startFrac;
		if (endFrac > maxHour) maxHour = endFrac;
	}

	if (minHour === Infinity) {
		return { startHour: fallbackStart, endHour: fallbackEnd };
	}

	return { startHour: minHour, endHour: maxHour };
}

/**
 * Calculates capacity usage for a period.
 * Capacity = number of days × (endHour - startHour) hours per day.
 * Used = total duration of timed events in `events` (caller is responsible for
 * passing the in-period set; pair with `getEventsInRange` upstream so this
 * stays in lockstep with `aggregateStats.totalDuration`).
 * Remaining = capacity - used (clamped to 0).
 */
export function calculateCapacity(
	events: CalendarEvent[],
	periodStart: Date,
	periodEnd: Date,
	boundaryStart: number,
	boundaryEnd: number
): CapacityResult {
	const hoursPerDay = Math.max(0, boundaryEnd - boundaryStart);
	const days = Math.max(1, Math.round((periodEnd.getTime() - periodStart.getTime()) / (24 * MS_PER_HOUR)));
	const capacityMs = days * hoursPerDay * MS_PER_HOUR;

	const usedMs = events.filter(isTimedEvent).reduce((sum, e) => sum + getEventDuration(e), 0);
	const remainingMs = Math.max(0, capacityMs - usedMs);
	const percentUsed = capacityMs > 0 ? Math.min(100, (usedMs / capacityMs) * 100) : 0;

	return { capacityMs, usedMs, remainingMs, percentUsed, boundaryStart, boundaryEnd };
}

/**
 * Convenience: infer boundaries from events then calculate capacity.
 * Caller passes the already-in-period events.
 */
export function calculateCapacityFromEvents(
	events: CalendarEvent[],
	periodStart: Date,
	periodEnd: Date,
	fallbackStartHour: number,
	fallbackEndHour: number
): CapacityResult {
	const { startHour, endHour } = inferBoundaries(events, fallbackStartHour, fallbackEndHour);
	return calculateCapacity(events, periodStart, periodEnd, startHour, endHour);
}

export function formatCapacityLabel(result: CapacityResult, showDecimalHours: boolean): string {
	const fmt = pickDurationFormatter({ showDecimalHours });
	return `${fmt(result.usedMs)} / ${fmt(result.capacityMs)}`;
}

export function formatBoundaryHour(h: number): string {
	const hrs = Math.floor(h);
	const mins = Math.round((h - hrs) * 60);
	return `${hrs}:${String(mins).padStart(2, "0")}`;
}

export function formatBoundaryRange(result: CapacityResult): string {
	return `${formatBoundaryHour(result.boundaryStart)}–${formatBoundaryHour(result.boundaryEnd)}`;
}
