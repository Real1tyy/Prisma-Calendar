import { cls } from "../../core/css-utils";
import type { BarLayout, PackedTask } from "../gantt-types";

export function renderBars(
	container: HTMLElement,
	bars: BarLayout[],
	taskMap: Map<string, PackedTask>,
	onClick: (filePath: string) => void
): void {
	container.empty();

	for (const bar of bars) {
		const task = taskMap.get(bar.taskId);
		if (!task) continue;

		const barEl = container.createDiv({ cls: cls("gantt-bar") });
		barEl.style.left = `${bar.x}px`;
		barEl.style.top = `${bar.y}px`;
		barEl.style.width = `${bar.width}px`;
		barEl.style.minHeight = `${bar.height}px`;

		if (task.color) {
			barEl.style.backgroundColor = task.color;
		}

		const label = barEl.createSpan({ cls: cls("gantt-bar-label") });
		label.textContent = task.title;

		barEl.addEventListener("click", () => onClick(task.filePath));
	}
}
