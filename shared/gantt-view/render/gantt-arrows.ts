import type { Svg } from "@svgdotjs/svg.js";

import type { ClsFn } from "../../core/css-utils";
import type { ArrowLayout, GanttInteractionHooks } from "../gantt-types";

function ensureArrowheadMarker(svg: Svg, markerId: string, cls: ClsFn): void {
	if (svg.findOne(`#${markerId}`)) return;

	svg
		.defs()
		.marker(8, 8, function (add) {
			add.path("M 0 0 L 10 5 L 0 10 z").fill("var(--text-muted)").addClass(cls("gantt-arrowhead"));
		})
		.attr({ id: markerId, viewBox: "0 0 10 10", refX: 10, refY: 5, orient: "auto-start-reverse" });
}

export function renderArrows(
	svg: Svg,
	arrows: ArrowLayout[],
	hooks: GanttInteractionHooks,
	cls: ClsFn,
	markerId: string
): void {
	svg.children().forEach((child) => {
		if (child.type !== "defs") child.remove();
	});
	ensureArrowheadMarker(svg, markerId, cls);

	for (const arrow of arrows) {
		const group = svg.group().addClass(cls("gantt-arrow-group"));

		group.path(arrow.path).addClass(cls("gantt-arrow-hit"));
		group
			.path(arrow.path)
			.attr({ "marker-end": `url(#${markerId})` })
			.addClass(cls("gantt-arrow"));

		group.on("contextmenu", (e: Event) => {
			if (hooks.onArrowContextMenu) {
				e.preventDefault();
				hooks.onArrowContextMenu(arrow.fromTaskId, arrow.toTaskId, e as MouseEvent);
			}
		});
	}
}
