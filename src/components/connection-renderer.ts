import { SVG, type Svg } from "@svgdotjs/svg.js";
import { distinctUntilChanged, map, type Subscription } from "rxjs";

import {
	cls,
	CONNECTION_PATH_ATTR,
	DEFAULT_CONNECTION_ARROW_SIZE,
	DEFAULT_CONNECTION_COLOR,
	DEFAULT_CONNECTION_STROKE_WIDTH,
	hasCls,
	tid,
} from "../constants";
import type { DependencyGraph } from "../core/dependency-graph";
import type { CalendarSettingsStore } from "../core/settings-store";
import type { CalendarEvent } from "../types/calendar";

const ARROW_MARKER_ID = tid("arrow-head");
const ARROW_MARKER_ID_ALLDAY = tid("arrow-head-allday");
const SVG_Z_VAR = "--prisma-connection-z";
const Z_ABOVE_ALLDAY = "12";
const Z_BELOW_ALLDAY = "5";

/**
 * A drawing layer = one SVG overlay plus the id of the arrowhead marker defined
 * inside it (each overlay needs its own `<marker>`; a shared id would resolve to
 * whichever appears first in the document, pointing the other layer's arrows at
 * the wrong defs).
 */
interface ArrowLayer {
	svg: Svg;
	markerId: string;
}

/**
 * Resolve a prerequisite/dependent event to its rendered tile by file path.
 *
 * Keys on {@link CONNECTION_PATH_ATTR}, stamped on each event's *content* node
 * (re-rendered on every update), not the harness `data-event-file-path` (set
 * once in `eventDidMount`). FullCalendar pools event tiles and reuses a node
 * for a different event without re-running `eventDidMount`, so the harness
 * attribute can go stale while the content — title and this attribute — is
 * always current. Resolving against the content node, then walking up to the
 * enclosing `.fc-event` tile for geometry, keeps arrows anchored correctly.
 */
export function resolveEventElementByFilePath(container: ParentNode, filePath: string): HTMLElement | null {
	// Compare the attribute directly rather than interpolating the (arbitrary,
	// space/bracket-laden) file path into a selector string — that parses
	// unreliably and is an injection footgun.
	const contentNodes = container.querySelectorAll<HTMLElement>(`[${CONNECTION_PATH_ATTR}]`);
	for (let i = 0; i < contentNodes.length; i++) {
		if (contentNodes[i].getAttribute(CONNECTION_PATH_ATTR) === filePath) {
			return contentNodes[i].closest<HTMLElement>(".fc-event") ?? contentNodes[i];
		}
	}
	return null;
}

/**
 * True for a tile rendered in an all-day lane (`.fc-daygrid-event`) rather than
 * the timed grid (`.fc-timegrid-event`). Arrows whose *both* endpoints are
 * all-day live entirely inside the sticky all-day row, so they must draw on the
 * always-on-top overlay — otherwise the z-index drop that keeps timed arrows
 * from painting over the sticky header would bury them behind the all-day tiles.
 */
export function isAllDayTile(el: HTMLElement): boolean {
	return el.classList.contains("fc-daygrid-event");
}

interface ConnectionStyle {
	color: string;
	strokeWidth: number;
	arrowSize: number;
}

