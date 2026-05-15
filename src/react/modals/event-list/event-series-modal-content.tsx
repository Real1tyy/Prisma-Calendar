import { showReactModal, useColorEvaluator } from "@real1ty-obsidian-plugins-react";
import { DateTime } from "luxon";
import type { App } from "obsidian";
import type { CSSProperties, ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CalendarEvent } from "../../../types/calendar";
import type { SingleCalendarConfig } from "../../../types/settings";
import { resolveAllEventColors } from "../../../utils/events/color";
import { removeZettelId } from "../../../utils/events/zettel-id";
import { formatRecurrenceLabel, isWeekdaySupported } from "../../../utils/dates/recurring";
import {
	createCategorySeriesBasesActions,
	createNameSeriesBasesActions,
	createRecurringSeriesBasesActions,
} from "./event-series-bases-actions";
import { EventSeriesBasesFooter } from "./event-series-bases-footer";
import { EventSeriesInstancesList } from "./event-series-instances-list";
import type { EventRowItem, SourceTab, TabConfig } from "./event-series-types";

function EventSeriesModalContent({
	bundle,
	nameKey,
	rruleId,
	categoryValues,
	preferredTab,
	onClose,
}: {
	bundle: CalendarBundle;
	nameKey: string | null;
	rruleId: string | null;
	categoryValues: string[] | null;
	preferredTab?: "name" | "category" | "recurring" | null | undefined;
	onClose: () => void;
}) {
	const colorEvaluator = useColorEvaluator<SingleCalendarConfig>(bundle.settingsStore.settings$);
	const [searchQuery, setSearchQuery] = useState("");

	const tabs = useMemo<TabConfig[]>(() => {
		const result: TabConfig[] = [];
		if (rruleId != null) result.push({ id: "recurring", label: "Recurring" });
		if (categoryValues != null && categoryValues.length > 0) result.push({ id: "category", label: "By Category" });
		if (nameKey != null) result.push({ id: "name", label: "By Name" });
		return result;
	}, [rruleId, categoryValues, nameKey]);

	const [activeTab, setActiveTab] = useState<SourceTab>(() => {
		if (preferredTab && tabs.some((t) => t.id === preferredTab)) return preferredTab;
		return tabs.length > 0 ? tabs[0].id : "recurring";
	});

	const [hidePastRecurring, setHidePastRecurring] = useState(true);
	const [hideSkippedRecurring, setHideSkippedRecurring] = useState(true);

	const [hidePastName, setHidePastName] = useState(false);
	const [hideSkippedName, setHideSkippedName] = useState(false);

	const [hidePastCategory, setHidePastCategory] = useState(false);
	const [hideSkippedCategory, setHideSkippedCategory] = useState(false);
	const [selectedCategoryValue, setSelectedCategoryValue] = useState<string | null>(() =>
		categoryValues && categoryValues.length === 1 ? categoryValues[0] : null
	);

	const getEventColors = useCallback(
		(event: CalendarEvent): string[] => resolveAllEventColors(event.meta, bundle, colorEvaluator),
		[bundle, colorEvaluator]
	);

	const mapToEventRows = useCallback(
		(events: CalendarEvent[], withColors: boolean): EventRowItem[] =>
			events.map((event) => {
				const allColors = withColors ? getEventColors(event) : [];
				return {
					date: DateTime.fromISO(event.start),
					title: removeZettelId(event.title),
					filePath: event.ref.filePath,
					skipped: !!event.skipped,
					color: allColors[0],
					allColors: allColors.length >= 2 ? allColors : undefined,
				};
			}),
		[getEventColors]
	);

	const basesFooterActions = useMemo(() => {
		if (activeTab === "recurring" && rruleId) {
			return createRecurringSeriesBasesActions(bundle, rruleId);
		}
		if (activeTab === "name" && nameKey) {
			return createNameSeriesBasesActions(bundle, nameKey);
		}
		if (activeTab === "category") {
			const cv = selectedCategoryValue ?? (categoryValues?.length === 1 ? categoryValues[0] : null);
			if (!cv) return null;
			return createCategorySeriesBasesActions(bundle, cv);
		}
		return null;
	}, [activeTab, rruleId, nameKey, categoryValues, selectedCategoryValue, bundle]);

	const categoryColor = useMemo(() => {
		if (activeTab === "recurring" && rruleId) {
			const series = bundle.recurringEventManager.getRecurringEventSeries(rruleId);
			return series?.sourceCategory ?? null;
		}
		if (activeTab === "category") {
			const cv = selectedCategoryValue ?? (categoryValues?.length === 1 ? categoryValues[0] : null);
			return cv ? bundle.categoryTracker.getCategoryColor(cv) : null;
		}
		return null;
	}, [activeTab, rruleId, selectedCategoryValue, categoryValues, bundle]);

	const modalStyle: CSSProperties | undefined = categoryColor
		? ({ "--source-category-color": categoryColor } as CSSProperties)
		: undefined;

	let content: ReactNode;

	if (activeTab === "recurring" && rruleId) {
		const series = bundle.recurringEventManager.getRecurringEventSeries(rruleId);
		if (!series) {
			content = <p className="prisma-recurring-events-list-empty">Recurring event series not found</p>;
		} else {
			const items = mapToEventRows(
				series.instances.filter((i) => i.event.ref.filePath !== series.sourceFilePath).map((i) => i.event),
				false
			);

			const extraInfo = series.rruleType ? (
				<div className="prisma-recurring-events-info">
					<p className="prisma-recurring-events-info-text">
						Recurrence: {formatRecurrenceLabel(series.rruleType)}
						{series.rruleSpec && isWeekdaySupported(series.rruleType)
							? ` • Days: ${series.rruleSpec
									.split(",")
									.map((d) => d.trim())
									.map((d) => d.charAt(0).toUpperCase() + d.slice(1))
									.join(", ")}`
							: ""}
					</p>
				</div>
			) : undefined;

			content = (
				<EventSeriesInstancesList
					items={items}
					options={{
						title: removeZettelId(series.sourceTitle),
						onTitleClick: () => {
							void bundle.plugin.app.workspace.openLinkText(series.sourceFilePath, "", false);
							onClose();
						},
						hidePast: hidePastRecurring,
						hideSkipped: hideSkippedRecurring,
						onHidePastChange: setHidePastRecurring,
						onHideSkippedChange: setHideSkippedRecurring,
						extraInfo,
					}}
					searchQuery={searchQuery}
					onSearchChange={setSearchQuery}
					bundle={bundle}
				/>
			);
		}
	} else if (activeTab === "category") {
		if (categoryValues && categoryValues.length > 1 && selectedCategoryValue == null) {
			content = (
				<>
					<h3>Select a category</h3>
					<div className="prisma-generic-event-list">
						{categoryValues.map((cv) => {
							const events = bundle.categoryTracker.getEventsWithCategory(cv);
							return (
								<div key={cv} className="prisma-generic-event-list-item" onClick={() => setSelectedCategoryValue(cv)}>
									<div className="prisma-generic-event-info">
										<div className="prisma-generic-event-title">{cv}</div>
										<div className="prisma-generic-event-subtitle">
											{events.length} event{events.length === 1 ? "" : "s"}
										</div>
									</div>
								</div>
							);
						})}
					</div>
				</>
			);
		} else {
			const cv = selectedCategoryValue ?? categoryValues?.[0];
			if (cv) {
				const events = bundle.categoryTracker.getEventsWithCategory(cv);
				const items = mapToEventRows(events, false);
				content = (
					<>
						{categoryValues && categoryValues.length > 1 && (
							<button className="prisma-event-series-back-btn" onClick={() => setSelectedCategoryValue(null)}>
								← Back to categories
							</button>
						)}
						<EventSeriesInstancesList
							items={items}
							options={{
								title: cv,
								hidePast: hidePastCategory,
								hideSkipped: hideSkippedCategory,
								onHidePastChange: setHidePastCategory,
								onHideSkippedChange: setHideSkippedCategory,
							}}
							searchQuery={searchQuery}
							onSearchChange={setSearchQuery}
							bundle={bundle}
						/>
					</>
				);
			}
		}
	} else if (activeTab === "name" && nameKey) {
		const nameEvents = bundle.nameSeriesTracker.getEventsInNameSeries(nameKey);
		const displayName = nameEvents.length > 0 ? removeZettelId(nameEvents[0].title) : nameKey;
		const items = mapToEventRows(nameEvents, true);
		content = (
			<EventSeriesInstancesList
				items={items}
				options={{
					title: displayName,
					hidePast: hidePastName,
					hideSkipped: hideSkippedName,
					onHidePastChange: setHidePastName,
					onHideSkippedChange: setHideSkippedName,
				}}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				bundle={bundle}
				showSearch={false}
			/>
		);
	}

	return (
		<div
			className={`prisma-recurring-events-list-modal${categoryColor ? " prisma-recurring-events-list-modal-categorized" : ""}`}
			style={modalStyle}
		>
			{tabs.length >= 2 && (
				<div className="prisma-event-series-tabs">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							className={`prisma-event-series-tab-btn${activeTab === tab.id ? " prisma-is-active" : ""}`}
							data-testid={`prisma-event-series-tab-${tab.id}`}
							onClick={() => {
								setActiveTab(tab.id);
								setSelectedCategoryValue(null);
							}}
						>
							{tab.label}
						</button>
					))}
				</div>
			)}

			{content}

			{basesFooterActions && <EventSeriesBasesFooter actions={basesFooterActions} />}
		</div>
	);
}

export function openEventSeriesModal(
	app: App,
	bundle: CalendarBundle,
	nameKey: string | null,
	rruleId: string | null,
	categoryValues: string[] | null = null,
	preferredTab?: "name" | "category" | "recurring" | null
): void {
	showReactModal({
		app,
		cls: "prisma-recurring-events-list-modal",
		render: (close) => (
			<EventSeriesModalContent
				bundle={bundle}
				nameKey={nameKey}
				rruleId={rruleId}
				categoryValues={categoryValues}
				preferredTab={preferredTab}
				onClose={close}
			/>
		),
	});
}
