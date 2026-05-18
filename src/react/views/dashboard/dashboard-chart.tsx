import { PieChartBuilder, type ChartDataItem } from "@real1ty-obsidian-plugins";
import { memo, useEffect, useRef } from "react";

const MAX_CHART_LABELS = 25;

interface DashboardChartProps {
	chartData: ChartDataItem[];
	chartId: string;
	tooltipFormatter?: (label: string, value: number, percentage: string) => string;
}

export const DashboardChart = memo(function DashboardChart({
	chartData,
	chartId,
	tooltipFormatter,
}: DashboardChartProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas || chartData.length === 0) return;

		const limitedData = chartData.slice(0, MAX_CHART_LABELS);
		const builder = new PieChartBuilder(canvas, limitedData, {
			...(tooltipFormatter ? { tooltipFormatter } : {}),
		});
		builder.render();

		return () => builder.destroy();
	}, [chartData, chartId, tooltipFormatter]);

	if (chartData.length === 0) {
		return <div className="prisma-dashboard-chart-empty">No data</div>;
	}

	return <canvas ref={canvasRef} data-testid={`prisma-dashboard-cell-chart-${chartId}`} />;
});
