import { type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { distinctUntilChanged, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { type HeatmapHandle, renderHeatmapInto } from "../modals";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";

export function createHeatmapTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let heatmapHandle: HeatmapHandle | null = null;
	let eventStoreSub: Subscription | null = null;
	let recurringEventSub: Subscription | null = null;
	let isProSub: Subscription | null = null;

	function cleanupContent(): void {
		eventStoreSub?.unsubscribe();
		eventStoreSub = null;
		recurringEventSub?.unsubscribe();
		recurringEventSub = null;
		heatmapHandle?.destroy();
		heatmapHandle = null;
	}

	return {
		id: "heatmap",
		label: "Heat Map",
		keyHandlers: {
			ArrowLeft: () => heatmapHandle?.navigate(-1),
			ArrowRight: () => heatmapHandle?.navigate(1),
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

				heatmapHandle = renderHeatmapInto(el, app, bundle, {
					events: bundle.eventStore.getAllEvents(),
					title: "All Events Heatmap",
				});

				eventStoreSub = bundle.eventStore.subscribe(() => {
					heatmapHandle?.refresh(bundle.eventStore.getAllEvents());
				});

				recurringEventSub = bundle.recurringEventManager.subscribe(() => {
					heatmapHandle?.refresh(bundle.eventStore.getAllEvents());
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
