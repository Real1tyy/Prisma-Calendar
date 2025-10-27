import { DateTime } from "luxon";
import { formatDurationHumanReadable } from "./format";

export function formatEventTimeInfo(event: { start: string; end?: string; allDay: boolean }): string {
	const startTime = DateTime.fromISO(event.start, { zone: "utc" });
	if (event.allDay) {
		return `All Day - ${startTime.toFormat("MMM d, yyyy")}`;
	}
	const endTime = event.end ? DateTime.fromISO(event.end, { zone: "utc" }) : null;
	if (endTime) {
		const durationText = formatDurationHumanReadable(startTime, endTime);
		return `${startTime.toFormat("MMM d, yyyy - h:mm a")} (${durationText})`;
	}
	return startTime.toFormat("MMM d, yyyy - h:mm a");
}
