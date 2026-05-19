import { ArcElement, Chart, Legend, PieController, Tooltip } from "chart.js";

// `chart.js/auto` would register every controller/scale/plugin (>200 KB
// minified). PieChartBuilder only renders pies with the default legend +
// tooltip, so we register the minimum set once at module load. Idempotent
// across multiple imports.
Chart.register(ArcElement, PieController, Tooltip, Legend);

export interface ChartDataItem {
	label: string;
	value: number;
	color: string;
}

export interface PieChartOptions {
	maxLabels?: number;
	isMobile?: boolean;
	legendPosition?: "right" | "bottom";
	legendAlign?: "start" | "center";
	labelMaxLength?: number;
	labelTruncateLength?: number;
	tooltipFormatter?: (label: string, value: number, percentage: string) => string;
	onVisibilityChange?: (label: string, visible: boolean) => void;
}

export class PieChartBuilder {
	private chart: Chart | null = null;

	constructor(
		private canvas: HTMLCanvasElement,
		private data: ChartDataItem[],
		private options: PieChartOptions = {}
	) {}

	render(): Chart {
		const {
			maxLabels,
			isMobile = false,
			legendPosition = isMobile ? "bottom" : "right",
			legendAlign = isMobile ? "center" : "start",
			labelMaxLength = isMobile ? 20 : 35,
			labelTruncateLength = isMobile ? 17 : 32,
			tooltipFormatter,
			onVisibilityChange,
		} = this.options;

		const limitedData = maxLabels ? this.data.slice(0, maxLabels) : this.data;
		const labels = limitedData.map((item) => item.label);
		const values = limitedData.map((item) => item.value);
		const colors = limitedData.map((item) => item.color);

		const visibleTotal = (chart: Chart): number =>
			values.reduce((sum, val, i) => (chart.getDataVisibility(i) ? sum + val : sum), 0);

		// Chart.js tracks chart instances per canvas. If this builder is recreated
		// (common in reactive UIs), we must destroy any existing chart bound to this
		// canvas before reusing it, otherwise Chart.js will throw:
		// "Canvas is already in use..."
		const existingChart = Chart.getChart(this.canvas);
		if (existingChart) {
			existingChart.destroy();
		}

		this.chart = new Chart(this.canvas, {
			type: "pie",
			data: {
				labels,
				datasets: [
					{
						data: values,
						backgroundColor: colors,
						borderWidth: 2,
						borderColor: "#ffffff",
					},
				],
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				layout: {
					padding: isMobile ? { left: 4, right: 4, top: 10, bottom: 10 } : { left: 20, right: 20 },
				},
				plugins: {
					legend: {
						position: legendPosition,
						align: legendAlign,
						maxWidth: isMobile ? undefined : 350,
						labels: {
							font: {
								size: isMobile ? 10 : 14,
							},
							padding: isMobile ? 6 : 8,
							color: "#ffffff",
							boxWidth: isMobile ? 10 : 12,
							boxHeight: isMobile ? 10 : 12,
							generateLabels: (chart) => {
								const total = visibleTotal(chart);
								return (
									chart.data.labels?.map((label, i) => {
										const visible = chart.getDataVisibility(i);
										const value = chart.data.datasets[0].data[i] as number;
										const percentage = visible && total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
										const labelText = `${String(label)} (${percentage}%)`;
										return {
											text:
												labelText.length > labelMaxLength
													? `${labelText.substring(0, labelTruncateLength)}...`
													: labelText,
											fillStyle: (chart.data.datasets[0].backgroundColor as string[])[i],
											fontColor: "#ffffff",
											hidden: !visible,
											index: i,
										};
									}) || []
								);
							},
						},
						onClick: (_event, legendItem, legend) => {
							const index = legendItem.index;
							if (index === undefined) return;
							const chart = legend.chart;
							chart.toggleDataVisibility(index);
							chart.update();
							if (onVisibilityChange) {
								const label = chart.data.labels?.[index];
								onVisibilityChange(String(label), chart.getDataVisibility(index));
							}
						},
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const value = context.parsed;
								const total = visibleTotal(context.chart);
								const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
								if (tooltipFormatter) {
									return tooltipFormatter(String(context.label), value, percentage);
								}
								return `${context.label}: ${value} (${percentage}%)`;
							},
						},
					},
				},
			},
		});

		return this.chart;
	}

	destroy(): void {
		const existingChart = this.chart ?? Chart.getChart(this.canvas);
		if (existingChart) {
			existingChart.destroy();
		}
		this.chart = null;
	}

	getChart(): Chart | null {
		return this.chart;
	}
}

export function createChartCanvas(container: HTMLElement, chartId?: string): HTMLCanvasElement {
	const canvas = container.createEl("canvas");
	if (chartId) {
		canvas.setAttribute("id", chartId);
	}
	return canvas;
}
