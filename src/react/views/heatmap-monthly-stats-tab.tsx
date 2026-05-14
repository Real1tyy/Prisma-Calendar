import { cls, tid } from "@real1ty-obsidian-plugins";
import { GridLayout, useApp, useSubscription } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useImperativeHandle, useMemo, useRef } from "react";
import { debounceTime, merge } from "rxjs";

import { type HeatmapHandle, renderHeatmapInto } from "../../components/modals";
import { PRO_FEATURES } from "../../core/license";
import { useBundle } from "../contexts/bundle-context";
import { ProGatedContent } from "./pro-gated-content";
import { type IntervalStatsCellHandle, mountIntervalStatsCell } from "./stats/interval-stats-cell";
import { MONTHLY_STATS_CONFIG } from "./stats/stats-configs";

const REFRESH_DEBOUNCE_MS = 100;

export interface HeatmapMonthlyStatsTabHandle {
	handleArrow(direction: "left" | "right" | "up" | "down"): void;
}

interface HeatmapMonthlyStatsTabProps {
	handleRef?: Ref<HeatmapMonthlyStatsTabHandle>;
}

const HeatmapMonthlyStatsBody = memo(function HeatmapMonthlyStatsBody({ handleRef }: HeatmapMonthlyStatsTabProps) {
	const app = useApp();
	const bundle = useBundle();
	const heatmapRef = useRef<HeatmapHandle | null>(null);
	const statsHandleRef = useRef<IntervalStatsCellHandle | null>(null);

	const cells = useMemo(
		() => [
			{
				id: "heatmap",
				label: "Monthly Heatmap",
				row: 0,
				col: 0,
				render: (cellEl: HTMLElement) => {
					heatmapRef.current = renderHeatmapInto(cellEl, app, bundle, {
						events: bundle.eventStore.getAllEvents(),
						initialMode: "monthly",
						lockMode: true,
						onNavigate: ({ year, month }) => {
							statsHandleRef.current?.setDate(new Date(year, month - 1, 1));
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
				render: (cellEl: HTMLElement) => {
					statsHandleRef.current = mountIntervalStatsCell(cellEl, app, bundle, MONTHLY_STATS_CONFIG);
				},
				cleanup: () => {
					statsHandleRef.current?.unmount();
					statsHandleRef.current = null;
				},
			},
		],
		[app, bundle]
	);

	const changes$ = useMemo(
		() =>
			merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$).pipe(debounceTime(REFRESH_DEBOUNCE_MS)),
		[bundle]
	);
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
		<GridLayout
			app={app}
			cssPrefix={cls("heatmap-monthly-stats-")}
			columns={2}
			rows={1}
			gap="12px"
			dividers
			cells={cells}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("heatmap-monthly-stats-tab")}
		/>
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
