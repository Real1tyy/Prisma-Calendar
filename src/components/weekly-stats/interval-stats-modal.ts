import { cls } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { CalendarEvent } from "../../types/calendar";
import { calculateCapacityFromEvents, formatBoundaryRange, formatCapacityLabel } from "../../utils/capacity";
import type { AggregationMode, Stats } from "../../utils/weekly-stats";
import { formatDuration, formatDurationAsDecimalHours } from "../../utils/weekly-stats";
import { StatsModal } from "./base-stats-modal";
import { ChartComponent } from "./chart-component";
import { TableComponent } from "./table-component";

export interface IntervalConfig {
	getBounds(date: Date): { start: Date; end: Date };
	navigateNext(date: Date): void;
	navigatePrevious(date: Date): void;
	navigateFastNext(date: Date): void;
	navigateFastPrevious(date: Date): void;
	aggregateStats(events: CalendarEvent[], date: Date, mode: AggregationMode, categoryProp: string): Stats;
	formatDateRange(start: Date, end: Date, locale?: string): string;
}

type StepFn = (date: Date, direction: 1 | -1) => void;

type NavigationConfig = Pick<
	IntervalConfig,
	"navigateNext" | "navigatePrevious" | "navigateFastNext" | "navigateFastPrevious"
>;

export function createNavigationConfig(step: StepFn, fastStep: StepFn): NavigationConfig {
	return {
		navigateNext: (date) => step(date, 1),
		navigatePrevious: (date) => step(date, -1),
		navigateFastNext: (date) => fastStep(date, 1),
		navigateFastPrevious: (date) => fastStep(date, -1),
	};
}

export abstract class IntervalStatsModal extends StatsModal {
	protected currentDate: Date;
	protected abstract intervalConfig: IntervalConfig;

	constructor(app: App, bundle: CalendarBundle, initialDate?: Date) {
		super(app, bundle);
		this.currentDate = initialDate || new Date();
	}

	protected setupKeyboardShortcuts(): void {
		this.scope.register([], "ArrowLeft", async () => {
			await this.navigatePrevious();
			return false;
		});

		this.scope.register([], "ArrowRight", async () => {
			await this.navigateNext();
			return false;
		});

		this.scope.register(["Shift"], "ArrowLeft", async () => {
			await this.navigateFastPrevious();
			return false;
		});

		this.scope.register(["Shift"], "ArrowRight", async () => {
			await this.navigateFastNext();
			return false;
		});
	}

	protected async navigatePrevious(): Promise<void> {
		this.intervalConfig.navigatePrevious(this.currentDate);
		this.destroyComponents();
		await this.renderContent();
	}

	protected async navigateNext(): Promise<void> {
		this.intervalConfig.navigateNext(this.currentDate);
		this.destroyComponents();
		await this.renderContent();
	}

	protected async navigateFastPrevious(): Promise<void> {
		this.intervalConfig.navigateFastPrevious(this.currentDate);
		this.destroyComponents();
		await this.renderContent();
	}

	protected async navigateFastNext(): Promise<void> {
		this.intervalConfig.navigateFastNext(this.currentDate);
		this.destroyComponents();
		await this.renderContent();
	}

	protected async navigateToToday(): Promise<void> {
		this.currentDate = new Date();
		this.destroyComponents();
		await this.renderContent();
	}

