import { generateColors, PieChartBuilder, type ChartDataItem } from "@real1ty-obsidian-plugins";
import { memo, useEffect, useRef } from "react";

import { formatDuration, type WeeklyStatEntry } from "../../../utils/stats";

const MAX_LABELS = 25;

interface StatsChartProps {
	entries: WeeklyStatEntry[];
	colorResolver?: ((label: string) => string) | undefined;
	onVisibilityChange?: ((label: string, visible: boolean) => void) | undefined;
}

export const StatsChart = memo(function StatsChart({ entries, colorResolver, onVisibilityChange }: StatsChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<PieChartBuilder | null>(null);
	const visibilityHandlerRef = useRef(onVisibilityChange);
	visibilityHandlerRef.current = onVisibilityChange;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const limitedEntries = entries.slice(0, MAX_LABELS);
		const fallbackColors = colorResolver ? [] : generateColors(limitedEntries.length);

		const chartData: ChartDataItem[] = limitedEntries.map((entry, index) => ({
			label: entry.name,
			value: entry.duration,
			color: colorResolver ? colorResolver(entry.name) : fallbackColors[index],
		}));

		chartRef.current = new PieChartBuilder(canvas, chartData, {
			tooltipFormatter: (label, value, percentage) => `${label}: ${formatDuration(value)} (${percentage}%)`,
			onVisibilityChange: (label, visible) => visibilityHandlerRef.current?.(label, visible),
		});
		chartRef.current.render();

		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
	}, [entries, colorResolver]);

	if (entries.length === 0) return null;

	return (
		<div className="prisma-stats-chart-section">
			<div className="prisma-stats-chart-header">
				<h3>Distribution</h3>
			</div>
			<div className="prisma-stats-chart-container">
				<canvas ref={canvasRef} data-testid="prisma-stats-chart-canvas" />
			</div>
		</div>
	);
});
