import { addCls, cls, removeCls, toLocalISOString } from "@real1ty-obsidian-plugins";
import { merge, type Subscription } from "rxjs";

import type { CalendarBundle } from "../core/calendar-bundle";
import { calculateCapacityFromEvents, formatBoundaryRange, formatCapacityLabel } from "../utils/capacity";
import { formatDuration, formatDurationAsDecimalHours, getDayBounds } from "../utils/weekly-stats";

export interface CapacityIndicatorHandle {
	setRange: (start: Date, end: Date) => void;
	destroy: () => void;
}

export function createCapacityIndicator(container: HTMLElement, bundle: CalendarBundle): CapacityIndicatorHandle {
	const badge = container.createDiv(cls("capacity-indicator"));
	let subscription: Subscription | null = null;

	const today = getDayBounds(new Date());
	let rangeStart: Date = today.start;
	let rangeEnd: Date = today.end;

	async function refresh(): Promise<void> {
		const settings = bundle.settingsStore.currentSettings;
		if (!settings.capacityTrackingEnabled) {
			addCls(badge, "hidden");
			return;
		}

		removeCls(badge, "hidden");
		const query = { start: toLocalISOString(rangeStart), end: toLocalISOString(rangeEnd) };
		const events = await bundle.eventStore.getEvents(query);

		const capacity = calculateCapacityFromEvents(events, rangeStart, rangeEnd, settings.hourStart, settings.hourEnd);
		const label = formatCapacityLabel(capacity, settings.showDecimalHours);
		const fmt = settings.showDecimalHours ? formatDurationAsDecimalHours : formatDuration;
		badge.textContent = `⏱ ${label} (${capacity.percentUsed.toFixed(0)}%)`;
		badge.title = `Bounds: ${formatBoundaryRange(capacity)}\nRemaining: ${fmt(capacity.remainingMs)}`;
	}

	void refresh();

	subscription = merge(bundle.eventStore.changes$, bundle.settingsStore.settings$).subscribe(() => void refresh());

	return {
		setRange: (start: Date, end: Date) => {
			rangeStart = start;
			rangeEnd = end;
			void refresh();
		},
		destroy: () => {
			subscription?.unsubscribe();
			subscription = null;
			badge.remove();
		},
	};
}
