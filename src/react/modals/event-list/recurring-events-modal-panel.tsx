import { Notice } from "obsidian";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useState } from "react";

import type { CalendarComponent } from "../../../components/calendar-view";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import { assignCategories, toggleSkip } from "../../../core/commands/frontmatter-update-command";
import type { NodeRecurringEvent } from "../../../types/recurring";
import { RECURRENCE_TYPE_OPTIONS } from "../../../types/recurring";
import { formatRecurrenceLabel, getStartDateTime, isPresetType } from "../../../utils/dates/recurring";
import { getEventName } from "../../../utils/events/naming";
import { removeZettelId } from "../../../utils/events/zettel-id";
import { getCategoriesFromFilePath, openFileInNewTab } from "../../../utils/obsidian";
import { openCategoryAssignModal } from "../";
import { openEventSeriesModal } from "./event-series-modal-content";
import { type EventsModalSortMode, filterEventsModalItemsByQuery, sortEventsModalItems } from "./events-modal-shared";

export const RECURRENCE_TYPE_FILTER_OPTIONS = {
	all: "All Types",
	...RECURRENCE_TYPE_OPTIONS,
	custom: "Custom Interval",
} as const;

export interface RecurringEventListRow {
	filePath: string;
	title: string;
	recurrenceType: string;
	categories: string[];
	instanceCount: number;
	rruleId: string;
}

