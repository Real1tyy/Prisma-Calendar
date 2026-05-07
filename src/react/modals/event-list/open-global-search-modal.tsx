import { ColorEvaluator, formatLocaleShortDate, formatLocaleTimeHm, toLocalISOString } from "@real1ty-obsidian-plugins";
import { showReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { Notice } from "obsidian";
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import type { CalendarComponent } from "../../../components/calendar-view";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import { resolveEventColor } from "../../../utils/event-color";
import { removeZettelId } from "../../../utils/events/zettel-id";
import type { EventListAction, EventListItemData } from "./event-list-item";
import { EventListModal } from "./event-list-modal";

type FilterState = "none" | "skip" | "only";

interface GlobalSearchFilters {
	recurring: FilterState;
	allDay: FilterState;
	skipped: FilterState;
}

const SEARCH_YEAR_RANGE = 5;

function formatEventSubtitle(event: CalendarEvent): string {
	const parts: string[] = [];
	parts.push(event.allDay ? "All-day" : "Timed");

	const startDate = new Date(event.start);
	if (event.allDay) {
		parts.push(formatLocaleShortDate(startDate));
	} else {
		const dateStr = formatLocaleShortDate(startDate);
		const startTimeStr = formatLocaleTimeHm(startDate);
		if ("end" in event && event.end) {
			const endDate = new Date(event.end);
			const endDateStr = formatLocaleShortDate(endDate);
			const endTimeStr = formatLocaleTimeHm(endDate);
			parts.push(
				dateStr === endDateStr
					? `${dateStr} ${startTimeStr} - ${endTimeStr}`
					: `${dateStr} ${startTimeStr} - ${endDateStr} ${endTimeStr}`
			);
		} else {
			parts.push(`${dateStr} ${startTimeStr}`);
		}
	}

	if (event.metadata.rruleType) {
		parts.push("Recurring");
	}

	return parts.join(" • ");
}

/** none → only → skip → none */
const FILTER_STATE_CYCLE = ["none", "only", "skip"] as const satisfies readonly FilterState[];

function cycleFilterState(current: FilterState): FilterState {
	const i = FILTER_STATE_CYCLE.indexOf(current);
	return FILTER_STATE_CYCLE[(i + 1) % FILTER_STATE_CYCLE.length] ?? "none";
}

function filterButtonText(label: string, state: FilterState): string {
	if (state === "none") return label;
	const prefix = state === "skip" ? "Skip " : "Only ";
	return `${prefix}${label.toLowerCase()}`;
}

function applyTriStateFilter<T>(items: T[], state: FilterState, predicate: (item: T) => boolean): T[] {
	const strategies: Record<FilterState, (xs: T[]) => T[]> = {
		none: (xs) => xs,
		skip: (xs) => xs.filter((item) => !predicate(item)),
		only: (xs) => xs.filter(predicate),
	};
	return strategies[state](items);
}

function FilterButton({ label, state, onClick }: { label: string; state: FilterState; onClick: () => void }) {
	return (
		<button className={`prisma-filter-cycle-button prisma-filter-state-${state}`} onClick={onClick}>
			{filterButtonText(label, state)}
		</button>
	);
}

function GlobalSearchContent({
	bundle,
	calendarComponent,
	onClose,
}: {
	bundle: CalendarBundle;
	calendarComponent: CalendarComponent;
	onClose: () => void;
}) {
	const colorEvaluator = useRef(new ColorEvaluator(bundle.settingsStore.settings$));
	useEffect(() => () => colorEvaluator.current.destroy(), []);

	const [filters, setFilters] = useState<GlobalSearchFilters>({
		recurring: "none",
		allDay: "none",
		skipped: "none",
	});
	const deferredFilters = useDeferredValue(filters);

	const physicalEventsInRange = useMemo(() => {
		const start = new Date();
		start.setFullYear(start.getFullYear() - SEARCH_YEAR_RANGE);
		const end = new Date();
		end.setFullYear(end.getFullYear() + SEARCH_YEAR_RANGE);

		return bundle.eventStore
			.getPhysicalEvents({ start: toLocalISOString(start), end: toLocalISOString(end) })
			.filter((event) => event.virtualKind !== "recurring");
	}, [bundle]);

	const items = useMemo((): EventListItemData[] => {
		let events = physicalEventsInRange;

		events = applyTriStateFilter(events, deferredFilters.recurring, (e) => !!e.metadata.rruleType);
		events = applyTriStateFilter(events, deferredFilters.allDay, (e) => e.allDay);
		events = applyTriStateFilter(events, deferredFilters.skipped, (e) => e.skipped);

		return events.map((event) => ({
			id: event.id,
			filePath: event.ref.filePath,
			title: removeZettelId(event.title),
			subtitle: formatEventSubtitle(event),
			categoryColor: resolveEventColor(event.meta, bundle, colorEvaluator.current),
		}));
	}, [bundle, deferredFilters, physicalEventsInRange]);

	const openFile = useCallback(
		(item: EventListItemData) => {
			void bundle.plugin.app.workspace.openLinkText(item.filePath, "", false);
		},
		[bundle.plugin.app]
	);

	const actions: EventListAction[] = useMemo(
		() => [
			{ label: "Open", handler: openFile },
			{
				label: "Navigate to",
				isPrimary: true,
				handler: (item: EventListItemData) => {
					const event = bundle.eventStore.getEventByPath(item.filePath);

					if (!event) {
						new Notice(`Event not found: ${item.title}, this should not happen, please report this as a bug.`);
						return;
					}

					const eventDate = new Date(event.start);
					calendarComponent.navigateToDate(eventDate, "timeGridWeek");
					setTimeout(() => {
						calendarComponent.highlightEventByPath(item.filePath, 5000);
					}, 300);
					new Notice(`Navigated to: ${item.title}`);
					onClose();
				},
			},
		],
		[openFile, bundle, calendarComponent, onClose]
	);

	const headerContent = useMemo(
		() => (
			<div className="prisma-global-search-filters">
				<div className="prisma-global-search-toggles">
					<FilterButton
						label="Recurring"
						state={filters.recurring}
						onClick={() => {
							startTransition(() => setFilters((f) => ({ ...f, recurring: cycleFilterState(f.recurring) })));
						}}
					/>
					<FilterButton
						label="All-day"
						state={filters.allDay}
						onClick={() => {
							startTransition(() => setFilters((f) => ({ ...f, allDay: cycleFilterState(f.allDay) })));
						}}
					/>
					<FilterButton
						label="Skipped"
						state={filters.skipped}
						onClick={() => {
							startTransition(() => setFilters((f) => ({ ...f, skipped: cycleFilterState(f.skipped) })));
						}}
					/>
				</div>
			</div>
		),
		[filters]
	);

	return (
		<EventListModal
			items={items}
			title="Global Event Search"
			searchFields={["title", "subtitle"]}
			actions={actions}
			emptyHint="No events found in this calendar."
			onItemClick={openFile}
			onClose={onClose}
			headerContent={headerContent}
		/>
	);
}

export function openGlobalSearchModal(app: App, bundle: CalendarBundle, calendarComponent: CalendarComponent): void {
	showReactModal({
		app,
		cls: "prisma-generic-event-list-modal prisma-global-search-modal",
		render: (close) => <GlobalSearchContent bundle={bundle} calendarComponent={calendarComponent} onClose={close} />,
	});
}
