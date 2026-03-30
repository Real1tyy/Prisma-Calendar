import type { BarLayout, GanttConfig, PackedTask, Viewport } from "./gantt-types";

const MAX_BAR_WIDTH_PX = 180;
const BAR_LABEL_PADDING_PX = 20;

export function layoutBars(tasks: PackedTask[], viewport: Viewport, config: GanttConfig): BarLayout[] {
	return tasks.map((task) => {
		const x = viewport.toX(task.startMs);
		const titleWidth = task.title.length * config.labelCharWidth + BAR_LABEL_PADDING_PX;
		const width = Math.min(titleWidth, MAX_BAR_WIDTH_PX);
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
