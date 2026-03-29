import type { Viewport } from "./gantt-types";
import { MS_PER_DAY } from "./gantt-types";

export function buildViewport(startMs: number, widthPx: number, heightPx: number, pxPerDay: number): Viewport {
	const daysVisible = widthPx / pxPerDay;
	const endMs = startMs + daysVisible * MS_PER_DAY;

	return {
		startMs,
		endMs,
		widthPx,
		heightPx,
		pxPerDay,
		toX(ms: number): number {
			return ((ms - startMs) / MS_PER_DAY) * pxPerDay;
		},
		toWidth(s: number, e: number): number {
			return ((e - s) / MS_PER_DAY) * pxPerDay;
		},
		toMs(x: number): number {
			return startMs + (x / pxPerDay) * MS_PER_DAY;
		},
	};
}

export function centerViewportOnTasks(
	tasks: { startMs: number; endMs: number }[],
	widthPx: number,
	heightPx: number,
	pxPerDay: number
): Viewport {
	if (tasks.length === 0) {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const daysVisible = widthPx / pxPerDay;
		const startMs = today.getTime() - (daysVisible / 2) * MS_PER_DAY;
		return buildViewport(startMs, widthPx, heightPx, pxPerDay);
	}

	const minStart = Math.min(...tasks.map((t) => t.startMs));
	const maxEnd = Math.max(...tasks.map((t) => t.endMs));
	const dataCenter = (minStart + maxEnd) / 2;
	const daysVisible = widthPx / pxPerDay;
	const startMs = dataCenter - (daysVisible / 2) * MS_PER_DAY;

	return buildViewport(startMs, widthPx, heightPx, pxPerDay);
}
