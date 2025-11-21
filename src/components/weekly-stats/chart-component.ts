import { cls, generateColors } from "@real1ty-obsidian-plugins/utils";
import Chart from "chart.js/auto";
import { formatDuration, type WeeklyStatEntry } from "../../utils/weekly-stats";

const MAX_LABELS = 25; // to prevent label overflow

export class ChartComponent {
	private chart: Chart | null = null;
	private container: HTMLElement;
	private chartVisible = true;

	constructor(parentEl: HTMLElement, entries: WeeklyStatEntry[], totalDuration: number) {
		this.container = this.createChartSection(parentEl);
		this.renderChart(entries, totalDuration);
	}

	private createChartSection(parentEl: HTMLElement): HTMLElement {
		const chartSection = parentEl.createDiv(cls("stats-chart-section"));

		const chartHeader = chartSection.createDiv(cls("stats-chart-header"));
		chartHeader.createEl("h3", { text: "Distribution" });

		const toggleButton = chartHeader.createEl("button", {
			text: "Hide Chart",
			cls: cls("stats-toggle-chart-btn"),
		});

		const chartContainer = chartSection.createDiv(cls("stats-chart-container"));
		const canvas = chartContainer.createEl("canvas");
		canvas.setAttribute("id", cls("stats-chart"));

		toggleButton.addEventListener("click", () => {
			this.chartVisible = !this.chartVisible;
			if (this.chartVisible) {
				chartContainer.style.display = "flex";
				toggleButton.setText("Hide Chart");
			} else {
				chartContainer.style.display = "none";
				toggleButton.setText("Show Chart");
			}
		});

		return chartSection;
	}

	private renderChart(entries: WeeklyStatEntry[], totalDuration: number): void {
		const canvas = this.container.querySelector("canvas");
		if (!canvas) return;

		const limitedEntries = entries.slice(0, MAX_LABELS);
		const labels = limitedEntries.map((e) => e.name);
		const data = limitedEntries.map((e) => e.duration);

		this.chart = new Chart(canvas, {
			type: "pie",
			data: {
				labels,
				datasets: [
					{
						data,
						backgroundColor: generateColors(limitedEntries.length),
						borderWidth: 2,
						borderColor: "#ffffff",
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: {
						left: 20,
						right: 20,
					},
				},
				plugins: {
					legend: {
						position: "right",
						align: "start",
						maxWidth: 350,
						labels: {
							font: {
								size: 14,
							},
							padding: 8,
							color: "#ffffff",
							boxWidth: 12,
							boxHeight: 12,
							generateLabels: (chart) => {
								const datasets = chart.data.datasets;
								return (
									chart.data.labels?.map((label, i) => {
										const value = datasets[0].data[i] as number;
										const percentage = ((value / totalDuration) * 100).toFixed(1);
										const labelText = `${label} (${percentage}%)`;
										return {
											text: labelText.length > 35 ? `${labelText.substring(0, 32)}...` : labelText,
											fillStyle: (datasets[0].backgroundColor as string[])[i],
											fontColor: "#ffffff",
											hidden: false,
											index: i,
										};
									}) || []
								);
							},
						},
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const value = context.parsed;
								const percentage = ((value / totalDuration) * 100).toFixed(1);
								return `${context.label}: ${formatDuration(value)} (${percentage}%)`;
							},
						},
					},
				},
			},
		});
	}

	destroy(): void {
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}
	}
}
