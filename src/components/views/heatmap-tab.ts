import { type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { distinctUntilChanged, merge, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { type HeatmapHandle, renderHeatmapInto } from "../modals";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";
import { createViewFilterBar, type ViewFilterBarHandle } from "../view-filter-bar";

export function createHeatmapTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let heatmapHandle: HeatmapHandle | null = null;
	let mergedSub: Subscription | null = null;
	let isProSub: Subscription | null = null;
	let filterBar: ViewFilterBarHandle | null = null;

	function getFilteredEvents(): ReturnType<ViewFilterBarHandle["filterEvents"]> {
		return filterBar!.filterEvents(bundle.eventStore.getAllEvents());
	}

	function cleanupContent(): void {
		mergedSub?.unsubscribe();
		mergedSub = null;
		filterBar?.destroy();
		filterBar = null;
		heatmapHandle?.destroy();
		heatmapHandle = null;
	}

	return {
		id: "heatmap",
		label: "Heatmap",
		keyHandlers: {
			ArrowLeft: () => heatmapHandle?.handleArrow("left"),
			ArrowRight: () => heatmapHandle?.handleArrow("right"),
			ArrowUp: () => heatmapHandle?.handleArrow("up"),
			ArrowDown: () => heatmapHandle?.handleArrow("down"),
		},
		render: (el) => {
			function renderTab(): void {
				cleanupContent();
				el.empty();

				if (!bundle.plugin.licenseManager.isPro) {
					renderProUpgradeBanner(
						el,
						PRO_FEATURES.HEATMAP,
						"Visualize your events over time with an interactive heatmap. See patterns, streaks, and activity density at a glance.",
						"HEATMAP"
					);
					return;
				}

				filterBar = createViewFilterBar(bundle, () => {
					const { visible } = getFilteredEvents();
					heatmapHandle?.refresh(visible);
				});

				const { visible } = getFilteredEvents();

				heatmapHandle = renderHeatmapInto(el, app, bundle, {
					events: visible,
					toolbarLeft: filterBar.el,
				});

				mergedSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$).subscribe(() => {
					const { visible: v } = getFilteredEvents();
					heatmapHandle?.refresh(v);
				});
			}

			renderTab();

			isProSub = bundle.plugin.licenseManager.isPro$.pipe(skip(1), distinctUntilChanged()).subscribe(() => renderTab());
		},
		cleanup: () => {
			isProSub?.unsubscribe();
			isProSub = null;
			cleanupContent();
		},
	};
}
