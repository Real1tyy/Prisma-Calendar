import { createCssUtils } from "../../core/css-utils";
import type { ArrowLayout, BarLayout, GanttConfig, GanttInteractionHooks, PackedTask, Viewport } from "../gantt-types";
import { GANTT_DEFAULTS, MS_PER_DAY, SVG_NS } from "../gantt-types";
import { injectGanttStyles } from "../styles";
import { buildViewport, todayStartMs } from "../time-scale";
import { renderArrows } from "./gantt-arrows";
import { renderBars } from "./gantt-bars";
import { renderGrid } from "./gantt-grid";
import { renderHeader } from "./gantt-header";

const DRAG_THRESHOLD_PX = 5;
const WEEK_MS = 7 * MS_PER_DAY;
const MONTH_MS = 30 * MS_PER_DAY;

export interface GanttRendererConfig {
	cssPrefix: string;
	ganttConfig?: Partial<GanttConfig>;
}

export interface GanttRenderData {
	taskMap: Map<string, PackedTask>;
	bars: BarLayout[];
	barMap: Map<string, BarLayout>;
	arrows: ArrowLayout[];
	rowCount: number;
}

export type LayoutFn = (viewport: Viewport) => GanttRenderData;

export class GanttRenderer {
	private readonly config: GanttConfig;
	private readonly hooks: GanttInteractionHooks;
	private readonly cls: (...names: string[]) => string;
	private readonly markerId: string;
	readonly toolbarLeft: HTMLElement;
	readonly toolbarRight: HTMLElement;
	private headerContent: HTMLElement;
	private bodyWrapper: HTMLElement;
	private gridSvg: SVGElement;
	private barLayer: HTMLElement;
	private barContainer: HTMLElement;
	private arrowSvg: SVGElement;
	private viewportStartMs: number;
	private layoutFn: LayoutFn | null = null;
	private cleanupPan: (() => void) | null = null;

	constructor(
		private readonly container: HTMLElement,
		hooks: GanttInteractionHooks,
		rendererConfig: GanttRendererConfig
	) {
		this.config = { ...GANTT_DEFAULTS, ...rendererConfig.ganttConfig };
		this.hooks = hooks;

		const { cls } = createCssUtils(rendererConfig.cssPrefix);
		this.cls = cls;
		this.markerId = `${rendererConfig.cssPrefix}gantt-arrowhead`;
		injectGanttStyles(rendererConfig.cssPrefix);

		this.viewportStartMs = todayStartMs() - (this.daysVisible / 2) * MS_PER_DAY;

		const toolbar = container.createDiv({ cls: cls("gantt-toolbar") });
		this.toolbarLeft = toolbar.createDiv({ cls: cls("gantt-toolbar-left") });
		this.toolbarRight = toolbar.createDiv({ cls: cls("gantt-toolbar-right") });

		this.buildNavButtons();

		const headerWrapper = container.createDiv({ cls: cls("gantt-header-wrapper") });
		this.headerContent = headerWrapper.createDiv({ cls: cls("gantt-header") });

		this.bodyWrapper = container.createDiv({ cls: cls("gantt-body") });

		this.gridSvg = document.createElementNS(SVG_NS, "svg");
		this.gridSvg.classList.add(cls("gantt-grid-svg"));
		this.bodyWrapper.appendChild(this.gridSvg);

		this.barLayer = this.bodyWrapper.createDiv({ cls: cls("gantt-bar-layer") });
		this.barContainer = this.barLayer.createDiv({ cls: cls("gantt-bar-container") });

		this.arrowSvg = document.createElementNS(SVG_NS, "svg");
		this.arrowSvg.classList.add(cls("gantt-arrow-svg"));
		this.barLayer.appendChild(this.arrowSvg);

		this.cleanupPan = this.setupPan();
	}

	private buildNavButtons(): void {
		const { cls } = this;
		const nav = this.toolbarLeft.createDiv({ cls: cls("gantt-nav") });

		const makeBtn = (label: string, icon: string, onClick: () => void): void => {
			const btn = nav.createEl("button", { cls: cls("gantt-nav-btn"), attr: { "aria-label": label } });
			btn.textContent = icon;
			btn.addEventListener("click", onClick);
		};

		makeBtn("Back 1 month", "\u00AB", () => this.shiftViewport(-MONTH_MS));
		makeBtn("Back 1 week", "\u2039", () => this.shiftViewport(-WEEK_MS));

		const todayBtn = nav.createEl("button", { cls: cls("gantt-nav-btn", "gantt-today-btn"), text: "Today" });
		todayBtn.addEventListener("click", () => this.scrollToToday());

		makeBtn("Forward 1 week", "\u203A", () => this.shiftViewport(WEEK_MS));
		makeBtn("Forward 1 month", "\u00BB", () => this.shiftViewport(MONTH_MS));
	}

