import { generateColors, PieChartBuilder, type ChartDataItem } from "@real1ty-obsidian-plugins";
import { MOBILE_MEDIA_QUERY, useMediaQuery } from "@real1ty-obsidian-plugins-react";
import { memo, useEffect, useRef } from "react";

import { formatDuration, type WeeklyStatEntry } from "../../../utils/stats";

const MAX_LABELS = 25;

interface StatsChartProps {
	entries: WeeklyStatEntry[];
	colorResolver?: ((label: string) => string) | undefined;
	onVisibilityChange?: ((label: string, visible: boolean) => void) | undefined;
	hiddenLabels?: ReadonlySet<string> | undefined;
}

export const StatsChart = memo(function StatsChart({
	entries,
	colorResolver,
	onVisibilityChange,
	hiddenLabels,
}: StatsChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const chartRef = useRef<PieChartBuilder | null>(null);
	const visibilityHandlerRef = useRef(onVisibilityChange);
	visibilityHandlerRef.current = onVisibilityChange;
	const isMobile = useMediaQuery(MOBILE_MEDIA_QUERY);

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
			isMobile,
			tooltipFormatter: (label, value, percentage) => `${label}: ${formatDuration(value)} (${percentage}%)`,
			onVisibilityChange: (label, visible) => visibilityHandlerRef.current?.(label, visible),
		});
		chartRef.current.render();

		return () => {
			chartRef.current?.destroy();
			chartRef.current = null;
		};
	}, [entries, colorResolver, isMobile]);

	// Sync Chart.js internal hidden-state with parent-owned `hiddenLabels` so
	// imperative resets (e.g. "Show all" button) flip Chart.js back to visible
	// — otherwise the legend strikethrough sticks and the next click toggles
	// the wrong way.
	useEffect(() => {
		const chart = chartRef.current?.getChart();
		if (!chart) return;
		const labels = chart.data.labels ?? [];
		const indicesToToggle = labels
			.map((rawLabel, i) => ({ rawLabel, i }))
			.filter(({ rawLabel, i }) => {
				const shouldBeHidden = hiddenLabels?.has(String(rawLabel)) ?? false;
				return shouldBeHidden === chart.getDataVisibility(i);
			})
			.map(({ i }) => i);
		indicesToToggle.forEach((i) => chart.toggleDataVisibility(i));
		if (indicesToToggle.length > 0) chart.update();
	}, [hiddenLabels]);

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
