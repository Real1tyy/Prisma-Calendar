import { createGridLayout, type GridLayoutHandle, type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { merge } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { type HeatmapHandle, renderHeatmapInto } from "../modals";
import type { IntervalStatsViewHandle } from "./interval-stats-view";
import { renderMonthlyStatsInto } from "./monthly-stats-renderer";
import { createProGatedContent } from "./pro-gated-content";

export function createHeatmapMonthlyStatsTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let heatmapHandle: HeatmapHandle | null = null;

	const gate = createProGatedContent(bundle, {
		featureName: PRO_FEATURES.HEATMAP,
		description:
			"Pair a monthly activity heatmap with a breakdown pie chart — spot patterns and where your time actually went in one view.",
		previewKey: "HEATMAP",
		render: (el) => {
			let gridHandle: GridLayoutHandle | null = null;
			let statsHandle: IntervalStatsViewHandle | null = null;

			gridHandle = createGridLayout(el, {
				cssPrefix: "prisma-heatmap-monthly-stats-",
				columns: 2,
				rows: 1,
				gap: "12px",
				dividers: true,
				cells: [
					{
						id: "heatmap",
						label: "Monthly Heatmap",
						row: 0,
						col: 0,
						render: (cellEl) => {
							heatmapHandle = renderHeatmapInto(cellEl, app, bundle, {
								events: bundle.eventStore.getAllEvents(),
								initialMode: "monthly",
								lockMode: true,
								onNavigate: ({ year, month }) => {
									statsHandle?.setDate(new Date(year, month - 1, 1));
								},
							});
						},
						cleanup: () => {
							heatmapHandle?.destroy();
							heatmapHandle = null;
						},
					},
					{
						id: "stats",
						label: "Statistics",
						row: 0,
						col: 1,
						render: (cellEl) => {
							statsHandle = renderMonthlyStatsInto(cellEl, bundle);
						},
						cleanup: () => {
							statsHandle?.destroy();
							statsHandle = null;
						},
					},
				],
			});

			const eventsSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$).subscribe(() => {
				heatmapHandle?.refresh(bundle.eventStore.getAllEvents());
			});

			return () => {
				eventsSub.unsubscribe();
				gridHandle?.destroy();
				gridHandle = null;
			};
		},
	});

	return {
		id: "heatmap-monthly-stats",
		label: "Heatmap Monthly + Stats",
		keyHandlers: {
			ArrowLeft: () => heatmapHandle?.handleArrow("left"),
			ArrowRight: () => heatmapHandle?.handleArrow("right"),
			ArrowUp: () => heatmapHandle?.handleArrow("up"),
			ArrowDown: () => heatmapHandle?.handleArrow("down"),
		},
		render: gate.attach,
		cleanup: gate.destroy,
	};
}
