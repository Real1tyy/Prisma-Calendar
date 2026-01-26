import { cls, generateColors } from "@real1ty-obsidian-plugins";
import { type ChartDataItem, createChartCanvas, PieChartBuilder } from "../../utils/chart-utils";
import { formatDuration, type WeeklyStatEntry } from "../../utils/weekly-stats";

const MAX_LABELS = 25; // to prevent label overflow

export class ChartComponent {
	private chartBuilder: PieChartBuilder | null = null;
	private container: HTMLElement;
	private chartVisible = true;

	constructor(parentEl: HTMLElement, entries: WeeklyStatEntry[]) {
		this.container = this.createChartSection(parentEl);
		this.renderChart(entries);
	}

	private isMobileView(): boolean {
		return window.innerWidth <= 768;
	}

	private createChartSection(parentEl: HTMLElement): HTMLElement {
		const chartSection = parentEl.createDiv(cls("stats-chart-section"));

		const chartHeader = chartSection.createDiv(cls("stats-chart-header"));
		chartHeader.createEl("h3", { text: "Distribution" });

		const toggleButton = chartHeader.createEl("button", {
			text: "Hide chart",
			cls: cls("stats-toggle-chart-btn"),
		});

		const chartContainer = chartSection.createDiv(cls("stats-chart-container"));
		createChartCanvas(chartContainer, "stats-chart");

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

		return chartSection;
	}

	private renderChart(entries: WeeklyStatEntry[]): void {
		const canvas = this.container.querySelector("canvas");
		if (!canvas) return;

		// `renderChart` may be called more than once if the stats view refreshes.
		// Ensure we don't leak a Chart.js instance bound to the same canvas.
		this.chartBuilder?.destroy();

		const limitedEntries = entries.slice(0, MAX_LABELS);
		const isMobile = this.isMobileView();
		const colors = generateColors(limitedEntries.length);

		const chartData: ChartDataItem[] = limitedEntries.map((entry, index) => ({
			label: entry.name,
			value: entry.duration,
			color: colors[index],
		}));

		this.chartBuilder = new PieChartBuilder(canvas as HTMLCanvasElement, chartData, {
			isMobile,
			tooltipFormatter: (label, value, percentage) => {
				return `${label}: ${formatDuration(value)} (${percentage}%)`;
			},
		});

		this.chartBuilder.render();
	}

	destroy(): void {
		if (this.chartBuilder) {
			this.chartBuilder.destroy();
			this.chartBuilder = null;
		}
	}
}
