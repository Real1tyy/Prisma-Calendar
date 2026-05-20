import { showReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { useCallback, useDeferredValue, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";

import type { CalendarComponent } from "../../../components/calendar-view";
import { cls, tid } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { openEventSeriesModal } from "./event-series-modal-content";
import {
	EVENTS_MODAL_SORT_OPTIONS,
	filterEventsModalItemsByQuery,
	sortEventsModalItems,
	type EventsModalSortMode,
	type EventsModalTabId,
} from "./events-modal-shared";
import { RecurringEventsModalPanel } from "./recurring-events-modal-panel";
import { SimpleEventGroupList, type SimpleEventGroupItem } from "./simple-event-group-list";

function EventsModalContent({
	bundle,
	calendarComponent,
	onClose,
}: {
	bundle: CalendarBundle;
	calendarComponent: CalendarComponent;
	onClose: () => void;
}) {
	const [enabledEvents, setEnabledEvents] = useState(() => bundle.recurringEventManager.getEnabledRecurringEvents());
	const [disabledEvents, setDisabledEvents] = useState(() => bundle.recurringEventManager.getDisabledRecurringEvents());
	const refreshRecurringPools = useCallback(() => {
		setEnabledEvents(bundle.recurringEventManager.getEnabledRecurringEvents());
		setDisabledEvents(bundle.recurringEventManager.getDisabledRecurringEvents());
	}, [bundle]);

	const recurringCount = enabledEvents.length + disabledEvents.length;
	const categories = bundle.categoryTracker.getCategories();
	const categoryCount = categories.length;
	const nameSeriesEnabled = bundle.settingsStore.currentSettings.enableNameSeriesTracking;
	const nameSeries = useMemo(
		() => (nameSeriesEnabled ? bundle.nameSeriesTracker.getNameBasedSeries() : new Map<string, Set<string>>()),
		[nameSeriesEnabled, bundle]
	);
	const nameCount = nameSeries.size;

	const defaultTab: EventsModalTabId = recurringCount > 0 ? "recurring" : categoryCount > 0 ? "byCategory" : "byName";
	const [activeTab, setActiveTab] = useState<EventsModalTabId>(defaultTab);
	const [searchQuery, setSearchQuery] = useState("");
	const deferredSearchQuery = useDeferredValue(searchQuery);
	const [sortMode, setSortMode] = useState<EventsModalSortMode>("count-desc");

	const handleEscape = useCallback(
		(e: KeyboardEvent<HTMLDivElement>) => {
			if (e.key === "Escape") onClose();
		},
		[onClose]
	);

	const byCategoryItems = useMemo(() => {
		const items: SimpleEventGroupItem[] = categories.map((categoryName) => ({
			key: categoryName,
			title: categoryName,
			count: bundle.categoryTracker.getEventsWithCategory(categoryName).length,
			onClick: () => openEventSeriesModal(bundle.plugin.app, bundle, null, null, [categoryName]),
		}));
		return filterEventsModalItemsByQuery(
			sortEventsModalItems(items, (i) => i.count, sortMode),
			deferredSearchQuery
		);
	}, [categories, bundle, sortMode, deferredSearchQuery]);

	const byNameItems = useMemo(() => {
		const items: SimpleEventGroupItem[] = Array.from(nameSeries.entries()).map(([nameKey, files]) => ({
			key: nameKey,
			title: nameKey.charAt(0).toUpperCase() + nameKey.slice(1),
			count: files.size,
			onClick: () => openEventSeriesModal(bundle.plugin.app, bundle, nameKey, null),
		}));
		return filterEventsModalItemsByQuery(
			sortEventsModalItems(items, (i) => i.count, sortMode),
			deferredSearchQuery
		);
	}, [nameSeries, bundle, sortMode, deferredSearchQuery]);

	let content: ReactNode;
	if (activeTab === "recurring") {
		content = (
			<RecurringEventsModalPanel
				bundle={bundle}
				calendarComponent={calendarComponent}
				onClose={onClose}
				enabledEvents={enabledEvents}
				disabledEvents={disabledEvents}
				sortMode={sortMode}
				searchQuery={deferredSearchQuery}
				onRecurringPoolsChanged={refreshRecurringPools}
			/>
		);
	} else if (activeTab === "byCategory") {
		content = (
			<SimpleEventGroupList
				items={byCategoryItems}
				totalCount={categoryCount}
				countLabel={`category group${categoryCount === 1 ? "" : "s"}`}
				emptyMessage="No category groups found."
			/>
		);
	} else {
		content = (
			<SimpleEventGroupList
				items={byNameItems}
				totalCount={nameSeries.size}
				countLabel={`name group${nameSeries.size === 1 ? "" : "s"}`}
				emptyMessage="No name groups found."
			/>
		);
	}

	return (
		<div className={cls("generic-event-list-modal")} onKeyDown={handleEscape}>
			<h2>Events</h2>

			<div className={cls("event-series-tabs")}>
				<button
					className={cls("event-series-tab-btn", activeTab === "recurring" ? "is-active" : "")}
					data-testid={tid("events-modal-tab-recurring")}
					onClick={() => setActiveTab("recurring")}
				>
					Recurring ({recurringCount})
				</button>
				<button
					className={cls("event-series-tab-btn", activeTab === "byCategory" ? "is-active" : "")}
					data-testid={tid("events-modal-tab-by-category")}
					onClick={() => setActiveTab("byCategory")}
				>
					By Category ({categoryCount})
				</button>
				{nameSeriesEnabled && (
					<button
						className={cls("event-series-tab-btn", activeTab === "byName" ? "is-active" : "")}
						data-testid={tid("events-modal-tab-by-name")}
						onClick={() => setActiveTab("byName")}
					>
						By Name ({nameCount})
					</button>
				)}
			</div>

			<div className={cls("generic-event-list-search")}>
				<input
					type="text"
					placeholder="Search events... (Ctrl/Cmd+F)"
					className={cls("generic-event-search-input")}
					data-testid={tid("events-modal-search")}
					value={searchQuery}
					onChange={(e) => setSearchQuery(e.target.value)}
					autoFocus
				/>
				<select
					className={cls("events-modal-sort-select")}
					data-testid={tid("events-modal-sort")}
					value={sortMode}
					onChange={(e) => setSortMode(e.target.value as EventsModalSortMode)}
				>
					{Object.entries(EVENTS_MODAL_SORT_OPTIONS).map(([value, label]) => (
						<option key={value} value={value}>
							{label}
						</option>
					))}
				</select>
			</div>

			<div className={cls("events-modal-content")}>{content}</div>
		</div>
	);
}

export function openEventsModal(app: App, bundle: CalendarBundle, calendarComponent: CalendarComponent): void {
	showReactModal({
		app,
		cls: cls("generic-event-list-modal"),
		render: (close) => <EventsModalContent bundle={bundle} calendarComponent={calendarComponent} onClose={close} />,
	});
}