	protected async renderContent(): Promise<void> {
		this.contentContainer.empty();

		const { start, end } = this.intervalConfig.getBounds(this.currentDate);

		const query = { start: start.toISOString(), end: end.toISOString() };
		const events = await this.bundle.eventStore.getEvents(query);

		let filteredEvents: CalendarEvent[];
		if (this.includeSkippedEvents) {
			const skipped = this.bundle.eventStore.getSkippedEvents(query);
			filteredEvents = [...events, ...skipped];
		} else {
			filteredEvents = events;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const categoryProp = settings.categoryProp || "Category";
		const stats = this.intervalConfig.aggregateStats(
			filteredEvents,
			this.currentDate,
			this.aggregationMode,
			categoryProp
		);

		this.renderHeader(this.contentContainer, start, end, stats);

		if (stats.entries.length === 0) {
			this.contentContainer.createDiv({
				text: "No events found for this period.",
				cls: cls("stats-empty"),
			});
			return Promise.resolve();
		}

		if (settings.capacityTrackingEnabled) {
			const capacity = calculateCapacityFromEvents(filteredEvents, start, end, settings.hourStart, settings.hourEnd);
			const fmt = this.showDecimalHours ? formatDurationAsDecimalHours : formatDuration;
			const label = formatCapacityLabel(capacity, this.showDecimalHours);
			const capacityEl = this.contentContainer.createDiv(cls("capacity-label"));
			capacityEl.createSpan({ text: `⏱ ${label} (${capacity.percentUsed.toFixed(0)}%)`, cls: cls("capacity-used") });
			capacityEl.createSpan({ text: "·" });
			capacityEl.createSpan({ text: `${fmt(capacity.remainingMs)} remaining`, cls: cls("capacity-remaining") });
			capacityEl.createSpan({ text: "·" });
			capacityEl.createSpan({ text: formatBoundaryRange(capacity), cls: cls("capacity-bounds") });
		}

		this.chartComponent = new ChartComponent(this.contentContainer, stats.entries);
		this.tableComponent = new TableComponent(
			this.contentContainer,
			stats.entries,
			stats.totalDuration,
			this.showDecimalHours
		);

		return Promise.resolve();
	}

	private renderHeader(contentEl: HTMLElement, start: Date, end: Date, stats: Stats): void {
		const header = contentEl.createDiv(cls("stats-header"));

		const leftNavGroup = header.createDiv(cls("stats-nav-group"));

		const fastPrevButton = leftNavGroup.createEl("button", {
			text: "«",
			cls: cls("stats-nav-button", "stats-nav-button-fast"),
		});
		fastPrevButton.ariaLabel = "Fast previous";
		fastPrevButton.addEventListener("click", () => {
			void this.navigateFastPrevious();
		});

		const prevButton = leftNavGroup.createEl("button", {
			text: "‹",
			cls: cls("stats-nav-button"),
		});
		prevButton.ariaLabel = "Previous";
		prevButton.addEventListener("click", () => {
			void this.navigatePrevious();
		});

		const durationStat = header.createEl("button", {
			cls: cls("stats-header-stat", "stats-duration-toggle"),
		});
		durationStat.setText(
			`⏱ ${this.showDecimalHours ? formatDurationAsDecimalHours(stats.totalDuration) : formatDuration(stats.totalDuration)}`
		);
		durationStat.addEventListener("click", () => {
			this.toggleDecimalHours();
		});

		const middleSection = header.createDiv(cls("stats-middle-section"));

		const periodLabel = middleSection.createDiv(cls("stats-week-label"));
		periodLabel.setText(
			this.intervalConfig.formatDateRange(start, end, this.bundle.settingsStore.currentSettings.locale)
		);

		const controlsRow = middleSection.createDiv(cls("stats-controls-row"));

		const skipCheckboxContainer = controlsRow.createDiv(cls("stats-skip-checkbox-container"));
		this.createSkipCheckbox(skipCheckboxContainer);

		const todayButton = controlsRow.createEl("button", {
			text: "Today",
			cls: cls("stats-today-button"),
		});
		todayButton.addEventListener("click", () => {
			void this.navigateToToday();
		});

		const aggregationToggle = controlsRow.createDiv(cls("stats-aggregation-toggle"));
		this.createAggregationToggle(aggregationToggle);

		const eventsStat = header.createDiv(cls("stats-header-stat"));
		eventsStat.setText(`📅 ${stats.entries.reduce((sum, e) => sum + e.count, 0)} events`);

		const rightNavGroup = header.createDiv(cls("stats-nav-group"));

		const nextButton = rightNavGroup.createEl("button", {
			text: "›",
			cls: cls("stats-nav-button"),
		});
		nextButton.ariaLabel = "Next";
		nextButton.addEventListener("click", () => {
			void this.navigateNext();
		});

		const fastNextButton = rightNavGroup.createEl("button", {
			text: "»",
			cls: cls("stats-nav-button", "stats-nav-button-fast"),
		});
		fastNextButton.ariaLabel = "Fast next";
		fastNextButton.addEventListener("click", () => {
			void this.navigateFastNext();
		});
	}
}
