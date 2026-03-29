import { cls } from "../../core/css-utils";
import type { ArrowLayout } from "../gantt-types";

const SVG_NS = "http://www.w3.org/2000/svg";
const MARKER_ID = "prisma-gantt-arrowhead";

function ensureArrowheadMarker(svg: SVGElement): void {
	if (svg.querySelector(`#${MARKER_ID}`)) return;

	const defs = document.createElementNS(SVG_NS, "defs");
	const marker = document.createElementNS(SVG_NS, "marker");
	marker.setAttribute("id", MARKER_ID);
	marker.setAttribute("viewBox", "0 0 10 10");
	marker.setAttribute("refX", "10");
	marker.setAttribute("refY", "5");
	marker.setAttribute("markerWidth", "8");
	marker.setAttribute("markerHeight", "8");
	marker.setAttribute("orient", "auto-start-reverse");

	const polygon = document.createElementNS(SVG_NS, "path");
	polygon.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
	polygon.classList.add(cls("gantt-arrowhead"));

	marker.appendChild(polygon);
	defs.appendChild(marker);
	svg.appendChild(defs);
}

export function renderArrows(svg: SVGElement, arrows: ArrowLayout[]): void {
	ensureArrowheadMarker(svg);

	for (const arrow of arrows) {
		const path = document.createElementNS(SVG_NS, "path");
		path.setAttribute("d", arrow.path);
		path.setAttribute("marker-end", `url(#${MARKER_ID})`);
		path.classList.add(cls("gantt-arrow"));
		svg.appendChild(path);
	}
}
