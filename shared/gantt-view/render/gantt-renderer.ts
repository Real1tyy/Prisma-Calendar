import { createCssUtils } from "../../core/css-utils";
import type { ArrowLayout, BarLayout, GanttConfig, GanttInteractionHooks, PackedTask, Viewport } from "../gantt-types";
import { GANTT_DEFAULTS, MS_PER_DAY } from "../gantt-types";
import { injectGanttStyles } from "../styles";
import { buildViewport } from "../time-scale";
import { renderArrows } from "./gantt-arrows";
import { renderBars } from "./gantt-bars";
import { renderGrid } from "./gantt-grid";
import { renderHeader } from "./gantt-header";

const SVG_NS = "http://www.w3.org/2000/svg";
const DRAG_THRESHOLD_PX = 5;

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
	private headerContent: HTMLElement;
	private bodyWrapper: HTMLElement;
	private svgLayer: SVGElement;
	private barLayer: HTMLElement;
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

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const daysVisible = this.containerWidth / this.config.pxPerDay;
		this.viewportStartMs = today.getTime() - (daysVisible / 2) * MS_PER_DAY;

		const headerWrapper = container.createDiv({ cls: cls("gantt-header-wrapper") });
		this.headerContent = headerWrapper.createDiv({ cls: cls("gantt-header") });

		this.bodyWrapper = container.createDiv({ cls: cls("gantt-body") });

		this.svgLayer = document.createElementNS(SVG_NS, "svg");
		this.svgLayer.classList.add(cls("gantt-svg-layer"));
		this.bodyWrapper.appendChild(this.svgLayer);

		this.barLayer = this.bodyWrapper.createDiv({ cls: cls("gantt-bar-layer") });

		this.cleanupPan = this.setupPan();
		this.setupCanvasContextMenu();
	}

	private get containerWidth(): number {
		return this.container.clientWidth || 800;
	}

	private get containerHeight(): number {
		return this.bodyWrapper.clientHeight || this.container.clientHeight || 400;
	}

	private buildViewport(): Viewport {
		return buildViewport(this.viewportStartMs, this.containerWidth, this.containerHeight, this.config.pxPerDay);
	}

	private setupCanvasContextMenu(): void {
		const barSel = `.${this.cls("gantt-bar")}`;
		const arrowSel = `.${this.cls("gantt-arrow-group")}`;

		this.bodyWrapper.addEventListener("contextmenu", (e) => {
			const target = e.target as HTMLElement;
			if (target.closest(barSel) || target.closest(arrowSel)) return;
			if (!this.hooks.onCanvasContextMenu) return;

			e.preventDefault();
			const rect = this.bodyWrapper.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const viewport = this.buildViewport();
			const dateMs = viewport.toMs(x);
			this.hooks.onCanvasContextMenu(dateMs, e);
		});
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
		const contentHeight = Math.max(dataHeight, this.containerHeight);

		renderHeader(this.headerContent, viewport, this.config, this.cls);
		renderGrid(this.svgLayer, viewport, data.rowCount, this.config, contentHeight, this.cls);
		renderBars(this.barLayer, data.bars, data.taskMap, this.hooks, this.cls);
		renderArrows(this.svgLayer, data.arrows, this.hooks, this.cls, this.markerId);

		this.barLayer.style.width = `${viewport.widthPx}px`;
		this.barLayer.style.minHeight = `${contentHeight}px`;
	}

	render(layoutFn: LayoutFn, centerOnTasks?: { startMs: number; endMs: number }[]): void {
		this.layoutFn = layoutFn;

		if (centerOnTasks && centerOnTasks.length > 0) {
			const minStart = Math.min(...centerOnTasks.map((t) => t.startMs));
			const maxEnd = Math.max(...centerOnTasks.map((t) => t.endMs));
			const dataCenter = (minStart + maxEnd) / 2;
			const daysVisible = this.containerWidth / this.config.pxPerDay;
			this.viewportStartMs = dataCenter - (daysVisible / 2) * MS_PER_DAY;
		}

		this.repaint();
	}

	scrollToToday(): void {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const daysVisible = this.containerWidth / this.config.pxPerDay;
		this.viewportStartMs = today.getTime() - (daysVisible / 2) * MS_PER_DAY;
		this.repaint();
	}

	destroy(): void {
		this.cleanupPan?.();
		this.cleanupPan = null;
		this.layoutFn = null;
		this.container.empty();
	}
}
