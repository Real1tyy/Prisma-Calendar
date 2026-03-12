import type { CalendarEvent } from "../../types/calendar";
import { getISODatePart } from "../../utils/format";

export interface HeatmapDayData {
	date: string;
	count: number;
	events: CalendarEvent[];
}

export interface HeatmapDataset {
	days: Map<string, HeatmapDayData>;
	minDate: string;
	maxDate: string;
	maxCount: number;
}

export function buildHeatmapDataset(events: CalendarEvent[]): HeatmapDataset {
	const days = new Map<string, HeatmapDayData>();
	let maxCount = 0;

	for (const event of events) {
		const dateKey = getISODatePart(event.start);
		if (!dateKey) continue;

		const existing = days.get(dateKey);

		if (existing) {
			existing.count++;
			existing.events.push(event);
			if (existing.count > maxCount) maxCount = existing.count;
		} else {
			days.set(dateKey, { date: dateKey, count: 1, events: [event] });
			if (1 > maxCount) maxCount = 1;
		}
	}

	const allDates = [...days.keys()].sort();
	const minDate = allDates[0] ?? "";
	const maxDate = allDates[allDates.length - 1] ?? "";

	return { days, minDate, maxDate, maxCount };
}
