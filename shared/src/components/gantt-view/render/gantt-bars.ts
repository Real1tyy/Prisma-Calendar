import { buildColorGradient } from "../../../utils/color-utils";
import type { ClsFn } from "../../../utils/css-utils";
import type { BarLayout, GanttInteractionHooks, PackedTask } from "../gantt-types";

const MAX_OVERFLOW_DOTS = 6;

function appendColorDots(parent: HTMLElement, colors: string[], cls: ClsFn): void {
	const container = document.createElement("div");
	container.className = cls("gantt-bar-color-dots");
	for (const color of colors.slice(0, MAX_OVERFLOW_DOTS)) {
		const dot = document.createElement("div");
		dot.className = cls("gantt-bar-color-dot");
		dot.style.setProperty("--dot-color", color);
		container.appendChild(dot);
	}
	parent.appendChild(container);
}

export function renderBars(
	container: HTMLElement,
	bars: BarLayout[],
	taskMap: Map<string, PackedTask>,
	hooks: GanttInteractionHooks,
	cls: ClsFn
): void {
	container.empty();

	for (const bar of bars) {
		const task = taskMap.get(bar.taskId);
		if (!task) continue;

		const barEl = container.createDiv({
			cls: cls("gantt-bar"),
			attr: { "data-testid": "prisma-gantt-bar", "data-task-id": task.id, "data-task-title": task.title },
		});
		barEl.style.left = `${bar.x}px`;
		barEl.style.top = `${bar.y}px`;
		barEl.style.width = `${bar.width}px`;
		barEl.style.minHeight = `${bar.height}px`;

		const allColors = task.allColors;
		if (allColors && allColors.length >= 2) {
			barEl.style.backgroundImage = buildColorGradient(allColors);
			barEl.style.borderColor = allColors[0];
			const overflow = allColors.slice(4);
			if (overflow.length > 0) {
				appendColorDots(barEl, overflow, cls);
			}
		} else if (task.color) {
			barEl.style.backgroundColor = task.color;
		}

		const label = barEl.createSpan({ cls: cls("gantt-bar-label") });
		label.textContent = task.title;

		barEl.addEventListener("click", (e) => hooks.onBarClick?.(task.id, e));

		barEl.addEventListener("contextmenu", (e) => {
			if (hooks.onBarContextMenu) {
				e.preventDefault();
				hooks.onBarContextMenu(task.id, e);
			}
		});
	}
}