export class ConnectionRenderer {
	/** z-toggling overlay for arrows that touch the timed grid. */
	private mainLayer: ArrowLayer;
	/** always-above overlay for arrows that live entirely in the all-day row. */
	private allDayLayer: ArrowLayer;
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
		allEvents: CalendarEvent[];
		viewStart: Date;
		viewEnd: Date;
	} | null = null;

	constructor(container: HTMLElement, settingsStore: CalendarSettingsStore) {
		this.container = container;
		container.style.setProperty(SVG_Z_VAR, Z_ABOVE_ALLDAY);

		// Main overlay: z driven by `--prisma-connection-z` (drops below the
		// all-day section when it is stuck — see updateZIndex).
		const mainSvg = SVG().addTo(container).addClass(cls("connection-overlay"));
		mainSvg.css({ position: "absolute", inset: "0", "pointer-events": "none", overflow: "visible" });
		this.mainLayer = { svg: mainSvg, markerId: ARROW_MARKER_ID };

		// All-day overlay: pinned above the all-day section (fixed inline z-index
		// overrides the class's var) so all-day↔all-day arrows are never buried.
		const allDaySvg = SVG().addTo(container).addClass(cls("connection-overlay"));
		allDaySvg.css({
			position: "absolute",
			inset: "0",
			"pointer-events": "none",
			overflow: "visible",
			"z-index": Z_ABOVE_ALLDAY,
		});
		this.allDayLayer = { svg: allDaySvg, markerId: ARROW_MARKER_ID_ALLDAY };

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
					const { graph, allEvents, viewStart, viewEnd } = this.renderArgs;
					this.render(graph, allEvents, viewStart, viewEnd);
				}
			});
	}

	render(graph: DependencyGraph, allEvents: CalendarEvent[], viewStart: Date, viewEnd: Date): void {
		this.renderArgs = { graph, allEvents, viewStart, viewEnd };
		this.clear();
		this.rebuildMarker();

		const eventStartMap = new Map(allEvents.map((e) => [e.ref.filePath, new Date(e.start)]));
		const svgRect = this.mainLayer.svg.node.getBoundingClientRect();

		const findEl = (filePath: string): HTMLElement | null => resolveEventElementByFilePath(this.container, filePath);

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
		for (const layer of [this.mainLayer, this.allDayLayer]) {
			layer.svg.children().forEach((child) => {
				if (child.type !== "defs") child.remove();
			});
		}
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
		this.mainLayer.svg.remove();
		this.allDayLayer.svg.remove();
	}

	private updateZIndex(): void {
		if (!hasCls(this.container, "sticky-all-day-events")) {
			this.container.style.setProperty(SVG_Z_VAR, Z_ABOVE_ALLDAY);
			return;
		}

		const allDay = this.container.querySelector<HTMLElement>(".fc-scrollgrid-section-body:first-of-type");
		const scrollParent = this.scrollTargets[0];
		if (!allDay) {
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
		this.rafId = window.requestAnimationFrame(() => {
			this.rafId = null;
			if (this.renderArgs) {
				const { graph, allEvents, viewStart, viewEnd } = this.renderArgs;
				this.render(graph, allEvents, viewStart, viewEnd);
			}
		});
	}

	private rebuildMarker(): void {
		const { arrowSize, color } = this.style;
		for (const layer of [this.mainLayer, this.allDayLayer]) {
			layer.svg.find("defs").forEach((d) => d.remove());
			layer.svg
				.defs()
				.marker(arrowSize, arrowSize, function (add) {
					add.polygon(`0 0, ${arrowSize} ${arrowSize / 2}, 0 ${arrowSize}`).fill(color);
				})
				.attr({ id: layer.markerId, refX: arrowSize - 2, refY: arrowSize / 2, orient: "auto" });
		}
	}

	private syncSize(): void {
		this.width = this.container.clientWidth;
		this.height = this.container.clientHeight;
		this.mainLayer.svg.size(this.width, this.height);
		this.allDayLayer.svg.size(this.width, this.height);
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

	private drawCubicArrow(layer: ArrowLayer, x1: number, y1: number, x2: number, y2: number, dashed: boolean): void {
		const cx = (x1 + x2) / 2;
		this.appendPath(layer, `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`, dashed);
	}

	private drawFullArrow(from: HTMLElement, to: HTMLElement, svgRect: DOMRect): void {
		const f = this.toLocal(from, svgRect);
		const t = this.toLocal(to, svgRect);
		const layer = isAllDayTile(from) && isAllDayTile(to) ? this.allDayLayer : this.mainLayer;
		this.drawCubicArrow(layer, f.x + f.w, f.y + f.h / 2, t.x, t.y + t.h / 2, false);
	}

	private drawStubLeft(depEl: HTMLElement, svgRect: DOMRect): void {
		const t = this.toLocal(depEl, svgRect);
		const layer = isAllDayTile(depEl) ? this.allDayLayer : this.mainLayer;
		this.drawCubicArrow(layer, 0, t.y + t.h / 2, t.x, t.y + t.h / 2, true);
	}

	private drawStubRight(prereqEl: HTMLElement, svgRect: DOMRect): void {
		const f = this.toLocal(prereqEl, svgRect);
		const layer = isAllDayTile(prereqEl) ? this.allDayLayer : this.mainLayer;
		this.drawCubicArrow(layer, f.x + f.w, f.y + f.h / 2, this.width, f.y + f.h / 2, true);
	}

	private appendPath(layer: ArrowLayer, d: string, dashed: boolean): void {
		const p = layer.svg
			.path(d)
			.fill("none")
			.stroke({ color: this.style.color, width: this.style.strokeWidth })
			.attr({ "marker-end": `url(#${layer.markerId})`, "data-testid": tid("connection-arrow") });
		if (dashed) p.attr({ "stroke-dasharray": "8 5", "data-arrow-stub": "true" });
	}
}
