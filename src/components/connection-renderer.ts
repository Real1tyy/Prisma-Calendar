import type { Subscription } from "rxjs";
import { distinctUntilChanged, map } from "rxjs";

import { DEFAULT_CONNECTION_ARROW_SIZE, DEFAULT_CONNECTION_COLOR, DEFAULT_CONNECTION_STROKE_WIDTH } from "../constants";
import type { DependencyGraph, EventIdMap } from "../core/dependency-graph";
import type { CalendarSettingsStore } from "../core/settings-store";
import type { CalendarEvent } from "../types/calendar";

const ARROW_MARKER_ID = "prisma-arrow-head";
const SVG_Z_VAR = "--prisma-connection-z";
const Z_ABOVE_ALLDAY = "12";
const Z_BELOW_ALLDAY = "5";

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
	private scrollTargets: HTMLElement[] = [];
	private rafId: number | null = null;
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
		container.style.setProperty(SVG_Z_VAR, Z_ABOVE_ALLDAY);

		this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		this.svg.classList.add("prisma-connection-overlay");
		Object.assign(this.svg.style, {
			position: "absolute",
			inset: "0",
			pointerEvents: "none",
			overflow: "visible",
		});
		container.appendChild(this.svg);

		this.resizeObserver = new ResizeObserver(() => this.syncSize());
		this.resizeObserver.observe(container);
		this.syncSize();

		this.scrollHandler = () => this.scheduleRender();

		container.addEventListener("scroll", this.scrollHandler, { passive: true, capture: true });

		// scroll events don't bubble — listen on ancestor scroll containers directly
		const scrollAncestor = container.closest(".prisma-tab-content") ?? container.closest(".view-content");
		if (scrollAncestor && scrollAncestor !== container) {
			this.scrollTargets.push(scrollAncestor as HTMLElement);
			scrollAncestor.addEventListener("scroll", this.scrollHandler, { passive: true });
		}

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

		this.updateZIndex();
	}

	clear(): void {
		Array.from(this.svg.childNodes)
			.filter((child) => (child as Element).tagName !== "defs")
			.forEach((child) => this.svg.removeChild(child));
	}

	destroy(): void {
		this.resizeObserver.disconnect();
		this.settingsSub?.unsubscribe();
		if (this.rafId !== null) cancelAnimationFrame(this.rafId);
		if (this.scrollHandler) {
			this.container.removeEventListener("scroll", this.scrollHandler, { capture: true });
			for (const target of this.scrollTargets) {
				target.removeEventListener("scroll", this.scrollHandler);
			}
		}
		this.scrollTargets = [];
		this.container.style.removeProperty(SVG_Z_VAR);
		this.svg.remove();
	}

	private updateZIndex(): void {
		if (!this.container.classList.contains("prisma-sticky-all-day-events")) {
			this.container.style.setProperty(SVG_Z_VAR, Z_ABOVE_ALLDAY);
			return;
		}

		const allDay = this.container.querySelector<HTMLElement>(".fc-scrollgrid-section-body:first-of-type");
		const scrollParent = this.scrollTargets[0];
		if (!allDay || !scrollParent) {
			this.container.style.setProperty(SVG_Z_VAR, Z_ABOVE_ALLDAY);
			return;
		}

		const allDayTop = allDay.getBoundingClientRect().top;
		const stickyTop = parseFloat(getComputedStyle(allDay).top) || 0;
		const parentTop = scrollParent.getBoundingClientRect().top;
		const isStuck = allDayTop <= parentTop + stickyTop + 1;

		this.container.style.setProperty(SVG_Z_VAR, isStuck ? Z_BELOW_ALLDAY : Z_ABOVE_ALLDAY);
	}

	private scheduleRender(): void {
		if (this.rafId !== null) return;
		this.rafId = requestAnimationFrame(() => {
			this.rafId = null;
			if (this.renderArgs) {
				const { graph, eventIdMap, allEvents, viewStart, viewEnd } = this.renderArgs;
				this.render(graph, eventIdMap, allEvents, viewStart, viewEnd);
			}
		});
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
