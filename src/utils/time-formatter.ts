import { formatDurationHumanReadable } from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";

import type { CalendarEvent } from "../types/calendar";
import { isAllDayEvent, isTimedEvent } from "../types/calendar";

export function formatEventTimeInfo(event: CalendarEvent): string {
	const startTime = DateTime.fromISO(event.start);
	if (isAllDayEvent(event)) {
		return `All Day - ${startTime.toFormat("MMM d, yyyy")}`;
	}
	const endTime = isTimedEvent(event) ? DateTime.fromISO(event.end) : null;
	if (endTime && endTime > startTime) {
		const durationText = formatDurationHumanReadable(startTime, endTime);
		return `${startTime.toFormat("MMM d, yyyy - h:mm a")} (${durationText})`;
	}
	return startTime.toFormat("MMM d, yyyy - h:mm a");
}
