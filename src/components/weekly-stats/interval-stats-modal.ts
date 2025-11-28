import { cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { ParsedEvent } from "../../core/parser";
import type { AggregationMode, Stats } from "../../utils/weekly-stats";
import { formatDuration, formatDurationAsDecimalHours } from "../../utils/weekly-stats";
import { StatsModal } from "./base-stats-modal";
import { ChartComponent } from "./chart-component";
import { TableComponent } from "./table-component";

export interface IntervalConfig {
	getBounds(date: Date): { start: Date; end: Date };
	navigateNext(date: Date): void;
	navigatePrevious(date: Date): void;
	aggregateStats(
		events: ParsedEvent[],
		date: Date,
		mode: AggregationMode,
		categoryProp: string,
		breakProp?: string
	): Stats;
	formatDateRange(start: Date, end: Date): string;
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

	protected async navigateToToday(): Promise<void> {
		this.currentDate = new Date();
		this.destroyComponents();
		await this.renderContent();
	}

	protected renderContent(): Promise<void> {
		const { contentEl } = this;

		if (this.contentContainer) {
			this.contentContainer.remove();
		}

		this.contentContainer = contentEl.createDiv(cls("stats-content"));

		const { start, end } = this.intervalConfig.getBounds(this.currentDate);

		const events = this.bundle.eventStore.getEvents({
			start: start.toISOString(),
			end: end.toISOString(),
		});

		const filteredEvents = this.filterSkippedEvents(events);

		const settings = this.bundle.settingsStore.currentSettings;
		const categoryProp = settings.categoryProp || "Category";
		const breakProp = settings.breakProp || undefined;
		const stats = this.intervalConfig.aggregateStats(
			filteredEvents,
			this.currentDate,
			this.aggregationMode,
			categoryProp,
			breakProp
		);

		this.renderHeader(this.contentContainer, start, end, stats);

		if (stats.entries.length === 0) {
			this.contentContainer.createDiv({
				text: "No events found for this period.",
				cls: cls("stats-empty"),
			});
			return Promise.resolve();
		}

		this.chartComponent = new ChartComponent(this.contentContainer, stats.entries, stats.totalDuration);
		this.tableComponent = new TableComponent(this.contentContainer, stats.entries, stats.totalDuration);

		return Promise.resolve();
	}

	private renderHeader(contentEl: HTMLElement, start: Date, end: Date, stats: Stats): void {
		const header = contentEl.createDiv(cls("stats-header"));

		const prevButton = header.createEl("button", {
			text: "Previous",
			cls: cls("stats-nav-button"),
		});
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
			this.showDecimalHours = !this.showDecimalHours;
			this.destroyComponents();
			void this.renderContent();
		});

		const middleSection = header.createDiv(cls("stats-middle-section"));

		const periodLabel = middleSection.createDiv(cls("stats-week-label"));
		periodLabel.setText(this.intervalConfig.formatDateRange(start, end));

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

		const nextButton = header.createEl("button", {
			text: "Next",
			cls: cls("stats-nav-button"),
		});
		nextButton.addEventListener("click", () => {
			void this.navigateNext();
		});
	}
}
