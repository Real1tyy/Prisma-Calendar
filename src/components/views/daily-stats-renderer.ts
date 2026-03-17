import { cls } from "@real1ty-obsidian-plugins";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import type { AggregationMode } from "../../utils/weekly-stats";
import {
	aggregateDailyStats,
	formatDuration,
	formatDurationAsDecimalHours,
	getDayBounds,
} from "../../utils/weekly-stats";
import { ChartComponent } from "../weekly-stats/chart-component";
import { TableComponent } from "../weekly-stats/table-component";

export interface DailyStatsHandle {
	destroy: () => void;
	setDate: (date: Date) => void;
}

/**
 * Renders daily statistics (pie chart + table) into any container element.
 * The stats update when setDate() is called (e.g., synced to an adjacent calendar).
 */
export function renderDailyStatsInto(container: HTMLElement, bundle: CalendarBundle): DailyStatsHandle {
	let currentDate = new Date();
	let aggregationMode: AggregationMode = bundle.settingsStore.currentSettings.defaultAggregationMode;
	let showDecimalHours = bundle.settingsStore.currentSettings.showDecimalHours;
	let includeSkippedEvents = false;
	let chartComponent: ChartComponent | null = null;
	let tableComponent: TableComponent | null = null;

	const controlsRow = container.createDiv(cls("stats-controls-row"));

	const skipCheckboxContainer = controlsRow.createDiv(cls("stats-skip-checkbox-container"));
	const skipLabel = skipCheckboxContainer.createEl("label", { cls: cls("stats-skip-checkbox-label") });
	const skipCheckbox = skipLabel.createEl("input", { type: "checkbox", cls: cls("stats-skip-checkbox") });
	skipLabel.createSpan({ text: "Include skipped events", cls: cls("stats-skip-checkbox-text") });
	skipCheckbox.addEventListener("change", () => {
		includeSkippedEvents = skipCheckbox.checked;
		void renderContent();
	});

	const aggregationToggle = controlsRow.createDiv(cls("stats-aggregation-toggle"));
	aggregationToggle.createEl("span", { text: "Group by:", cls: cls("stats-mode-label") });
	const toggleButton = aggregationToggle.createEl("button", {
		text: aggregationMode === "name" ? "Event Name" : "Category",
		cls: cls("stats-mode-button-compact"),
	});
	toggleButton.addEventListener("click", () => {
		aggregationMode = aggregationMode === "name" ? "category" : "name";
		toggleButton.setText(aggregationMode === "name" ? "Event Name" : "Category");
		void renderContent();
	});

	const dateLabel = container.createDiv(cls("stats-tab-date-label"));
	const contentContainer = container.createDiv(cls("stats-content"));

	function destroyComponents(): void {
		chartComponent?.destroy();
		chartComponent = null;
		tableComponent?.destroy();
		tableComponent = null;
	}

	async function renderContent(): Promise<void> {
		destroyComponents();
		contentContainer.empty();

		const { start, end } = getDayBounds(currentDate);

		dateLabel.setText(
			currentDate.toLocaleDateString(bundle.settingsStore.currentSettings.locale, {
				weekday: "long",
				month: "short",
				day: "numeric",
				year: "numeric",
			})
		);

		const query = { start: start.toISOString(), end: end.toISOString() };
		const events = await bundle.eventStore.getEvents(query);

		let filteredEvents: CalendarEvent[];
		if (includeSkippedEvents) {
			const skipped = bundle.eventStore.getSkippedEvents(query);
			filteredEvents = [...events, ...skipped];
		} else {
			filteredEvents = events;
		}

		const categoryProp = bundle.settingsStore.currentSettings.categoryProp || "Category";
		const stats = aggregateDailyStats(filteredEvents, currentDate, aggregationMode, categoryProp);

		const durationStat = contentContainer.createEl("button", {
			cls: cls("stats-header-stat", "stats-duration-toggle"),
		});
		durationStat.setText(
			`⏱ ${showDecimalHours ? formatDurationAsDecimalHours(stats.totalDuration) : formatDuration(stats.totalDuration)}`
		);
		durationStat.addEventListener("click", () => {
			showDecimalHours = !showDecimalHours;
			void renderContent();
		});

		const eventsStat = contentContainer.createDiv(cls("stats-header-stat"));
		eventsStat.setText(`📅 ${stats.entries.reduce((sum, e) => sum + e.count, 0)} events`);

		if (stats.entries.length === 0) {
			contentContainer.createDiv({ text: "No events found for this day.", cls: cls("stats-empty") });
			return;
		}

		chartComponent = new ChartComponent(contentContainer, stats.entries);
		tableComponent = new TableComponent(contentContainer, stats.entries, stats.totalDuration, showDecimalHours);
	}

	void renderContent();

	return {
		destroy: () => {
			destroyComponents();
			container.empty();
		},
		setDate: (date: Date) => {
			currentDate = date;
			void renderContent();
		},
	};
}
