import type { Svg } from "@svgdotjs/svg.js";

import type { ClsFn } from "../../../utils/css-utils";
import type { GanttConfig, Viewport } from "../gantt-types";
import { MS_PER_DAY } from "../gantt-types";

export function renderGrid(
	svg: Svg,
	viewport: Viewport,
	rowCount: number,
	config: GanttConfig,
	contentHeight: number,
	cls: ClsFn
): void {
	svg.clear().size(viewport.widthPx, contentHeight);

	for (let r = 0; r < rowCount; r++) {
		if (r % 2 === 1) {
			const y = config.rowPadding + r * (config.barHeight + config.rowPadding);
			svg
				.rect(viewport.widthPx, config.barHeight + config.rowPadding)
				.move(0, y)
				.addClass(cls("gantt-row-alt"));
		}
	}

	const startDate = new Date(viewport.startMs);
	startDate.setHours(0, 0, 0, 0);
	let currentMs = startDate.getTime();

	while (currentMs <= viewport.endMs) {
		const x = viewport.toX(currentMs);
		if (x >= -1 && x <= viewport.widthPx + 1) {
			svg.line(x, 0, x, contentHeight).addClass(cls("gantt-grid-line"));
		}
		currentMs += MS_PER_DAY;
	}

	const now = Date.now();
	if (now >= viewport.startMs && now <= viewport.endMs) {
		const todayX = viewport.toX(now);
		svg.line(todayX, 0, todayX, contentHeight).addClass(cls("gantt-today-line"));
	}
}
