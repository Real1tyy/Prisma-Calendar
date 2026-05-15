import { renderReactInline, useApp, useSubscription } from "@real1ty-obsidian-plugins-react";
import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import { debounceTime, distinctUntilChanged, map, merge, skip } from "rxjs";

import { renderTimelineInto, type TimelineHandle } from "../../components/modals";
import { CSS_PREFIX } from "../../constants";
import { getTimelineRenderingKey } from "../../utils/calendar/settings";
import { BundleContext, useBundle } from "../contexts/bundle-context";
import { FilterBar, type FilterBarHandle } from "./filter-bar";

const REFRESH_DEBOUNCE_MS = 100;

const PASS_ALL: FilterBarHandle = { shouldInclude: () => true };

export const TimelineTab = memo(function TimelineTab() {
	const app = useApp();
	const bundle = useBundle();
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<TimelineHandle | null>(null);
	const filterRef = useRef<FilterBarHandle>(PASS_ALL);

	const handleFilterReady = useCallback((handle: FilterBarHandle) => {
		filterRef.current = handle;
	}, []);

	const handleFilterChange = useCallback(() => {
		handleRef.current?.setEventFilter((event) => filterRef.current.shouldInclude(event));
	}, []);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const handle = renderTimelineInto(el, app, bundle, {
			fillContainer: true,
			eventFilter: (event) => filterRef.current.shouldInclude(event),
		});
		handleRef.current = handle;

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
			handleRef.current = null;
			filterRef.current = PASS_ALL;
		};
	}, [app, bundle, handleFilterChange, handleFilterReady]);

	const changes$ = useMemo(() => {
		const renderingSettings$ = bundle.settingsStore.settings$.pipe(
			skip(1),
			map(getTimelineRenderingKey),
			distinctUntilChanged()
		);
		return merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$, renderingSettings$).pipe(
			debounceTime(REFRESH_DEBOUNCE_MS)
		);
	}, [bundle]);
	useSubscription(changes$, () => {
		handleRef.current?.invalidateAndRefetch();
	});

	return (
		<div ref={containerRef} style={{ flex: "1 1 auto", minHeight: 0 }} data-testid={`${CSS_PREFIX}timeline-tab`} />
	);
});
