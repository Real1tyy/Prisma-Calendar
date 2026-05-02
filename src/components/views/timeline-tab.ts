import type { TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { debounceTime, distinctUntilChanged, map, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { getTimelineRenderingKey } from "../../utils/calendar-settings";
import { renderTimelineInto, type TimelineHandle } from "../modals";
import { createViewFilterBar, type ViewFilterBarHandle } from "../view-filter-bar";

const REFRESH_DEBOUNCE_MS = 100;

export function createTimelineTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let handle: TimelineHandle | null = null;
	let mergedSub: Subscription | null = null;
	let filterBar: ViewFilterBarHandle | null = null;

	return {
		id: "timeline",
		label: "Timeline",
		render: (el) => {
			filterBar = createViewFilterBar(bundle, () => {
				handle?.setEventFilter((e) => filterBar!.shouldInclude(e));
			});

			handle = renderTimelineInto(el, app, bundle, {
				fillContainer: true,
				eventFilter: (e) => filterBar!.shouldInclude(e),
				toolbarLeft: filterBar.el,
			});

			const renderingSettings$ = bundle.settingsStore.settings$.pipe(
				skip(1),
				map(getTimelineRenderingKey),
				distinctUntilChanged()
			);

			mergedSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$, renderingSettings$)
				.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
				.subscribe(() => {
					handle?.invalidateAndRefetch();
				});
		},
		cleanup: () => {
			mergedSub?.unsubscribe();
			mergedSub = null;
			filterBar?.destroy();
			filterBar = null;
			handle?.destroy();
			handle = null;
		},
	};
}