	private shiftViewport(deltaMs: number): void {
		this.viewportStartMs += deltaMs;
		this.repaint();
	}

	private get containerWidth(): number {
		return this.container.clientWidth || 800;
	}

	private get containerHeight(): number {
		return this.bodyWrapper.clientHeight || this.container.clientHeight || 400;
	}

	private get daysVisible(): number {
		return this.containerWidth / this.config.pxPerDay;
	}

	private buildViewport(): Viewport {
		return buildViewport(this.viewportStartMs, this.containerWidth, this.containerHeight, this.config.pxPerDay);
	}

	private setupPan(): () => void {
		let isPending = false;
		let isDragging = false;
		let startX = 0;
		let startY = 0;
		let origStartMs = 0;
		let origScrollTop = 0;

		const barSel = `.${this.cls("gantt-bar")}`;

		const onPointerDown = (e: PointerEvent): void => {
			if (e.button !== 0) return;
			const target = e.target as HTMLElement;
			if (target.closest(barSel)) return;

			isPending = true;
			isDragging = false;
			startX = e.clientX;
			startY = e.clientY;
			origStartMs = this.viewportStartMs;
			origScrollTop = this.bodyWrapper.scrollTop;
			e.preventDefault();
		};

		const onPointerMove = (e: PointerEvent): void => {
			if (!isPending && !isDragging) return;

			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			if (isPending && !isDragging) {
				if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD_PX) return;
				isDragging = true;
				isPending = false;
				this.bodyWrapper.style.cursor = "grabbing";
			}

			if (!isDragging) return;
			const msDelta = (dx / this.config.pxPerDay) * MS_PER_DAY;
			this.viewportStartMs = origStartMs - msDelta;
			this.bodyWrapper.scrollTop = origScrollTop - dy;
			this.repaint();
		};

		const onPointerUp = (): void => {
			isPending = false;
			if (!isDragging) return;
			isDragging = false;
			this.bodyWrapper.style.cursor = "";
		};

		this.bodyWrapper.addEventListener("pointerdown", onPointerDown);
		document.addEventListener("pointermove", onPointerMove);
		document.addEventListener("pointerup", onPointerUp);

		return () => {
			this.bodyWrapper.removeEventListener("pointerdown", onPointerDown);
			document.removeEventListener("pointermove", onPointerMove);
			document.removeEventListener("pointerup", onPointerUp);
		};
	}

	private repaint(): void {
		if (!this.layoutFn) return;
		const viewport = this.buildViewport();
		const data = this.layoutFn(viewport);
		this.renderFrame(viewport, data);
	}

	private renderFrame(viewport: Viewport, data: GanttRenderData): void {
		const dataHeight = data.rowCount * (this.config.barHeight + this.config.rowPadding) + this.config.rowPadding;
		const gridHeight = Math.max(dataHeight, this.containerHeight);

		renderHeader(this.headerContent, viewport, this.config, this.cls);
		renderGrid(this.gridSvg, viewport, data.rowCount, this.config, gridHeight, this.cls);
		renderBars(this.barContainer, data.bars, data.taskMap, this.hooks, this.cls);
		renderArrows(this.arrowSvg, data.arrows, this.hooks, this.cls, this.markerId);

		this.barLayer.style.width = `${viewport.widthPx}px`;
		this.barLayer.style.minHeight = `${gridHeight}px`;

		this.arrowSvg.setAttribute("width", String(viewport.widthPx));
		this.arrowSvg.setAttribute("height", String(gridHeight));
	}

	render(layoutFn: LayoutFn, centerOnTasks?: { startMs: number; endMs: number }[]): void {
		this.layoutFn = layoutFn;

		if (centerOnTasks && centerOnTasks.length > 0) {
			const minStart = Math.min(...centerOnTasks.map((t) => t.startMs));
			const maxEnd = Math.max(...centerOnTasks.map((t) => t.endMs));
			const dataCenter = (minStart + maxEnd) / 2;
			this.viewportStartMs = dataCenter - (this.daysVisible / 2) * MS_PER_DAY;
		}

		this.repaint();
	}

	scrollToToday(): void {
		this.viewportStartMs = todayStartMs() - (this.daysVisible / 2) * MS_PER_DAY;
		this.repaint();
	}

	destroy(): void {
		this.cleanupPan?.();
		this.cleanupPan = null;
		this.layoutFn = null;
		this.container.empty();
	}
}
