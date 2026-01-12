import { cls } from "@real1ty-obsidian-plugins/utils";
import Chart from "chart.js/auto";

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
		} = this.options;

		const limitedData = maxLabels ? this.data.slice(0, maxLabels) : this.data;
		const labels = limitedData.map((item) => item.label);
		const values = limitedData.map((item) => item.value);
		const colors = limitedData.map((item) => item.color);
		const totalValue = values.reduce((sum, val) => sum + val, 0);

		if (this.chart) {
			this.chart.destroy();
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
								return (
									chart.data.labels?.map((label, i) => {
										const value = chart.data.datasets[0].data[i] as number;
										const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0.0";
										const labelText = `${String(label)} (${percentage}%)`;
										return {
											text:
												labelText.length > labelMaxLength
													? `${labelText.substring(0, labelTruncateLength)}...`
													: labelText,
											fillStyle: (chart.data.datasets[0].backgroundColor as string[])[i],
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
								const percentage = totalValue > 0 ? ((value / totalValue) * 100).toFixed(1) : "0.0";
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
		if (this.chart) {
			this.chart.destroy();
			this.chart = null;
		}
	}

	getChart(): Chart | null {
		return this.chart;
	}
}

export function createChartCanvas(container: HTMLElement, chartId?: string): HTMLCanvasElement {
	const canvas = container.createEl("canvas");
	if (chartId) {
		canvas.setAttribute("id", cls(chartId));
	}
	return canvas;
}
