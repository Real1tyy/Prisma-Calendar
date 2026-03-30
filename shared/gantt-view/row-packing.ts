import type { GanttConfig, GanttTask, PackedTask } from "./gantt-types";
import { MS_PER_DAY } from "./gantt-types";

const ROW_GAP_MS = MS_PER_DAY;

export function visualEndTime(task: GanttTask, config: GanttConfig): number {
	const labelWidthDays = Math.ceil((task.title.length * config.labelCharWidth) / config.pxPerDay);
	const labelEnd = task.startMs + labelWidthDays * MS_PER_DAY;
	return Math.max(task.endMs, labelEnd);
}

/**
 * Assigns rows to tasks using a dependency-first strategy:
 * - Tasks in a dependency chain always flow downward (each dependent is at least one row below its prerequisite)
 * - Independent tasks that don't overlap visually can share a row
 * - A small time gap (ROW_GAP_MS) is added after each task's visual end to prevent cramping
 */
export function packRows(tasks: GanttTask[], config: GanttConfig): PackedTask[] {
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

		const vEnd = visualEndTime(task, config) + ROW_GAP_MS;

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
