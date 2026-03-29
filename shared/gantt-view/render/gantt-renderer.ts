import { cls } from "../../core/css-utils";
import type { ArrowLayout, BarLayout, GanttConfig, PackedTask, Viewport } from "../gantt-types";
import { GANTT_DEFAULTS, MS_PER_DAY } from "../gantt-types";
import { buildViewport } from "../time-scale";
import { renderArrows } from "./gantt-arrows";
import { renderBars } from "./gantt-bars";
import { renderGrid } from "./gantt-grid";
import { renderHeader } from "./gantt-header";

const SVG_NS = "http://www.w3.org/2000/svg";
const BAR_EXCLUDE_SELECTOR = ".prisma-gantt-bar";

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
	private headerContent: HTMLElement;
	private bodyWrapper: HTMLElement;
	private svgLayer: SVGElement;
	private barLayer: HTMLElement;
	private viewportStartMs: number;
	private layoutFn: LayoutFn | null = null;
	private cleanupPan: (() => void) | null = null;

	constructor(
		private readonly container: HTMLElement,
		private readonly onClick: (filePath: string) => void,
		config?: Partial<GanttConfig>
	) {
		this.config = { ...GANTT_DEFAULTS, ...config };

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

	private setupPan(): () => void {
		let isDragging = false;
		let startX = 0;
		let startY = 0;
		let origStartMs = 0;
		let origScrollTop = 0;

		const onMouseDown = (e: MouseEvent): void => {
			const target = e.target as HTMLElement;
			if (target.closest(BAR_EXCLUDE_SELECTOR)) return;
			isDragging = true;
			startX = e.clientX;
			startY = e.clientY;
			origStartMs = this.viewportStartMs;
			origScrollTop = this.bodyWrapper.scrollTop;
			this.bodyWrapper.style.cursor = "grabbing";
			e.preventDefault();
		};

		const onMouseMove = (e: MouseEvent): void => {
			if (!isDragging) return;
			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			const msDelta = (dx / this.config.pxPerDay) * MS_PER_DAY;
			this.viewportStartMs = origStartMs - msDelta;
			this.bodyWrapper.scrollTop = origScrollTop - dy;
			this.repaint();
		};

		const onMouseUp = (): void => {
			if (!isDragging) return;
			isDragging = false;
			this.bodyWrapper.style.cursor = "";
		};

		this.bodyWrapper.addEventListener("mousedown", onMouseDown);
		document.addEventListener("mousemove", onMouseMove);
		document.addEventListener("mouseup", onMouseUp);

		return () => {
			this.bodyWrapper.removeEventListener("mousedown", onMouseDown);
			document.removeEventListener("mousemove", onMouseMove);
			document.removeEventListener("mouseup", onMouseUp);
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

		renderHeader(this.headerContent, viewport, this.config);
		renderGrid(this.svgLayer, viewport, data.rowCount, this.config, contentHeight);
		renderBars(this.barLayer, data.bars, data.taskMap, this.onClick);
		renderArrows(this.svgLayer, data.arrows);

		this.barLayer.style.width = `${viewport.widthPx}px`;
		this.barLayer.style.minHeight = `${contentHeight}px`;
	}

	setLayoutFn(fn: LayoutFn): void {
		this.layoutFn = fn;
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
