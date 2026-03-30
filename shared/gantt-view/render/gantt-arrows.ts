import type { ClsFn } from "../../core/css-utils";
import type { ArrowLayout, GanttInteractionHooks } from "../gantt-types";

const SVG_NS = "http://www.w3.org/2000/svg";

function ensureArrowheadMarker(svg: SVGElement, markerId: string, cls: ClsFn): void {
	if (svg.querySelector(`#${markerId}`)) return;

	const defs = document.createElementNS(SVG_NS, "defs");
	const marker = document.createElementNS(SVG_NS, "marker");
	marker.setAttribute("id", markerId);
	marker.setAttribute("viewBox", "0 0 10 10");
	marker.setAttribute("refX", "10");
	marker.setAttribute("refY", "5");
	marker.setAttribute("markerWidth", "8");
	marker.setAttribute("markerHeight", "8");
	marker.setAttribute("orient", "auto-start-reverse");

	const polygon = document.createElementNS(SVG_NS, "path");
	polygon.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
	polygon.setAttribute("fill", "var(--text-muted)");
	polygon.classList.add(cls("gantt-arrowhead"));

	marker.appendChild(polygon);
	defs.appendChild(marker);
	svg.appendChild(defs);
}

export function renderArrows(
	svg: SVGElement,
	arrows: ArrowLayout[],
	hooks: GanttInteractionHooks,
	cls: ClsFn,
	markerId: string
): void {
	ensureArrowheadMarker(svg, markerId, cls);

	for (const arrow of arrows) {
		const group = document.createElementNS(SVG_NS, "g");
		group.classList.add(cls("gantt-arrow-group"));

		const hitArea = document.createElementNS(SVG_NS, "path");
		hitArea.setAttribute("d", arrow.path);
		hitArea.classList.add(cls("gantt-arrow-hit"));
		group.appendChild(hitArea);

		const visible = document.createElementNS(SVG_NS, "path");
		visible.setAttribute("d", arrow.path);
		visible.setAttribute("marker-end", `url(#${markerId})`);
		visible.classList.add(cls("gantt-arrow"));
		group.appendChild(visible);

		group.addEventListener("contextmenu", (e) => {
			if (hooks.onArrowContextMenu) {
				e.preventDefault();
				hooks.onArrowContextMenu(arrow.fromTaskId, arrow.toTaskId, e as MouseEvent);
			}
		});

		svg.appendChild(group);
	}
}
