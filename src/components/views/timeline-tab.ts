import type { TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { renderTimelineInto, type TimelineHandle } from "../modals";

export function createTimelineTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let handle: TimelineHandle | null = null;
	let eventStoreSub: Subscription | null = null;
	let recurringEventSub: Subscription | null = null;

	return {
		id: "timeline",
		label: "Timeline",
		render: (el) => {
			handle = renderTimelineInto(el, app, bundle, {
				events: bundle.eventStore.getAllEvents(),
				title: "All Events Timeline",
				fillContainer: true,
			});

			eventStoreSub = bundle.eventStore.subscribe(() => {
				handle?.refresh(bundle.eventStore.getAllEvents());
			});

			recurringEventSub = bundle.recurringEventManager.subscribe(() => {
				handle?.refresh(bundle.eventStore.getAllEvents());
			});
		},
		cleanup: () => {
			eventStoreSub?.unsubscribe();
			eventStoreSub = null;
			recurringEventSub?.unsubscribe();
			recurringEventSub = null;
			handle?.destroy();
			handle = null;
		},
	};
}
