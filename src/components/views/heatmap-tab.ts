import { type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { merge } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { type HeatmapHandle, renderHeatmapInto } from "../modals";
import { createViewFilterBar, type ViewFilterBarHandle } from "../view-filter-bar";
import { createProGatedContent } from "./pro-gated-content";

export function createHeatmapTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let heatmapHandle: HeatmapHandle | null = null;

	const gate = createProGatedContent(bundle, {
		featureName: PRO_FEATURES.HEATMAP,
		description:
			"Visualize your events over time with an interactive heatmap. See patterns, streaks, and activity density at a glance.",
		previewKey: "HEATMAP",
		render: (el) => {
			let filterBar: ViewFilterBarHandle | null = null;

			function getFilteredEvents(): ReturnType<ViewFilterBarHandle["filterEvents"]> {
				return filterBar!.filterEvents(bundle.eventStore.getAllEvents());
			}

			filterBar = createViewFilterBar(bundle, () => {
				heatmapHandle?.refresh(getFilteredEvents().visible);
			});

			heatmapHandle = renderHeatmapInto(el, app, bundle, {
				events: getFilteredEvents().visible,
				toolbarLeft: filterBar.el,
			});

			const eventsSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$).subscribe(() => {
				heatmapHandle?.refresh(getFilteredEvents().visible);
			});

			return () => {
				eventsSub.unsubscribe();
				filterBar?.destroy();
				filterBar = null;
				heatmapHandle?.destroy();
				heatmapHandle = null;
			};
		},
	});

	return {
		id: "heatmap",
		label: "Heatmap",
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
