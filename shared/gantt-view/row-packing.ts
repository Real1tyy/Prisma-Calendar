import type { GanttConfig, GanttTask, PackedTask } from "./gantt-types";
import { MS_PER_DAY } from "./gantt-types";

export function visualEndTime(task: GanttTask, config: GanttConfig): number {
	const labelWidthDays = Math.ceil((task.title.length * config.labelCharWidth) / config.pxPerDay);
	const labelEnd = task.startMs + labelWidthDays * MS_PER_DAY;
	return Math.max(task.endMs, labelEnd);
}

export function packRows(tasks: GanttTask[], config: GanttConfig): PackedTask[] {
	if (tasks.length === 0) return [];

	const sorted = [...tasks].sort((a, b) => a.startMs - b.startMs);
	const taskRowMap = new Map<string, number>();
	const rowEndTimes: number[] = [];

	return sorted.map((task) => {
		let minRow = 0;
		for (const depId of task.dependencies) {
			const depRow = taskRowMap.get(depId);
			if (depRow !== undefined) {
				minRow = Math.max(minRow, depRow + 1);
			}
		}

		const vEnd = visualEndTime(task, config);

		let assignedRow = -1;
		for (let r = minRow; r < rowEndTimes.length; r++) {
			if (task.startMs >= rowEndTimes[r]) {
				assignedRow = r;
				rowEndTimes[r] = vEnd;
				break;
			}
		}

		if (assignedRow === -1) {
			assignedRow = rowEndTimes.length;
			rowEndTimes.push(vEnd);
		}

		taskRowMap.set(task.id, assignedRow);

		return {
			...task,
			row: assignedRow,
			visualEndMs: vEnd,
		};
	});
}
