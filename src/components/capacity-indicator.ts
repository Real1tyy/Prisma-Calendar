import { cls } from "@real1ty-obsidian-plugins";
import type { Subscription } from "rxjs";

import type { CalendarBundle } from "../core/calendar-bundle";
import { calculateCapacityFromEvents, formatCapacityLabel } from "../utils/capacity";
import { getDayBounds } from "../utils/weekly-stats";

export interface CapacityIndicatorHandle {
	setRange: (start: Date, end: Date) => void;
	destroy: () => void;
}

export function createCapacityIndicator(container: HTMLElement, bundle: CalendarBundle): CapacityIndicatorHandle {
	const badge = container.createDiv(cls("capacity-indicator"));
	const subscriptions: Subscription[] = [];

	const today = getDayBounds(new Date());
	let rangeStart: Date = today.start;
	let rangeEnd: Date = today.end;

	async function refresh(): Promise<void> {
		const settings = bundle.settingsStore.currentSettings;
		if (!settings.capacityTrackingEnabled) {
			badge.style.display = "none";
			return;
		}

		badge.style.display = "";
		const query = { start: rangeStart.toISOString(), end: rangeEnd.toISOString() };
		const events = await bundle.eventStore.getEvents(query);

		const capacity = calculateCapacityFromEvents(events, rangeStart, rangeEnd, settings.hourStart, settings.hourEnd);
		const label = formatCapacityLabel(capacity, settings.showDecimalHours);
		badge.textContent = `⏱ ${label} (${capacity.percentUsed.toFixed(0)}%)`;
		const fmtHour = (h: number): string => {
			const hrs = Math.floor(h);
			const mins = Math.round((h - hrs) * 60);
			return `${hrs}:${String(mins).padStart(2, "0")}`;
		};
		badge.title = `${fmtHour(capacity.boundaryStart)}–${fmtHour(capacity.boundaryEnd)}`;
	}

	void refresh();

	subscriptions.push(bundle.eventStore.subscribe(() => void refresh()));
	subscriptions.push(bundle.settingsStore.settings$.subscribe(() => void refresh()));

	return {
		setRange: (start: Date, end: Date) => {
			rangeStart = start;
			rangeEnd = end;
			void refresh();
		},
		destroy: () => {
			for (const sub of subscriptions) sub.unsubscribe();
			subscriptions.length = 0;
			badge.remove();
		},
	};
}
