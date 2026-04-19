import { type ChartDataItem, cls, generateColors, PieChartBuilder } from "@real1ty-obsidian-plugins";

import { createChartCanvas } from "../../utils/chart-utils";
import { formatDuration, type WeeklyStatEntry } from "../../utils/stats";

const MAX_LABELS = 25; // to prevent label overflow

export interface ChartComponentOptions {
	showToggle?: boolean;
	colorResolver?: (label: string) => string;
}

export class ChartComponent {
	private chartBuilder!: PieChartBuilder;
	private container: HTMLElement;
	private chartVisible = true;

	constructor(parentEl: HTMLElement, entries: WeeklyStatEntry[], options?: ChartComponentOptions) {
		this.container = this.createChartSection(parentEl, options?.showToggle ?? true);
		this.renderChart(entries, options?.colorResolver);
	}

	private isMobileView(): boolean {
		return window.innerWidth <= 768;
	}

	private createChartSection(parentEl: HTMLElement, showToggle: boolean): HTMLElement {
		const chartSection = parentEl.createDiv(cls("stats-chart-section"));

		const chartHeader = chartSection.createDiv(cls("stats-chart-header"));
		chartHeader.createEl("h3", { text: "Distribution" });

		const chartContainer = chartSection.createDiv(cls("stats-chart-container"));
		createChartCanvas(chartContainer, "stats-chart");

		if (showToggle) {
			const toggleButton = chartHeader.createEl("button", {
				text: "Hide chart",
				cls: cls("stats-toggle-chart-btn"),
			});

			toggleButton.addEventListener("click", () => {
				this.chartVisible = !this.chartVisible;
				if (this.chartVisible) {
					chartContainer.classList.remove("prisma-hidden");
					toggleButton.setText("Hide chart");
				} else {
					chartContainer.classList.add("prisma-hidden");
					toggleButton.setText("Show chart");
				}
			});
		}

		return chartSection;
	}

	private renderChart(entries: WeeklyStatEntry[], colorResolver?: (label: string) => string): void {
		const canvas = this.container.querySelector("canvas") as HTMLCanvasElement;

		const limitedEntries = entries.slice(0, MAX_LABELS);
		const isMobile = this.isMobileView();
		const fallbackColors = colorResolver ? [] : generateColors(limitedEntries.length);

		const chartData: ChartDataItem[] = limitedEntries.map((entry, index) => ({
			label: entry.name,
			value: entry.duration,
			color: colorResolver ? colorResolver(entry.name) : fallbackColors[index],
		}));

		this.chartBuilder = new PieChartBuilder(canvas, chartData, {
			isMobile,
			tooltipFormatter: (label, value, percentage) => {
				return `${label}: ${formatDuration(value)} (${percentage}%)`;
			},
		});

		this.chartBuilder.render();
	}

	destroy(): void {
		this.chartBuilder.destroy();
	}
}
