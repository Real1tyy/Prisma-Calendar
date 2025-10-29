import Chart from "chart.js/auto";
import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { aggregateWeeklyStats, formatDuration, formatPercentage, getWeekBounds } from "../utils/weekly-stats";

export class WeeklyStatsModal extends Modal {
	private bundle: CalendarBundle;
	private currentWeekDate: Date;
	private chart: Chart | null = null;

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
		this.destroyChart();
		const { contentEl } = this;
		contentEl.empty();
	}

	private destroyChart(): void {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}
	}

	private async renderContent(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();

		const { start: weekStart, end: weekEnd } = getWeekBounds(this.currentWeekDate);

		// Fetch events for the current week from the event store
		const weekEvents = await this.bundle.eventStore.getEvents({
			start: weekStart.toISOString(),
			end: weekEnd.toISOString(),
		});

		const stats = aggregateWeeklyStats(weekEvents, this.currentWeekDate);

		const header = contentEl.createDiv("prisma-stats-header");

		const prevButton = header.createEl("button", {
			text: "← Previous Week",
			cls: "prisma-stats-nav-button",
		});
		prevButton.addEventListener("click", async () => {
			this.currentWeekDate.setDate(this.currentWeekDate.getDate() - 7);
			this.destroyChart();
			await this.renderContent();
		});

		const weekLabel = header.createDiv("prisma-stats-week-label");
		weekLabel.setText(`${this.formatDate(weekStart)} - ${this.formatDate(weekEnd)}`);

		const nextButton = header.createEl("button", {
			text: "Next Week →",
			cls: "prisma-stats-nav-button",
		});
		nextButton.addEventListener("click", async () => {
			this.currentWeekDate.setDate(this.currentWeekDate.getDate() + 7);
			this.destroyChart();
			await this.renderContent();
		});

		// Summary
		const summary = contentEl.createDiv("prisma-stats-summary");
		summary.createEl("h3", { text: "Weekly Summary" });
		summary.createDiv({
			text: `Total Duration: ${formatDuration(stats.totalDuration)}`,
			cls: "prisma-stats-total",
		});
		summary.createDiv({
			text: `Total Events: ${stats.entries.reduce((sum, e) => sum + e.count, 0)}`,
			cls: "prisma-stats-count",
		});

		if (stats.entries.length === 0) {
			contentEl.createDiv({
				text: "No events found for this week.",
				cls: "prisma-stats-empty",
			});
			return;
		}

		// Chart container
		const chartContainer = contentEl.createDiv("prisma-stats-chart-container");
		const canvas = chartContainer.createEl("canvas");
		canvas.setAttribute("id", "prisma-stats-chart");

		// Create pie chart
		this.renderChart(canvas, stats.entries, stats.totalDuration);

		// Statistics table
		const tableContainer = contentEl.createDiv("prisma-stats-table-container");
		tableContainer.createEl("h3", { text: "Breakdown" });

		const table = tableContainer.createEl("table", { cls: "prisma-stats-table" });
		const thead = table.createEl("thead");
		const headerRow = thead.createEl("tr");
		headerRow.createEl("th", { text: "Event Name" });
		headerRow.createEl("th", { text: "Count" });
		headerRow.createEl("th", { text: "Duration" });
		headerRow.createEl("th", { text: "Percentage" });

		const tbody = table.createEl("tbody");
		for (const entry of stats.entries) {
			const row = tbody.createEl("tr");
			row.createEl("td", {
				text: entry.name,
				cls: entry.isRecurring ? "prisma-stats-recurring" : "",
			});
			row.createEl("td", { text: entry.count.toString() });
			row.createEl("td", { text: formatDuration(entry.duration) });
			row.createEl("td", {
				text: formatPercentage(entry.duration, stats.totalDuration),
			});
		}
	}

	private renderChart(
		canvas: HTMLCanvasElement,
		entries: Array<{
			name: string;
			duration: number;
			count: number;
			isRecurring: boolean;
		}>,
		totalDuration: number
	): void {
		const labels = entries.map((e) => e.name);
		const data = entries.map((e) => e.duration / (1000 * 60 * 60)); // Convert to hours
		const colors = this.generateColors(entries.length);

		this.chart = new Chart(canvas, {
			type: "pie",
			data: {
				labels,
				datasets: [
					{
						data,
						backgroundColor: colors,
						borderWidth: 2,
						borderColor: "#ffffff",
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: true,
				plugins: {
					legend: {
						position: "right",
						labels: {
							font: {
								size: 12,
							},
							padding: 10,
						},
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const label = context.label || "";
								const value = context.parsed;
								const percentage = ((value * 60 * 60 * 1000) / totalDuration) * 100;
								return `${label}: ${formatDuration(value * 60 * 60 * 1000)} (${percentage.toFixed(1)}%)`;
							},
						},
					},
				},
			},
		});
	}

	private generateColors(count: number): string[] {
		const baseColors = [
			"#f87171", // red-400
			"#60a5fa", // blue-400
			"#34d399", // emerald-400
			"#fbbf24", // amber-400
			"#a78bfa", // violet-400
			"#fb923c", // orange-400
			"#2dd4bf", // teal-400
			"#f472b6", // pink-400
			"#4ade80", // green-400
			"#818cf8", // indigo-400
		];

		const colors: string[] = [];
		for (let i = 0; i < count; i++) {
			colors.push(baseColors[i % baseColors.length]);
		}
		return colors;
	}

	private formatDate(date: Date): string {
		return date.toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
			year: "numeric",
		});
	}
}
