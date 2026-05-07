import { createGridLayout, type GridLayoutHandle } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { memo, type Ref,useEffect, useImperativeHandle, useRef } from "react";
import { merge } from "rxjs";

import { type HeatmapHandle,renderHeatmapInto } from "../../components/modals";
import type { IntervalStatsViewHandle } from "../../components/views/interval-stats-view";
import { renderMonthlyStatsInto } from "../../components/views/monthly-stats-renderer";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { ProGatedContent } from "./pro-gated-content";

export interface HeatmapMonthlyStatsTabHandle {
	handleArrow(direction: "left" | "right" | "up" | "down"): void;
}

interface HeatmapMonthlyStatsTabProps {
	app: App;
	bundle: CalendarBundle;
	handleRef?: Ref<HeatmapMonthlyStatsTabHandle>;
}

const HeatmapMonthlyStatsBody = memo(function HeatmapMonthlyStatsBody({
	app,
	bundle,
	handleRef,
}: HeatmapMonthlyStatsTabProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const heatmapRef = useRef<HeatmapHandle | null>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

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
						heatmapRef.current = renderHeatmapInto(cellEl, app, bundle, {
							events: bundle.eventStore.getAllEvents(),
							initialMode: "monthly",
							lockMode: true,
							onNavigate: ({ year, month }) => {
								statsHandle?.setDate(new Date(year, month - 1, 1));
							},
						});
					},
					cleanup: () => {
						heatmapRef.current?.destroy();
						heatmapRef.current = null;
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

		const sub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$).subscribe(() => {
			heatmapRef.current?.refresh(bundle.eventStore.getAllEvents());
		});

		return () => {
			sub.unsubscribe();
			gridHandle?.destroy();
			gridHandle = null;
		};
	}, [app, bundle]);

	useImperativeHandle(
		handleRef,
		() => ({
			handleArrow: (direction) => heatmapRef.current?.handleArrow(direction),
		}),
		[]
	);

	return (
		<div ref={containerRef} style={{ flex: "1 1 auto", minHeight: 0 }} data-testid="prisma-heatmap-monthly-stats-tab" />
	);
});

export const HeatmapMonthlyStatsTab = memo(function HeatmapMonthlyStatsTab(props: HeatmapMonthlyStatsTabProps) {
	return (
		<ProGatedContent
			bundle={props.bundle}
			featureName={PRO_FEATURES.HEATMAP_MONTHLY}
			description="Pair a monthly activity heatmap with a breakdown pie chart — spot patterns and where your time actually went in one view."
			previewKey="HEATMAP_MONTHLY"
		>
			<HeatmapMonthlyStatsBody {...props} />
		</ProGatedContent>
	);
});
