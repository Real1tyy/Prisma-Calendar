import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CalendarBundle } from "../../core/calendar-bundle";
import { aggregateWeeklyStats, getWeekBounds } from "../../utils/weekly-stats";
import { ChartComponent } from "./chart-component";
import { TableComponent } from "./table-component";

export class WeeklyStatsModal extends Modal {
	private bundle: CalendarBundle;
	private currentWeekDate: Date;
	private chartComponent: ChartComponent | null = null;
	private tableComponent: TableComponent | null = null;

	constructor(app: App, bundle: CalendarBundle, initialDate?: Date) {
		super(app);
		this.bundle = bundle;
		this.currentWeekDate = initialDate || new Date();
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("prisma-weekly-stats-modal");

		await this.renderContent();
	}

	onClose(): void {
		this.destroyComponents();
		const { contentEl } = this;
		contentEl.empty();
	}

	private destroyComponents(): void {
		this.chartComponent?.destroy();
		this.chartComponent = null;
		this.tableComponent?.destroy();
		this.tableComponent = null;
	}

	private async renderContent(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		const { start: weekStart, end: weekEnd } = getWeekBounds(this.currentWeekDate);

		const weekEvents = await this.bundle.eventStore.getEvents({
			start: weekStart.toISOString(),
			end: weekEnd.toISOString(),
		});

		const stats = aggregateWeeklyStats(weekEvents, this.currentWeekDate);

		this.renderHeader(contentEl, weekStart, weekEnd);

		if (stats.entries.length === 0) {
			contentEl.createDiv({
				text: "No events found for this week.",
				cls: "prisma-stats-empty",
			});
			return;
		}

		this.chartComponent = new ChartComponent(contentEl, stats.entries, stats.totalDuration);
		this.tableComponent = new TableComponent(contentEl, stats.entries, stats.totalDuration);
	}

	private renderHeader(contentEl: HTMLElement, weekStart: Date, weekEnd: Date): void {
		const header = contentEl.createDiv("prisma-stats-header");

		const prevButton = header.createEl("button", {
			text: "← Previous Week",
			cls: "prisma-stats-nav-button",
		});
		prevButton.addEventListener("click", async () => {
			this.currentWeekDate.setDate(this.currentWeekDate.getDate() - 7);
			this.destroyComponents();
			await this.renderContent();
		});

		const middleSection = header.createDiv("prisma-stats-middle-section");

		const weekLabel = middleSection.createDiv("prisma-stats-week-label");
		weekLabel.setText(`${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`);

		const todayButton = middleSection.createEl("button", {
			text: "Today",
			cls: "prisma-stats-today-button",
		});
		todayButton.addEventListener("click", async () => {
			this.currentWeekDate = new Date();
			this.destroyComponents();
			await this.renderContent();
		});

		const nextButton = header.createEl("button", {
			text: "Next Week →",
			cls: "prisma-stats-nav-button",
		});
		nextButton.addEventListener("click", async () => {
			this.currentWeekDate.setDate(this.currentWeekDate.getDate() + 7);
			this.destroyComponents();
			await this.renderContent();
		});
	}

	private formatDate(date: Date): string {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}
}
