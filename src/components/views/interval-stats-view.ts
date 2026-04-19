import { cls, toLocalISOString } from "@real1ty-obsidian-plugins";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import { calculateCapacityFromEvents, formatBoundaryRange, formatCapacityLabel } from "../../utils/capacity";
import type { AggregationMode, Stats } from "../../utils/weekly-stats";
import { formatDuration, formatDurationAsDecimalHours } from "../../utils/weekly-stats";
import { ChartComponent } from "../weekly-stats/chart-component";
import { TableComponent } from "../weekly-stats/table-component";

export interface IntervalStatsViewConfig {
	getBounds: (date: Date) => { start: Date; end: Date };
	aggregateStats: (events: CalendarEvent[], date: Date, mode: AggregationMode, categoryProp: string) => Stats;
	formatDate: (date: Date, locale: string | undefined) => string;
	emptyMessage: string;
	includeCapacity?: boolean;
}

export interface IntervalStatsViewHandle {
	destroy: () => void;
	setDate: (date: Date) => void;
}

interface StatsBodyInput {
	stats: Stats;
	filteredEvents: CalendarEvent[];
	start: Date;
	end: Date;
	showDecimalHours: boolean;
	aggregationMode: AggregationMode;
	includeCapacity: boolean;
	emptyMessage: string;
}

interface StatsBodyHandles {
	chart: ChartComponent | null;
	table: TableComponent | null;
}

/**
 * Renders the stats body (capacity label + pie chart + table, or empty state)
 * into a pre-empty container. Shared between modal and view stats renderers.
 */
export function renderIntervalStatsBody(
	container: HTMLElement,
	bundle: CalendarBundle,
	input: StatsBodyInput
): StatsBodyHandles {
	const { stats, filteredEvents, start, end, showDecimalHours, aggregationMode, includeCapacity, emptyMessage } = input;
	const settings = bundle.settingsStore.currentSettings;

	if (includeCapacity && settings.capacityTrackingEnabled) {
		const capacity = calculateCapacityFromEvents(filteredEvents, start, end, settings.hourStart, settings.hourEnd);
		const fmt = showDecimalHours ? formatDurationAsDecimalHours : formatDuration;
		const label = formatCapacityLabel(capacity, showDecimalHours);
		const capacityEl = container.createDiv(cls("capacity-label"));
		capacityEl.createSpan({ text: `⏱ ${label} (${capacity.percentUsed.toFixed(0)}%)`, cls: cls("capacity-used") });
		capacityEl.createSpan({ text: "·" });
		capacityEl.createSpan({ text: `${fmt(capacity.remainingMs)} remaining`, cls: cls("capacity-remaining") });
		capacityEl.createSpan({ text: "·" });
		capacityEl.createSpan({ text: formatBoundaryRange(capacity), cls: cls("capacity-bounds") });
	}

	if (stats.entries.length === 0) {
		const emptyEl = container.createDiv({ text: emptyMessage, cls: cls("stats-empty") });
		emptyEl.setAttribute("data-testid", "prisma-stats-empty");
		return { chart: null, table: null };
	}

	const chartOptions = {
		showToggle: false,
		...(aggregationMode === "category" && {
			colorResolver: (label: string) => bundle.categoryTracker.getCategoryColor(label),
		}),
	};
	const chart = new ChartComponent(container, stats.entries, chartOptions);
	const table = new TableComponent(container, stats.entries, stats.totalDuration, showDecimalHours);
	return { chart, table };
}

/**
 * Renders an interval-based stats panel (header + capacity + pie chart + table)
 * into any container. Re-renders when setDate() is called (e.g., synced to an
 * adjacent calendar or heatmap). The interval (daily, monthly, …) is defined by
 * the config.
 */
