import type { Subscription } from "rxjs";
import { distinctUntilChanged, map } from "rxjs";

import { DEFAULT_CONNECTION_ARROW_SIZE, DEFAULT_CONNECTION_COLOR, DEFAULT_CONNECTION_STROKE_WIDTH } from "../constants";
import type { DependencyGraph, EventIdMap } from "../core/dependency-graph";
import type { CalendarSettingsStore } from "../core/settings-store";
import type { CalendarEvent } from "../types/calendar";

const ARROW_MARKER_ID = "prisma-arrow-head";

interface ConnectionStyle {
	color: string;
	strokeWidth: number;
	arrowSize: number;
}

export class ConnectionRenderer {
	private svg: SVGSVGElement;
	private resizeObserver: ResizeObserver;
	private container: HTMLElement;
	private scrollHandler: (() => void) | null = null;
	private settingsSub: Subscription | null = null;
	private style: ConnectionStyle = {
		color: DEFAULT_CONNECTION_COLOR,
		strokeWidth: DEFAULT_CONNECTION_STROKE_WIDTH,
		arrowSize: DEFAULT_CONNECTION_ARROW_SIZE,
	};
	private width = 0;
	private height = 0;
	private renderArgs: {
		graph: DependencyGraph;
		eventIdMap: EventIdMap;
		allEvents: CalendarEvent[];
		viewStart: Date;
		viewEnd: Date;
	} | null = null;

	constructor(container: HTMLElement, settingsStore: CalendarSettingsStore) {
		this.container = container;

		this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		Object.assign(this.svg.style, {
			position: "absolute",
			inset: "0",
			pointerEvents: "none",
			zIndex: "9999",
			overflow: "visible",
		});
		container.appendChild(this.svg);

		this.resizeObserver = new ResizeObserver(() => this.syncSize());
		this.resizeObserver.observe(container);
		this.syncSize();

		this.scrollHandler = () => {
			if (this.renderArgs) {
				const { graph, eventIdMap, allEvents, viewStart, viewEnd } = this.renderArgs;
				this.render(graph, eventIdMap, allEvents, viewStart, viewEnd);
			}
		};
		container.addEventListener("scroll", this.scrollHandler, { passive: true, capture: true });

		this.settingsSub = settingsStore.settings$
			.pipe(
				map((s) => ({
					color: s.connectionColor,
					strokeWidth: s.connectionStrokeWidth,
					arrowSize: s.connectionArrowSize,
				})),
				distinctUntilChanged(
					(a, b) => a.color === b.color && a.strokeWidth === b.strokeWidth && a.arrowSize === b.arrowSize
				)
			)
			.subscribe((newStyle) => {
				this.style = newStyle;
				if (this.renderArgs) {
					const { graph, eventIdMap, allEvents, viewStart, viewEnd } = this.renderArgs;
					this.render(graph, eventIdMap, allEvents, viewStart, viewEnd);
				}
			});
	}

	render(
		graph: DependencyGraph,
		eventIdMap: EventIdMap,
		allEvents: CalendarEvent[],
		viewStart: Date,
		viewEnd: Date
	): void {
		this.renderArgs = { graph, eventIdMap, allEvents, viewStart, viewEnd };
		this.clear();
		this.rebuildMarker();

		const eventStartMap = new Map(allEvents.map((e) => [e.ref.filePath, new Date(e.start)]));
		const svgRect = this.svg.getBoundingClientRect();

		const findEl = (filePath: string): HTMLElement | null => {
			const id = eventIdMap.get(filePath);
			if (!id) return null;
			return this.container.querySelector<HTMLElement>(`[data-event-id="${id}"]`);
		};

		for (const [depFilePath, prereqPaths] of graph.entries()) {
			const depEl = findEl(depFilePath);

			for (const prereqFilePath of prereqPaths) {
				const prereqEl = findEl(prereqFilePath);
				const prereqStart = eventStartMap.get(prereqFilePath);

				if (prereqEl && depEl) {
					this.drawFullArrow(prereqEl, depEl, svgRect);
				} else if (!prereqEl && depEl && prereqStart && prereqStart < viewStart) {
					this.drawStubLeft(depEl, svgRect);
				} else if (prereqEl && !depEl) {
					const depStart = eventStartMap.get(depFilePath);
					if (depStart && depStart > viewEnd) {
						this.drawStubRight(prereqEl, svgRect);
					}
				}
			}
		}
	}

	clear(): void {
		Array.from(this.svg.childNodes)
			.filter((child) => (child as Element).tagName !== "defs")
			.forEach((child) => this.svg.removeChild(child));
	}

	destroy(): void {
		this.resizeObserver.disconnect();
		this.settingsSub?.unsubscribe();
		if (this.scrollHandler) {
			this.container.removeEventListener("scroll", this.scrollHandler, { capture: true });
		}
		this.svg.remove();
	}

	private rebuildMarker(): void {
		const existing = this.svg.querySelector("defs");
		if (existing) existing.remove();

		const { arrowSize, color } = this.style;
		const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
		const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
		marker.setAttribute("id", ARROW_MARKER_ID);
		marker.setAttribute("markerWidth", String(arrowSize));
		marker.setAttribute("markerHeight", String(arrowSize));
		marker.setAttribute("refX", String(arrowSize - 2));
		marker.setAttribute("refY", String(arrowSize / 2));
		marker.setAttribute("orient", "auto");

		const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
		poly.setAttribute("points", `0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}`);
		poly.setAttribute("fill", color);
		marker.appendChild(poly);
		defs.appendChild(marker);
		this.svg.insertBefore(defs, this.svg.firstChild);
	}

	private syncSize(): void {
		this.width = this.container.clientWidth;
		this.height = this.container.clientHeight;
		this.svg.setAttribute("width", String(this.width));
		this.svg.setAttribute("height", String(this.height));
	}

	private toLocal(el: HTMLElement, svgRect: DOMRect): { x: number; y: number; w: number; h: number } {
		const r = el.getBoundingClientRect();
		return {
			x: r.left - svgRect.left,
			y: r.top - svgRect.top,
			w: r.width,
			h: r.height,
		};
	}

	private drawCubicArrow(x1: number, y1: number, x2: number, y2: number, dashed: boolean): void {
		const cx = (x1 + x2) / 2;
		this.appendPath(`M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`, dashed);
	}

	private drawFullArrow(from: HTMLElement, to: HTMLElement, svgRect: DOMRect): void {
		const f = this.toLocal(from, svgRect);
		const t = this.toLocal(to, svgRect);
		this.drawCubicArrow(f.x + f.w, f.y + f.h / 2, t.x, t.y + t.h / 2, false);
	}

	private drawStubLeft(depEl: HTMLElement, svgRect: DOMRect): void {
		const t = this.toLocal(depEl, svgRect);
		this.drawCubicArrow(0, t.y + t.h / 2, t.x, t.y + t.h / 2, true);
	}

	private drawStubRight(prereqEl: HTMLElement, svgRect: DOMRect): void {
		const f = this.toLocal(prereqEl, svgRect);
		this.drawCubicArrow(f.x + f.w, f.y + f.h / 2, this.width, f.y + f.h / 2, true);
	}

	private appendPath(d: string, dashed: boolean): void {
		const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
		path.setAttribute("d", d);
		path.setAttribute("fill", "none");
		path.setAttribute("stroke", this.style.color);
		path.setAttribute("stroke-width", String(this.style.strokeWidth));
		path.setAttribute("marker-end", `url(#${ARROW_MARKER_ID})`);
		if (dashed) path.setAttribute("stroke-dasharray", "8 5");
		this.svg.appendChild(path);
	}
}
