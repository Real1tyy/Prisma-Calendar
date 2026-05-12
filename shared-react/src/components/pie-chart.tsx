import {
	buildChartConfig,
	buildPieChartStyles,
	normalizeData,
	type PieChartConfig as ImperativePieChartConfig,
	type PieChartData,
} from "@real1ty-obsidian-plugins";
import type { Chart, ChartConfiguration } from "chart.js";
import { memo, useEffect, useRef } from "react";

import { useCls, useScoped } from "../contexts/theme-context";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { EmptyHint } from "./empty-hint";

export type { PieChartData };

export type ChartJSCtor = new (canvas: HTMLCanvasElement, config: ChartConfiguration) => Chart;

const DEFAULT_MAX_LEGEND_ITEMS = 20;
const DEFAULT_EMPTY_TEXT = "No data";

// ─── ChartTitle ───

export interface ChartTitleProps {
	text: string;
}

export const ChartTitle = memo(function ChartTitle({ text }: ChartTitleProps) {
	const cls = useCls();
	return <h3 className={cls("chart-title")}>{text}</h3>;
});

// ─── PieCanvas ───

export interface PieCanvasProps {
	data: PieChartData;
	ChartJS: ChartJSCtor;
	maxLegendItems?: number;
	valueFormatter?: (value: number) => string;
	legendFontSize?: number;
}

/**
 * Mounts a chart.js pie chart into a canvas. Re-runs on data change.
 * Destroys the chart instance on unmount / prop change.
 */
export const PieCanvas = memo(function PieCanvas({
	data,
	ChartJS,
	maxLegendItems = DEFAULT_MAX_LEGEND_ITEMS,
	valueFormatter,
	legendFontSize,
}: PieCanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const normalized = normalizeData(data, maxLegendItems);
		const chartConfig = buildChartConfig(normalized, {
			cssPrefix: "",
			data,
			ChartJS,
			maxLegendItems,
			...(valueFormatter ? { valueFormatter } : {}),
			...(legendFontSize !== undefined ? { legendFontSize } : {}),
		} as ImperativePieChartConfig);
		const chart = new ChartJS(canvas, chartConfig);

		return () => chart.destroy();
	}, [data, ChartJS, maxLegendItems, valueFormatter, legendFontSize]);

	return <canvas ref={canvasRef} />;
});

// ─── PieChart ───

export interface PieChartProps {
	data: PieChartData;
	ChartJS: ChartJSCtor;
	title?: string;
	maxLegendItems?: number;
	emptyText?: string;
	valueFormatter?: (value: number) => string;
	legendFontSize?: number;
}

/**
 * Titled pie chart with canvas + empty-state handling. Composes ChartTitle +
 * PieCanvas. Canvas is skipped entirely when the dataset contains no values.
 */
export const PieChart = memo(function PieChart({
	data,
	ChartJS,
	title,
	maxLegendItems = DEFAULT_MAX_LEGEND_ITEMS,
	emptyText = DEFAULT_EMPTY_TEXT,
	valueFormatter,
	legendFontSize,
}: PieChartProps) {
	const { cls, cssPrefix } = useScoped();
	useInjectedStyles(`${cssPrefix}pie-chart-styles`, buildPieChartStyles(cssPrefix));

	const normalized = normalizeData(data, maxLegendItems);
	const isEmpty = normalized.values.length === 0;

	return (
		<div className={cls("chart-cell")}>
			{title && <ChartTitle text={title} />}
			{isEmpty ? (
				<EmptyHint text={emptyText} className={cls("chart-empty")} />
			) : (
				<div className={cls("chart-canvas-wrapper")}>
					<PieCanvas
						data={data}
						ChartJS={ChartJS}
						maxLegendItems={maxLegendItems}
						{...(valueFormatter ? { valueFormatter } : {})}
						{...(legendFontSize !== undefined ? { legendFontSize } : {})}
					/>
				</div>
			)}
		</div>
	);
});
