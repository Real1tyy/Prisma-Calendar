import type { Chart, ChartConfiguration } from "chart.js";

import { generateColors } from "../core/color-utils";
import { createCssUtils } from "../core/css-utils";
import { injectStyleSheet } from "../styles/inject";

// ─── Types ───

/**
 * Data input for pie chart. Either:
 * - `Map<string, number>` — auto-generates colors via the shared palette
 * - `{ labels, values, colors }` — explicit colors (e.g. from user-defined categories)
 */
export type PieChartData = Map<string, number> | { labels: string[]; values: number[]; colors: string[] };

export interface PieChartConfig {
	/** CSS prefix for all class names (e.g. "prisma-") */
	cssPrefix: string;
	/** Chart heading rendered as h3 above the chart. Omit or pass empty string to skip. */
	title?: string;
	/** The data to render */
	data: PieChartData;
	/** The Chart constructor from chart.js — injected so shared doesn't depend on chart.js at runtime */
	 
	ChartJS: new (canvas: HTMLCanvasElement, config: ChartConfiguration<"pie">) => Chart<"pie">;
	/** Max legend items before grouping overflow into "Other (N)" (default: 20) */
	maxLegendItems?: number;
	/** Text shown when data is empty (default: "No data") */
	emptyText?: string;
	/** Custom value formatter for tooltips. Default shows raw number (e.g. `(value) => \`${value}h\``) */
	valueFormatter?: (value: number) => string;
	/** Legend label font size (default: 13) */
	legendFontSize?: number;
}

export interface PieChartHandle {
	/** Re-render with new data (destroys previous chart) */
	update: (data: PieChartData) => void;
	/** Destroy the chart instance and clean up */
	destroy: () => void;
}

// ─── Defaults ───

const DEFAULT_MAX_LEGEND_ITEMS = 20;
const DEFAULT_EMPTY_TEXT = "No data";
const DEFAULT_LEGEND_FONT_SIZE = 13;

// ─── CSS Suffixes ───

const CELL_SUFFIX = "chart-cell";
const TITLE_SUFFIX = "chart-title";
const CANVAS_WRAPPER_SUFFIX = "chart-canvas-wrapper";
const EMPTY_SUFFIX = "chart-empty";

// ─── Styles ───

function buildPieChartStyles(p: string): string {
	return `
.${p}${CELL_SUFFIX} {
	display: flex;
	flex-direction: column;
	min-height: 0;
	flex: 1;
}

.${p}${TITLE_SUFFIX} {
	margin: 0 0 10px 0;
	font-size: 1em;
	font-weight: 700;
	color: var(--text-normal);
	text-transform: uppercase;
	letter-spacing: 0.05em;
	text-align: center;
}

.${p}${CANVAS_WRAPPER_SUFFIX} {
	position: relative;
	flex: 1;
	min-height: 0;
}

.${p}${EMPTY_SUFFIX} {
	color: var(--text-faint);
	font-size: var(--font-ui-small);
	padding: 24px 0;
	text-align: center;
}
`;
}

// ─── Data normalization ───

interface NormalizedData {
	labels: string[];
	values: number[];
	colors: string[];
}

function normalizeData(data: PieChartData, maxLegendItems: number): NormalizedData {
	let labels: string[];
	let values: number[];
	let colors: string[];

	if (data instanceof Map) {
		const entries = [...data.entries()];
		const clamped = entries.slice(0, maxLegendItems);
		const overflow = entries.slice(maxLegendItems);

		if (overflow.length > 0) {
			const otherTotal = overflow.reduce((sum, [, v]) => sum + v, 0);
			clamped.push([`Other (${overflow.length})`, otherTotal]);
		}

		labels = clamped.map(([l]) => l);
		values = clamped.map(([, v]) => v);
		colors = generateColors(labels.length);
	} else {
		labels = data.labels;
		values = data.values;
		colors = data.colors;
	}

	return { labels, values, colors };
}

// ─── Chart.js config ───

function buildChartConfig(normalized: NormalizedData, config: PieChartConfig): ChartConfiguration<"pie"> {
	const { valueFormatter, legendFontSize = DEFAULT_LEGEND_FONT_SIZE } = config;
	const total = normalized.values.reduce((a, b) => a + b, 0);

	return {
		type: "pie",
		data: {
			labels: normalized.labels,
			datasets: [
				{
					data: normalized.values,
					backgroundColor: normalized.colors,
					borderWidth: 1,
					borderColor: "transparent",
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
						font: { size: legendFontSize },
						padding: 7,
						color: "#ffffff",
						boxWidth: 12,
						boxHeight: 12,
						generateLabels: (chart) =>
							chart.data.labels?.map((label, i) => {
								const v = chart.data.datasets[0].data[i] as number;
								const pct = total > 0 ? ((v / total) * 100).toFixed(0) : "0";
								return {
									text: `${String(label)} (${pct}%)`,
									fillStyle: (chart.data.datasets[0].backgroundColor as string[])[i],
									fontColor: "#ffffff",
									hidden: false,
									index: i,
								};
							}) ?? [],
					},
				},
				tooltip: {
					callbacks: {
						label: (ctx) => {
							const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : "0";
							const formatted = valueFormatter ? valueFormatter(ctx.parsed) : `${ctx.parsed}`;
							return `${ctx.label}: ${formatted} (${pct}%)`;
						},
					},
				},
			},
		},
	};
}

// ─── Component ───

export function renderPieChart(container: HTMLElement, config: PieChartConfig): PieChartHandle {
	const {
		cssPrefix,
		title,
		data,
		ChartJS,
		maxLegendItems = DEFAULT_MAX_LEGEND_ITEMS,
		emptyText = DEFAULT_EMPTY_TEXT,
	} = config;

	const css = createCssUtils(cssPrefix);
	injectStyleSheet(`${cssPrefix}pie-chart-styles`, buildPieChartStyles(cssPrefix));

	const wrapper = container.createDiv({ cls: css.cls(CELL_SUFFIX) });
	if (title) {
		wrapper.createEl("h3", { text: title, cls: css.cls(TITLE_SUFFIX) });
	}

	const canvasWrapper = wrapper.createDiv({ cls: css.cls(CANVAS_WRAPPER_SUFFIX) });
	const canvas = canvasWrapper.createEl("canvas");

	let chart: Chart<"pie"> | null = null;
	let emptyEl: HTMLElement | null = null;

	function render(chartData: PieChartData): void {
		if (chart) {
			chart.destroy();
			chart = null;
		}
		if (emptyEl) {
			emptyEl.remove();
			emptyEl = null;
		}
		canvas.style.display = "";

		const normalized = normalizeData(chartData, maxLegendItems);

		if (normalized.values.length === 0) {
			canvas.style.display = "none";
			emptyEl = wrapper.createDiv({ text: emptyText, cls: css.cls(EMPTY_SUFFIX) });
			return;
		}

		const chartConfig = buildChartConfig(normalized, config);
		chart = new ChartJS(canvas, chartConfig);
	}

	render(data);

	return {
		update(newData: PieChartData): void {
			render(newData);
		},

		destroy(): void {
			if (chart) {
				chart.destroy();
				chart = null;
			}
		},
	};
}
