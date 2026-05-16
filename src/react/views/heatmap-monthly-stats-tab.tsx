import { cls, type GridLayoutState, tid } from "@real1ty-obsidian-plugins";
import {
	Cell,
	GridLayout,
	ImperativeCellHost,
	useApp,
	useSchemaField,
	useSubscription,
} from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { debounceTime, merge } from "rxjs";

import { type HeatmapHandle, renderHeatmapInto } from "../../components/modals";
import { PRO_FEATURES } from "../../core/license";
import { useBundle } from "../contexts/bundle-context";
import { ProGatedContent } from "./pro-gated-content";
import { type IntervalStatsCellHandle, mountIntervalStatsCell } from "./stats/interval-stats-cell";
import { MONTHLY_STATS_CONFIG } from "./stats/stats-configs";

const REFRESH_DEBOUNCE_MS = 100;

const DEFAULT_HEATMAP_MONTHLY_STATS_GRID_STATE: GridLayoutState = {
	columns: 2,
	rows: 1,
	cells: [],
	columnSizes: [0.5, 0.5],
	rowSizes: undefined,
	cellColumnSizes: undefined,
	cellRowSizes: undefined,
};

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

	const [savedGridState, setGridState] = useSchemaField<GridLayoutState | undefined>(
		bundle.settingsStore,
		"heatmapMonthlyStatsGridState"
	);
	const [initialGridState] = useState<GridLayoutState>(
		() => savedGridState ?? DEFAULT_HEATMAP_MONTHLY_STATS_GRID_STATE
	);
	const handleStateChange = useCallback((next: GridLayoutState) => setGridState(next), [setGridState]);

	const renderHeatmap = useCallback(
		(el: HTMLElement) => {
			heatmapRef.current = renderHeatmapInto(el, app, bundle, {
				events: bundle.eventStore.getAllEvents(),
				initialMode: "monthly",
				lockMode: true,
				onNavigate: ({ year, month }) => {
					statsHandleRef.current?.setDate(new Date(year, month - 1, 1));
				},
			});
		},
		[app, bundle]
	);
	const cleanupHeatmap = useCallback(() => {
		heatmapRef.current?.destroy();
		heatmapRef.current = null;
	}, []);
	const renderStats = useCallback(
		(el: HTMLElement) => {
			statsHandleRef.current = mountIntervalStatsCell(el, app, bundle, MONTHLY_STATS_CONFIG);
		},
		[app, bundle]
	);
	const cleanupStats = useCallback(() => {
		statsHandleRef.current?.unmount();
		statsHandleRef.current = null;
	}, []);

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
			resizable="track"
			initialState={initialGridState}
			onStateChange={handleStateChange}
			style={{ flex: "1 1 auto", minHeight: 0 }}
			data-testid={tid("heatmap-monthly-stats-tab")}
		>
			<Cell id="heatmap" label="Monthly Heatmap">
				<ImperativeCellHost render={renderHeatmap} cleanup={cleanupHeatmap} />
			</Cell>
			<Cell id="stats" label="Statistics">
				<ImperativeCellHost render={renderStats} cleanup={cleanupStats} />
			</Cell>
		</GridLayout>
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
