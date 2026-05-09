import { toLocalISOString } from "@real1ty-obsidian-plugins";
import { useObservable } from "@real1ty-obsidian-plugins-react";
import { memo, type Ref, useImperativeHandle, useMemo, useState } from "react";
import { combineLatest, from, of } from "rxjs";
import { map, startWith, switchMap } from "rxjs/operators";

import type { CalendarEvent } from "../../types/calendar";
import type { SingleCalendarConfig } from "../../types/settings";
import { calculateCapacityFromEvents, formatBoundaryRange, formatCapacityLabel } from "../../utils/capacity";
import { formatDuration, formatDurationAsDecimalHours, getDayBounds } from "../../utils/stats";
import { useBundle } from "../contexts/bundle-context";

export interface CapacityIndicatorHandle {
	setRange: (start: Date, end: Date) => void;
}

interface CapacityIndicatorProps {
	ref?: Ref<CapacityIndicatorHandle>;
	rangeStart?: Date;
	rangeEnd?: Date;
}

interface CapacityVM {
	label: string;
	tooltip: string;
}

function buildVM(events: CalendarEvent[], settings: SingleCalendarConfig, start: Date, end: Date): CapacityVM {
	const capacity = calculateCapacityFromEvents(events, start, end, settings.hourStart, settings.hourEnd);
	const fmt = settings.showDecimalHours ? formatDurationAsDecimalHours : formatDuration;
	return {
		label: `⏱ ${formatCapacityLabel(capacity, settings.showDecimalHours)} (${capacity.percentUsed.toFixed(0)}%)`,
		tooltip: `Bounds: ${formatBoundaryRange(capacity)}\nRemaining: ${fmt(capacity.remainingMs)}`,
	};
}

export const CapacityIndicator = memo(function CapacityIndicator({
	ref,
	rangeStart,
	rangeEnd,
}: CapacityIndicatorProps) {
	const bundle = useBundle();
	const initialRange = useMemo(() => getDayBounds(new Date()), []);
	const [imperativeRange, setImperativeRange] = useState<{ start: Date; end: Date }>(initialRange);

	useImperativeHandle(
		ref,
		() => ({
			setRange: (start, end) => setImperativeRange({ start, end }),
		}),
		[]
	);

	const start = rangeStart ?? imperativeRange.start;
	const end = rangeEnd ?? imperativeRange.end;
	const startMs = start.getTime();
	const endMs = end.getTime();

	const vm$ = useMemo(() => {
		const startDate = new Date(startMs);
		const endDate = new Date(endMs);

		return combineLatest([bundle.settingsStore.settings$, bundle.eventStore.changes$.pipe(startWith(null))]).pipe(
			switchMap(([settings]) =>
				!settings.capacityTrackingEnabled
					? of(null)
					: from(
							bundle.eventStore.getEvents({
								start: toLocalISOString(startDate),
								end: toLocalISOString(endDate),
							})
						).pipe(map((events) => buildVM(events, settings, startDate, endDate)))
			)
		);
	}, [bundle.eventStore, bundle.settingsStore, startMs, endMs]);

	const vm = useObservable(vm$);
	if (!vm) return null;

	return (
		<div className="prisma-capacity-indicator" title={vm.tooltip} data-testid="prisma-capacity-indicator">
			{vm.label}
		</div>
	);
});
