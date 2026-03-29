import type { BarLayout, GanttConfig, PackedTask, Viewport } from "./gantt-types";

const MIN_BAR_WIDTH_PX = 40;
const BAR_LABEL_PADDING_PX = 16;

export function layoutBars(tasks: PackedTask[], viewport: Viewport, config: GanttConfig): BarLayout[] {
	return tasks.map((task) => {
		const x = viewport.toX(task.startMs);
		const timeSpanWidth = viewport.toWidth(task.startMs, task.endMs);
		const titleWidth = task.title.length * config.labelCharWidth + BAR_LABEL_PADDING_PX;
		const width = Math.max(MIN_BAR_WIDTH_PX, Math.min(timeSpanWidth, titleWidth));
		const y = config.rowPadding + task.row * (config.barHeight + config.rowPadding);

		return {
			taskId: task.id,
			x,
			y,
			width,
			height: config.barHeight,
		};
	});
}
