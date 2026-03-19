import { getISODatePart } from "@real1ty-obsidian-plugins";

import type { CalendarEvent } from "../../types/calendar";

export interface HeatmapDayData {
	count: number;
	events: CalendarEvent[];
}

export interface HeatmapDataset {
	days: Map<string, HeatmapDayData>;
	minDate: string;
	maxDate: string;
	maxCount: number;
	/** Quantile thresholds [p25, p50, p75] across active days, used for color bucketing. */
	thresholds: [number, number, number];
}

/**
 * Groups single-day events by ISO date key for heatmap rendering.
 *
 * Assumptions:
 * - Events do not span multiple days.
 * - getISODatePart(event.start) uses the same date semantics as the heatmap renderer.
 */
export function buildHeatmapDataset(events: CalendarEvent[]): HeatmapDataset {
	const days = new Map<string, HeatmapDayData>();

	let minDate = "";
	let maxDate = "";
	let maxCount = 0;

	for (const event of events) {
		const dateKey = getISODatePart(event.start);
		if (!dateKey) continue;

		const existing = days.get(dateKey);

		if (existing) {
			existing.count += 1;
			existing.events.push(event);

			if (existing.count > maxCount) {
				maxCount = existing.count;
			}
		} else {
			days.set(dateKey, { count: 1, events: [event] });

			if (!minDate || dateKey < minDate) minDate = dateKey;
			if (!maxDate || dateKey > maxDate) maxDate = dateKey;
			if (maxCount === 0) maxCount = 1;
		}
	}

	const thresholds = computeQuantileThresholds(days);

	return { days, minDate, maxDate, maxCount, thresholds };
}

function computeQuantileThresholds(days: Map<string, HeatmapDayData>): [number, number, number] {
	if (days.size === 0) return [0, 0, 0];

	const counts = [...days.values()].map((d) => d.count).sort((a, b) => a - b);
	const n = counts.length;

	const p25 = counts[Math.floor((n - 1) * 0.25)]!;
	const p50 = counts[Math.floor((n - 1) * 0.5)]!;
	const p75 = counts[Math.floor((n - 1) * 0.75)]!;

	return [p25, p50, p75];
}
