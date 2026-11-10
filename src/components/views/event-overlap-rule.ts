import type { CalendarOptions, EventApi } from "@fullcalendar/core";

type OverlapRange = Pick<EventApi, "start" | "end">;

/** Finds an event as the calendar currently holds it, i.e. at its pre-drag times. */
export type FindCalendarEvent = (id: string) => OverlapRange | null;

function rangesOverlap(a: OverlapRange, b: OverlapRange): boolean {
	if (!a.start || !b.start) return false;
	const aEnd = a.end ?? a.start;
	const bEnd = b.end ?? b.start;
	return a.start < bEnd && b.start < aEnd;
}

/**
 * FullCalendar's `eventOverlap`. When overlaps are disallowed, FullCalendar asks once per event a drop
 * or resize would collide with. A collision the event already had before the drag stays permitted, so
 * an event caught in an existing double booking can still be moved out of it.
 *
 * FullCalendar passes the moving event at its new, mutated times (its docs say the original ones), so
 * the pre-drag range comes from the calendar's own store.
 */
export function buildEventOverlapRule(
	allowOverlap: boolean,
	findCalendarEvent: FindCalendarEvent
): NonNullable<CalendarOptions["eventOverlap"]> {
	if (allowOverlap) return true;
	return (stillEvent: OverlapRange, movingEvent: Pick<EventApi, "id"> | null) => {
		const original = movingEvent ? findCalendarEvent(movingEvent.id) : null;
		return original !== null && rangesOverlap(stillEvent, original);
	};
}
