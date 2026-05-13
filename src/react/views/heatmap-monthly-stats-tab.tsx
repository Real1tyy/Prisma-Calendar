import { cls, createGridLayout, type GridLayoutHandle, tid } from "@real1ty-obsidian-plugins";
import { useApp, useSubscription } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { merge } from "rxjs";

import { type HeatmapHandle, renderHeatmapInto } from "../../components/modals";
import type { IntervalStatsViewHandle } from "../../components/views/interval-stats-view";
import { renderMonthlyStatsInto } from "../../components/views/monthly-stats-renderer";
import { PRO_FEATURES } from "../../core/license";
import { useBundle } from "../contexts/bundle-context";
import { ProGatedContent } from "./pro-gated-content";

export interface HeatmapMonthlyStatsTabHandle {
	handleArrow(direction: "left" | "right" | "up" | "down"): void;
}

interface HeatmapMonthlyStatsTabProps {
	handleRef?: Ref<HeatmapMonthlyStatsTabHandle>;
}

const HeatmapMonthlyStatsBody = memo(function HeatmapMonthlyStatsBody({ handleRef }: HeatmapMonthlyStatsTabProps) {
	const app = useApp();
	const bundle = useBundle();
	const containerRef = useRef<HTMLDivElement>(null);
	const heatmapRef = useRef<HeatmapHandle | null>(null);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		let gridHandle: GridLayoutHandle | null = null;
		let statsHandle: IntervalStatsViewHandle | null = null;

		gridHandle = createGridLayout(el, {
			cssPrefix: cls("heatmap-monthly-stats-"),
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

		return () => {
			gridHandle?.destroy();
			gridHandle = null;
		};
	}, [app, bundle]);

	const changes$ = useMemo(() => merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$), [bundle]);
	useSubscription(changes$, () => {
		heatmapRef.current?.refresh(bundle.eventStore.getAllEvents());
	});

	useImperativeHandle(
		handleRef,
		() => ({
			handleArrow: (direction) => heatmapRef.current?.handleArrow(direction),
		}),
		[]
	);

	return (
		<div ref={containerRef} style={{ flex: "1 1 auto", minHeight: 0 }} data-testid={tid("heatmap-monthly-stats-tab")} />
	);
});

export const HeatmapMonthlyStatsTab = memo(function HeatmapMonthlyStatsTab(props: HeatmapMonthlyStatsTabProps) {
	return (
		<ProGatedContent
			featureName={PRO_FEATURES.HEATMAP_MONTHLY}
			description="Pair a monthly activity heatmap with a breakdown pie chart — spot patterns and where your time actually went in one view."
			previewKey="HEATMAP_MONTHLY"
		>
			<HeatmapMonthlyStatsBody {...props} />
		</ProGatedContent>
	);
});