export function RecurringEventsModalPanel({
	bundle,
	calendarComponent,
	onClose,
	enabledEvents,
	disabledEvents,
	sortMode,
	searchQuery,
	onRecurringPoolsChanged,
}: {
	bundle: CalendarBundle;
	calendarComponent: CalendarComponent;
	onClose: () => void;
	enabledEvents: NodeRecurringEvent[];
	disabledEvents: NodeRecurringEvent[];
	sortMode: EventsModalSortMode;
	searchQuery: string;
	onRecurringPoolsChanged?: () => void;
}) {
	const [userToggle, setUserToggle] = useState<boolean | null>(null);
	const [selectedTypeFilter, setSelectedTypeFilter] = useState<keyof typeof RECURRENCE_TYPE_FILTER_OPTIONS>("all");

	const showDisabledOnly =
		userToggle === true
			? disabledEvents.length > 0
			: userToggle === false
				? false
				: enabledEvents.length === 0 && disabledEvents.length > 0;

	const activePool = showDisabledOnly ? disabledEvents : enabledEvents;

	const recurringItems = useMemo(() => {
		let events = activePool;

		if (selectedTypeFilter === "custom") {
			events = events.filter((event) => !isPresetType(event.rrules.type));
		} else if (selectedTypeFilter !== "all") {
			events = events.filter((event) => event.rrules.type === selectedTypeFilter);
		}

		const settings = bundle.settingsStore.currentSettings;
		let items: RecurringEventListRow[] = events.map((event) => ({
			filePath: event.sourceFilePath,
			title: removeZettelId(event.title),
			recurrenceType: event.rrules.type,
			categories: getCategoriesFromFilePath(bundle.plugin.app, event.sourceFilePath, settings.categoryProp),
			instanceCount: bundle.recurringEventManager.getInstanceCountByRRuleId(event.rRuleId),
			rruleId: event.rRuleId,
		}));

		items = sortEventsModalItems(items, (i) => i.instanceCount, sortMode);
		return filterEventsModalItemsByQuery(items, searchQuery);
	}, [activePool, bundle, selectedTypeFilter, sortMode, searchQuery]);

	const handleToggleSkip = useCallback(
		async (item: RecurringEventListRow) => {
			try {
				const command = toggleSkip(bundle, item.filePath);
				await bundle.commandManager.executeCommand(command);
				new Notice(showDisabledOnly ? "Recurring event enabled" : "Recurring event disabled");
				onRecurringPoolsChanged?.();
			} catch (error) {
				console.error("[EventsModal] Failed to toggle recurring event:", error);
				new Notice("Failed to toggle recurring event");
			}
		},
		[bundle, showDisabledOnly, onRecurringPoolsChanged]
	);

	const handleCategoryAssign = useCallback(
		(item: RecurringEventListRow) => {
			const settings = bundle.settingsStore.currentSettings;
			if (!settings.categoryProp) {
				new Notice("Category property not configured");
				return;
			}
			const currentCategories = getCategoriesFromFilePath(bundle.plugin.app, item.filePath, settings.categoryProp);
			const categoriesWithColors = bundle.categoryTracker.getCategoriesWithColors();

			void openCategoryAssignModal(
				bundle.plugin.app,
				categoriesWithColors,
				settings.defaultNodeColor,
				currentCategories
			).then(async (selectedCategories) => {
				if (!selectedCategories) return;
				try {
					const command = assignCategories(bundle, item.filePath, selectedCategories);
					await bundle.commandManager.executeCommand(command);
					new Notice("Categories updated");
				} catch {
					new Notice("Failed to assign categories");
				}
			});
		},
		[bundle]
	);

	const handleNavigate = useCallback(
		(item: RecurringEventListRow) => {
			const event = activePool.find((e) => e.sourceFilePath === item.filePath);
			if (!event) {
				new Notice(`Recurring event not found: ${item.title}`);
				return;
			}
			const startDateTime = getStartDateTime(event.rrules);
			const eventDate = new Date(startDateTime.toJSDate());
			calendarComponent.navigateToDate(eventDate, "timeGridWeek");
			window.setTimeout(() => {
				calendarComponent.highlightEventByPath(event.sourceFilePath, 5000);
			}, 300);
			new Notice(`Navigated to source event: ${item.title}`);
			onClose();
		},
		[activePool, calendarComponent, onClose]
	);

	const handleRecurringItemClick = useCallback(
		(item: RecurringEventListRow) => {
			const event = activePool.find((e) => e.sourceFilePath === item.filePath);
			if (!event) {
				new Notice(`Recurring event not found: ${item.title}`);
				return;
			}
			const settings = bundle.settingsStore.currentSettings;
			const nameKey =
				getEventName(
					settings.titleProp,
					event.frontmatter,
					event.sourceFilePath,
					settings.calendarTitleProp
				)?.toLowerCase() ?? null;
			const categoryValues = event.metadata.categories ?? [];
			openEventSeriesModal(
				bundle.plugin.app,
				bundle,
				nameKey,
				event.rRuleId,
				categoryValues.length > 0 ? categoryValues : null
			);
		},
		[activePool, bundle]
	);

	const getCategoryColor = useCallback(
		(categories: string[]): string | null => {
			if (categories.length === 0) return null;
			const info = bundle.categoryTracker.getCategoriesWithColors().find((c) => c.name === categories[0]);
			return info?.color ?? null;
		},
		[bundle]
	);

	const totalCount = activePool.length;
	const countText =
		recurringItems.length === totalCount
			? `${totalCount} event${totalCount === 1 ? "" : "s"}`
			: `${recurringItems.length} of ${totalCount} event${totalCount === 1 ? "" : "s"}`;

	return (
		<>
			<div className="prisma-recurring-events-modal-filters">
				<div className="prisma-recurring-events-type-filter">
					<label className="prisma-recurring-events-filter-label">Type:</label>
					<select
						className="prisma-recurring-events-type-select"
						data-testid="prisma-recurring-type-filter"
						value={selectedTypeFilter}
						onChange={(e) => setSelectedTypeFilter(e.target.value as keyof typeof RECURRENCE_TYPE_FILTER_OPTIONS)}
					>
						{Object.entries(RECURRENCE_TYPE_FILTER_OPTIONS).map(([value, label]) => (
							<option key={value} value={value}>
								{label}
							</option>
						))}
					</select>
				</div>
				{disabledEvents.length > 0 && (
					<div className="prisma-recurring-events-toggle">
						<label className="prisma-recurring-events-checkbox-label">
							<input
								type="checkbox"
								data-testid="prisma-recurring-show-disabled"
								checked={showDisabledOnly}
								onChange={(e) => setUserToggle(e.target.checked)}
							/>
							<span>Show disabled only</span>
						</label>
					</div>
				)}
			</div>

			<p className="prisma-generic-event-list-count">{countText}</p>

			<div className="prisma-generic-event-list">
				{recurringItems.length === 0 ? (
					<p className="prisma-generic-event-list-empty">
						{showDisabledOnly ? "No disabled recurring events." : "No recurring events found."}
					</p>
				) : (
					recurringItems.map((item) => {
						const categoryColor = getCategoryColor(item.categories);
						const badgeClassSuffix = isPresetType(item.recurrenceType) ? item.recurrenceType : "custom";

						return (
							<div
								key={item.rruleId}
								className={`prisma-generic-event-list-item${categoryColor ? " prisma-recurring-event-categorized" : ""}`}
								data-testid={`prisma-recurring-row-${item.title}`}
								data-recurring-type={item.recurrenceType}
								data-event-file-path={item.filePath}
								style={categoryColor ? ({ "--category-color": categoryColor } as CSSProperties) : undefined}
								onClick={(e) => {
									if (e.target instanceof HTMLButtonElement) return;
									if (e.ctrlKey || e.metaKey) {
										void openFileInNewTab(bundle.plugin.app, item.filePath);
									} else {
										handleRecurringItemClick(item);
									}
								}}
							>
								<div className="prisma-generic-event-info">
									<div className="prisma-recurring-event-title-row">
										<div className="prisma-generic-event-title">{item.title}</div>
										<span
											className={`prisma-recurring-type-badge prisma-recurring-type-${badgeClassSuffix}`}
											data-testid="prisma-recurring-type-badge"
										>
											{formatRecurrenceLabel(item.recurrenceType)}
										</span>
									</div>
									<div className="prisma-generic-event-subtitle">
										{item.instanceCount} instance
										{item.instanceCount === 1 ? "" : "s"}
									</div>
								</div>
								<div className="prisma-generic-event-actions">
									<button
										data-testid="prisma-recurring-row-category"
										onClick={(e) => {
											e.stopPropagation();
											handleCategoryAssign(item);
										}}
									>
										Category
									</button>
									<button
										data-testid="prisma-recurring-row-nav"
										onClick={(e) => {
											e.stopPropagation();
											handleNavigate(item);
										}}
									>
										Nav
									</button>
									<button
										className="mod-cta"
										data-testid="prisma-recurring-row-toggle"
										onClick={(e) => {
											e.stopPropagation();
											void handleToggleSkip(item);
										}}
									>
										{showDisabledOnly ? "Enable" : "Disable"}
									</button>
								</div>
							</div>
						);
					})
				)}
			</div>
		</>
	);
}
