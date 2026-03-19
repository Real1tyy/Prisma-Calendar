import type { TabDefinition } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { debounceTime, merge, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import { renderTimelineInto, type TimelineHandle } from "../modals";

const REFRESH_DEBOUNCE_MS = 100;

export function createTimelineTabDefinition(app: App, bundle: CalendarBundle): TabDefinition {
	let handle: TimelineHandle | null = null;
	let mergedSub: Subscription | null = null;

	return {
		id: "timeline",
		label: "Timeline",
		render: (el) => {
			handle = renderTimelineInto(el, app, bundle, {
				events: bundle.eventStore.getAllEvents(),
				title: "All Events Timeline",
				fillContainer: true,
			});

			mergedSub = merge(bundle.eventStore.changes$, bundle.recurringEventManager.changes$)
				.pipe(debounceTime(REFRESH_DEBOUNCE_MS))
				.subscribe(() => {
					handle?.refresh(bundle.eventStore.getAllEvents());
				});
		},
		cleanup: () => {
			mergedSub?.unsubscribe();
			mergedSub = null;
			handle?.destroy();
			handle = null;
		},
	};
}
