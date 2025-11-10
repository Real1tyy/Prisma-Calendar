import type { App } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type { ParsedEvent } from "../../core/parser";
import type { AggregationMode, Stats } from "../../utils/weekly-stats";
import { formatDuration } from "../../utils/weekly-stats";
import { StatsModal } from "./base-stats-modal";
import { ChartComponent } from "./chart-component";
import { TableComponent } from "./table-component";

export interface IntervalConfig {
	getBounds(date: Date): { start: Date; end: Date };
	navigateNext(date: Date): void;
	navigatePrevious(date: Date): void;
	aggregateStats(events: ParsedEvent[], date: Date, mode: AggregationMode, categoryProp: string): Stats;
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

	protected async renderContent(): Promise<void> {
		const { contentEl } = this;

		if (this.contentContainer) {
			this.contentContainer.remove();
		}

		this.contentContainer = contentEl.createDiv("prisma-stats-content");

		const { start, end } = this.intervalConfig.getBounds(this.currentDate);

		const events = await this.bundle.eventStore.getEvents({
			start: start.toISOString(),
			end: end.toISOString(),
		});

		const categoryProp = this.bundle.settingsStore.currentSettings.categoryProp || "Category";
		const stats = this.intervalConfig.aggregateStats(events, this.currentDate, this.aggregationMode, categoryProp);

		this.renderHeader(this.contentContainer, start, end, stats);

		if (stats.entries.length === 0) {
			this.contentContainer.createDiv({
				text: "No events found for this period.",
				cls: "prisma-stats-empty",
			});
			return;
		}

		this.chartComponent = new ChartComponent(this.contentContainer, stats.entries, stats.totalDuration);
		this.tableComponent = new TableComponent(this.contentContainer, stats.entries, stats.totalDuration);
	}

	private renderHeader(contentEl: HTMLElement, start: Date, end: Date, stats: Stats): void {
		const header = contentEl.createDiv("prisma-stats-header");

		const prevButton = header.createEl("button", {
			text: "← Previous",
			cls: "prisma-stats-nav-button",
		});
		prevButton.addEventListener("click", async () => {
			await this.navigatePrevious();
		});

		const durationStat = header.createDiv("prisma-stats-header-stat");
		durationStat.setText(`⏱ ${formatDuration(stats.totalDuration)}`);

		const middleSection = header.createDiv("prisma-stats-middle-section");

		const periodLabel = middleSection.createDiv("prisma-stats-week-label");
		periodLabel.setText(this.intervalConfig.formatDateRange(start, end));

		const todayButton = middleSection.createEl("button", {
			text: "Today",
			cls: "prisma-stats-today-button",
		});
		todayButton.addEventListener("click", async () => {
			await this.navigateToToday();
		});

		const eventsStat = header.createDiv("prisma-stats-header-stat");
		eventsStat.setText(`📅 ${stats.entries.reduce((sum, e) => sum + e.count, 0)} events`);

		const nextButton = header.createEl("button", {
			text: "Next →",
			cls: "prisma-stats-nav-button",
		});
		nextButton.addEventListener("click", async () => {
			await this.navigateNext();
		});
	}
}