export function renderIntervalStatsInto(
	container: HTMLElement,
	bundle: CalendarBundle,
	config: IntervalStatsViewConfig
): IntervalStatsViewHandle {
	let currentDate = new Date();
	let aggregationMode: AggregationMode = bundle.settingsStore.currentSettings.defaultAggregationMode;
	let showDecimalHours = bundle.settingsStore.currentSettings.showDecimalHours;
	let includeSkippedEvents = false;
	let chart: ChartComponent | null = null;
	let table: TableComponent | null = null;

	const headerBar = container.createDiv(cls("daily-stats-header-bar"));
	const headerLeft = headerBar.createDiv(cls("daily-stats-header-left"));
	const dateLabel = headerBar.createDiv(cls("stats-tab-date-label"));
	dateLabel.setAttribute("data-testid", "prisma-stats-date-label");
	const headerRight = headerBar.createDiv(cls("daily-stats-header-right"));

	const skipLabel = headerRight.createEl("label", { cls: cls("stats-skip-checkbox-label") });
	const skipCheckbox = skipLabel.createEl("input", {
		type: "checkbox",
		cls: cls("stats-skip-checkbox"),
		attr: { "data-testid": "prisma-stats-skip-checkbox" },
	});
	skipLabel.createSpan({ text: "Include skipped", cls: cls("stats-skip-checkbox-text") });
	skipCheckbox.addEventListener("change", () => {
		includeSkippedEvents = skipCheckbox.checked;
		void renderContent();
	});

	const aggregationToggle = headerRight.createDiv(cls("stats-aggregation-toggle"));
	aggregationToggle.createEl("span", { text: "Group by:", cls: cls("stats-mode-label") });
	const toggleButton = aggregationToggle.createEl("button", {
		text: aggregationMode === "name" ? "Event Name" : "Category",
		cls: cls("stats-mode-button-compact"),
		attr: { "data-testid": "prisma-stats-mode-button" },
	});
	toggleButton.addEventListener("click", () => {
		aggregationMode = aggregationMode === "name" ? "category" : "name";
		toggleButton.setText(aggregationMode === "name" ? "Event Name" : "Category");
		void renderContent();
	});

	const contentContainer = container.createDiv(cls("stats-content"));

	// Monotonic token bumped on every renderContent() call. A render whose
	// async getEvents resolves after a newer render has started must bail
	// before writing to the DOM — otherwise stale entries from the old
	// month/day can overwrite the newer render's result.
	let renderToken = 0;

	function destroyComponents(): void {
		chart?.destroy();
		chart = null;
		table?.destroy();
		table = null;
	}

	async function renderContent(): Promise<void> {
		const token = ++renderToken;
		destroyComponents();
		contentContainer.empty();

		const { start, end } = config.getBounds(currentDate);
		dateLabel.setText(config.formatDate(currentDate, bundle.settingsStore.currentSettings.locale));

		const query = { start: toLocalISOString(start), end: toLocalISOString(end) };
		const events = await bundle.eventStore.getEvents(query);
		if (token !== renderToken) return;
		const filteredEvents = includeSkippedEvents ? [...events, ...bundle.eventStore.getSkippedEvents(query)] : events;

		const categoryProp = bundle.settingsStore.currentSettings.categoryProp || "Category";
		const stats = config.aggregateStats(filteredEvents, currentDate, aggregationMode, categoryProp);

		headerLeft.empty();
		const durationStat = headerLeft.createEl("button", {
			cls: cls("stats-header-stat", "stats-duration-toggle"),
			attr: { "data-testid": "prisma-stats-total-duration" },
		});
		durationStat.setText(
			`⏱ ${showDecimalHours ? formatDurationAsDecimalHours(stats.totalDuration) : formatDuration(stats.totalDuration)}`
		);
		durationStat.addEventListener("click", () => {
			showDecimalHours = !showDecimalHours;
			void renderContent();
		});

		const eventCount = stats.entries.reduce((sum, e) => sum + e.count, 0);
		const countEl = headerLeft.createDiv({ cls: cls("stats-header-stat") });
		countEl.setAttribute("data-testid", "prisma-stats-total-count");
		countEl.setText(`📅 ${eventCount} events`);

		const body = renderIntervalStatsBody(contentContainer, bundle, {
			stats,
			filteredEvents,
			start,
			end,
			showDecimalHours,
			aggregationMode,
			includeCapacity: config.includeCapacity ?? false,
			emptyMessage: config.emptyMessage,
		});
		chart = body.chart;
		table = body.table;
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
