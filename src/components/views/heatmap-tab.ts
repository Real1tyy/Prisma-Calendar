import { cls, type TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { PRO_FEATURES } from "../../core/license";
import { type HeatmapHandle, renderHeatmapInto } from "../modals/event-series-heatmap-modal";

export function createHeatmapTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let heatmapHandle: HeatmapHandle | null = null;
	let eventStoreSub: Subscription | null = null;
	let recurringEventSub: Subscription | null = null;
	let keydownHandler: ((e: KeyboardEvent) => void) | null = null;

	return {
		id: "heatmap",
		label: "Heat Map",
		render: (el) => {
			if (!bundle.plugin.licenseManager.requirePro(PRO_FEATURES.HEATMAP)) {
				el.createDiv({ cls: cls("tab-pro-gate"), text: "Heat Map is a Pro feature." });
				return;
			}

			heatmapHandle = renderHeatmapInto(el, app, bundle, {
				events: bundle.eventStore.getAllEvents(),
				title: "All Events Heatmap",
			});

			el.setAttribute("tabindex", "-1");
			keydownHandler = (e: KeyboardEvent) => {
				if (e.key === "ArrowLeft") {
					heatmapHandle?.navigate(-1);
					e.preventDefault();
				} else if (e.key === "ArrowRight") {
					heatmapHandle?.navigate(1);
					e.preventDefault();
				}
			};
			el.addEventListener("keydown", keydownHandler);
			el.focus();

			eventStoreSub = bundle.eventStore.subscribe(() => {
				heatmapHandle?.refresh(bundle.eventStore.getAllEvents());
			});

			recurringEventSub = bundle.recurringEventManager.subscribe(() => {
				heatmapHandle?.refresh(bundle.eventStore.getAllEvents());
			});
		},
		cleanup: () => {
			eventStoreSub?.unsubscribe();
			eventStoreSub = null;
			recurringEventSub?.unsubscribe();
			recurringEventSub = null;
			keydownHandler = null;
			heatmapHandle?.destroy();
			heatmapHandle = null;
		},
	};
}
