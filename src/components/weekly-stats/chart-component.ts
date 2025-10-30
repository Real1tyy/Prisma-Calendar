import Chart from "chart.js/auto";
import { generateColors } from "../../utils/colors";
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
		const chartSection = parentEl.createDiv("prisma-stats-chart-section");

		const chartHeader = chartSection.createDiv("prisma-stats-chart-header");
		chartHeader.createEl("h3", { text: "Distribution" });

		const toggleButton = chartHeader.createEl("button", {
			text: "Hide Chart",
			cls: "prisma-stats-toggle-chart-btn",
		});

		const chartContainer = chartSection.createDiv("prisma-stats-chart-container");
		const canvas = chartContainer.createEl("canvas");
		canvas.setAttribute("id", "prisma-stats-chart");

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
				plugins: {
					legend: {
						position: "right",
						align: "start",
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
										return {
											text: `${label} (${percentage}%)`,
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
