import { cls } from "../../core/css-utils";
import type { GanttConfig, Viewport } from "../gantt-types";
import { MS_PER_DAY } from "../gantt-types";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderGrid(
	svg: SVGElement,
	viewport: Viewport,
	rowCount: number,
	config: GanttConfig,
	contentHeight: number
): void {
	while (svg.firstChild) svg.removeChild(svg.firstChild);

	svg.setAttribute("width", String(viewport.widthPx));
	svg.setAttribute("height", String(contentHeight));

	for (let r = 0; r < rowCount; r++) {
		const y = config.rowPadding + r * (config.barHeight + config.rowPadding);
		if (r % 2 === 1) {
			const rect = document.createElementNS(SVG_NS, "rect");
			rect.setAttribute("x", "0");
			rect.setAttribute("y", String(y));
			rect.setAttribute("width", String(viewport.widthPx));
			rect.setAttribute("height", String(config.barHeight + config.rowPadding));
			rect.classList.add(cls("gantt-row-alt"));
			svg.appendChild(rect);
		}
	}

	const startDate = new Date(viewport.startMs);
	startDate.setHours(0, 0, 0, 0);
	let currentMs = startDate.getTime();

	while (currentMs <= viewport.endMs) {
		const x = viewport.toX(currentMs);
		if (x >= -1 && x <= viewport.widthPx + 1) {
			const line = document.createElementNS(SVG_NS, "line");
			line.setAttribute("x1", String(x));
			line.setAttribute("y1", "0");
			line.setAttribute("x2", String(x));
			line.setAttribute("y2", String(contentHeight));
			line.classList.add(cls("gantt-grid-line"));
			svg.appendChild(line);
		}
		currentMs += MS_PER_DAY;
	}

	const now = Date.now();
	if (now >= viewport.startMs && now <= viewport.endMs) {
		const todayX = viewport.toX(now);
		const todayLine = document.createElementNS(SVG_NS, "line");
		todayLine.setAttribute("x1", String(todayX));
		todayLine.setAttribute("y1", "0");
		todayLine.setAttribute("x2", String(todayX));
		todayLine.setAttribute("y2", String(contentHeight));
		todayLine.classList.add(cls("gantt-today-line"));
		svg.appendChild(todayLine);
	}
}
