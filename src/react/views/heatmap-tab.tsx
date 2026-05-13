import { renderReactInline, useApp, useSubscription } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { distinctUntilChanged, map, merge, skip } from "rxjs";

import { type HeatmapHandle, renderHeatmapInto } from "../../components/modals";
import { CSS_PREFIX } from "../../constants";
import { PRO_FEATURES } from "../../core/license";
import { getHeatmapRenderingKey } from "../../utils/calendar-settings";
import { BundleContext, useBundle } from "../contexts/bundle-context";
import { FilterBar, type FilterBarHandle } from "./filter-bar";
import { ProGatedContent } from "./pro-gated-content";

export interface HeatmapTabHandle {
	handleArrow(direction: "left" | "right" | "up" | "down"): void;
}

interface HeatmapTabProps {
	handleRef?: Ref<HeatmapTabHandle>;
}

const PASS_ALL: FilterBarHandle = { shouldInclude: () => true };

const HeatmapBody = memo(function HeatmapBody({ handleRef }: HeatmapTabProps) {
	const app = useApp();
	const bundle = useBundle();
	const containerRef = useRef<HTMLDivElement>(null);
	const heatmapRef = useRef<HeatmapHandle | null>(null);
	const filterRef = useRef<FilterBarHandle>(PASS_ALL);

	const handleFilterReady = useCallback((handle: FilterBarHandle) => {
		filterRef.current = handle;
	}, []);

	const getFilteredEvents = useCallback(
		() => bundle.eventStore.getAllEvents().filter((event) => filterRef.current.shouldInclude(event)),
		[bundle]
	);

	const handleFilterChange = useCallback(() => {
		heatmapRef.current?.refresh(getFilteredEvents());
	}, [getFilteredEvents]);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const handle = renderHeatmapInto(el, app, bundle, {
			events: getFilteredEvents(),
		});
		heatmapRef.current = handle;

		const unmountToolbar = renderReactInline(
			handle.toolbarLeft,
			<BundleContext value={bundle}>
				<FilterBar onFilterChange={handleFilterChange} onHandleReady={handleFilterReady} />
			</BundleContext>,
			app,
			{ cssPrefix: CSS_PREFIX }
		);

		return () => {
			unmountToolbar();
			handle.destroy();
			heatmapRef.current = null;
			filterRef.current = PASS_ALL;
		};
	}, [app, bundle, getFilteredEvents, handleFilterChange, handleFilterReady]);

	const changes$ = useMemo(() => {
		const renderingSettings$ = bundle.settingsStore.settings$.pipe(
			skip(1),
			map(getHeatmapRenderingKey),
			distinctUntilChanged()
		);
		return merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$, renderingSettings$);
	}, [bundle]);
	useSubscription(changes$, () => {
		heatmapRef.current?.refresh(getFilteredEvents());
	});

	useImperativeHandle(
		handleRef,
		() => ({
			handleArrow: (direction) => heatmapRef.current?.handleArrow(direction),
		}),
		[]
	);

	return <div ref={containerRef} style={{ flex: "1 1 auto", minHeight: 0 }} data-testid={`${CSS_PREFIX}heatmap-tab`} />;
});

export const HeatmapTab = memo(function HeatmapTab(props: HeatmapTabProps) {
	return (
		<ProGatedContent
			featureName={PRO_FEATURES.HEATMAP}
			description="Visualize your events over time with an interactive heatmap. See patterns, streaks, and activity density at a glance."
			previewKey="HEATMAP"
		>
			<HeatmapBody {...props} />
		</ProGatedContent>
	);
});
