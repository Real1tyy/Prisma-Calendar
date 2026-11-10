import type { CalendarOptions, EventApi } from "@fullcalendar/core";

type OverlapRange = Pick<EventApi, "start" | "end">;
type OverlapEvent = OverlapRange & Pick<EventApi, "allDay" | "display">;

/** Finds an event as the calendar currently holds it, i.e. at its pre-drag times. */
export type FindCalendarEvent = (id: string) => OverlapRange | null;

const BACKGROUND_DISPLAYS = new Set(["background", "inverse-background"]);

function rangesOverlap(a: OverlapRange, b: OverlapRange): boolean {
	if (!a.start || !b.start) return false;
	const aEnd = a.end ?? a.start;
	const bEnd = b.end ?? b.start;
	return a.start < bEnd && b.start < aEnd;
}

/**
 * FullCalendar's `eventOverlap`. When overlaps are disallowed, FullCalendar asks once per event a drop
 * or resize would intersect, and it counts every all-day or background event on a day as intersecting
 * every timed event there. A double booking is two events sharing time in the same row, so only those
 * are refused, and only when new: an event already in a double booking can still be moved out of it.
 *
 * FullCalendar passes the moving event at its new, mutated times (its docs say the original ones), so
 * the pre-drag range comes from the calendar's own store.
 */
export function buildEventOverlapRule(
	allowOverlap: boolean,
	findCalendarEvent: FindCalendarEvent
): NonNullable<CalendarOptions["eventOverlap"]> {
	if (allowOverlap) return true;
	return (stillEvent: OverlapEvent, movingEvent: (OverlapEvent & Pick<EventApi, "id">) | null) => {
		if (BACKGROUND_DISPLAYS.has(stillEvent.display) || stillEvent.allDay) return true;
		if (!movingEvent) return false;
		if (movingEvent.allDay || BACKGROUND_DISPLAYS.has(movingEvent.display)) return true;
		const original = findCalendarEvent(movingEvent.id);
		return original !== null && rangesOverlap(stillEvent, original);
	};
}
