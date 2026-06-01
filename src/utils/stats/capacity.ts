import { isTimedEvent, type CalendarEvent } from "../../types/calendar";
import { getEventDurationInRange, pickDurationFormatter } from "./duration";

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
 * Infers the earliest start time and latest end time from a set of timed events,
 * as fractional hours (e.g. 9.5 for 9:30). No rounding — uses exact event times.
 * Falls back to provided defaults when no timed events exist.
 *
 * Each event is clamped to [periodStart, periodEnd) and its hour-fractions are taken
 * relative to the start-of-day of its clamped start. A crossing-midnight event clamps
 * to the next midnight → an `endHour` of 24, so the inferred active window covers its
 * evening hours instead of wrapping to a tiny post-midnight fraction that `maxHour`
 * would ignore (which left `used` exceeding `capacity`). The post-midnight slice is
 * attributed to the next day's window, where its clamped start is 0.
 */
export function inferBoundaries(
	events: CalendarEvent[],
	periodStart: Date,
	periodEnd: Date,
	fallbackStart: number,
	fallbackEnd: number
): { startHour: number; endHour: number } {
	const periodStartMs = periodStart.getTime();
	const periodEndMs = periodEnd.getTime();

	let minHour = Infinity;
	let maxHour = -Infinity;

	for (const event of events) {
		if (!isTimedEvent(event)) continue;

		const clampedStartMs = Math.max(new Date(event.start).getTime(), periodStartMs);
		const clampedEndMs = Math.min(new Date(event.end).getTime(), periodEndMs);
		if (clampedEndMs <= clampedStartMs) continue;

		const clampedStart = new Date(clampedStartMs);
		const dayStartMs = new Date(clampedStart.getFullYear(), clampedStart.getMonth(), clampedStart.getDate()).getTime();

		const startFrac = (clampedStartMs - dayStartMs) / MS_PER_HOUR;
		const endFrac = Math.min(24, (clampedEndMs - dayStartMs) / MS_PER_HOUR);

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
 * Used = total in-period duration of timed events in `events`, each clamped to
 * [periodStart, periodEnd) so a crossing-midnight event contributes only its
 * in-day slice (caller is responsible for passing the in-period set; pair with
 * `getEventsInRange` upstream so this stays in lockstep with
 * `aggregateStats.totalDuration`).
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

	const usedMs = events
		.filter(isTimedEvent)
		.reduce((sum, e) => sum + getEventDurationInRange(e, periodStart, periodEnd), 0);
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
	const { startHour, endHour } = inferBoundaries(events, periodStart, periodEnd, fallbackStartHour, fallbackEndHour);
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
