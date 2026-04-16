import { SVG } from "@svgdotjs/svg.js";

import { createCssUtils } from "../../../utils/css-utils";
import type { ArrowLayout, BarLayout, GanttConfig, GanttInteractionHooks, PackedTask, Viewport } from "../gantt-types";
import { GANTT_DEFAULTS, MS_PER_DAY } from "../gantt-types";
import { createPanHandler } from "../pan-handler";
import { injectGanttStyles } from "../styles";
import { buildViewport, todayStartMs } from "../time-scale";
import { renderArrows } from "./gantt-arrows";
import { renderBars } from "./gantt-bars";
import { renderGrid } from "./gantt-grid";
import { renderHeader } from "./gantt-header";

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

export interface GanttRendererHandle {
	readonly toolbarLeft: HTMLElement;
	readonly toolbarRight: HTMLElement;
	render: (layoutFn: LayoutFn, centerOnTasks?: { startMs: number; endMs: number }[]) => void;
	scrollToToday: () => void;
	destroy: () => void;
}

export function createGanttRenderer(
	container: HTMLElement,
	hooks: GanttInteractionHooks,
	rendererConfig: GanttRendererConfig
): GanttRendererHandle {
	const config: GanttConfig = { ...GANTT_DEFAULTS, ...rendererConfig.ganttConfig };
	const { cls } = createCssUtils(rendererConfig.cssPrefix);
	const markerId = `${rendererConfig.cssPrefix}gantt-arrowhead`;
	injectGanttStyles(rendererConfig.cssPrefix);

	let viewportStartMs = 0;
	let layoutFn: LayoutFn | null = null;
	let cleanupPan: (() => void) | null = null;

	// ─── DOM scaffold ───────────────────────────────────────────

	const toolbar = container.createDiv({ cls: cls("gantt-toolbar") });
	const toolbarLeft = toolbar.createDiv({ cls: cls("gantt-toolbar-left") });
	const toolbarRight = toolbar.createDiv({ cls: cls("gantt-toolbar-right") });

	const headerWrapper = container.createDiv({ cls: cls("gantt-header-wrapper") });
	const headerContent = headerWrapper.createDiv({ cls: cls("gantt-header") });

	const bodyWrapper = container.createDiv({ cls: cls("gantt-body") });
	const gridSvg = SVG().addTo(bodyWrapper).addClass(cls("gantt-grid-svg"));

	const barLayer = bodyWrapper.createDiv({ cls: cls("gantt-bar-layer") });
	const barContainer = barLayer.createDiv({ cls: cls("gantt-bar-container") });
	const arrowSvg = SVG().addTo(barLayer).addClass(cls("gantt-arrow-svg"));

	// ─── Viewport helpers ───────────────────────────────────────

	function getContainerWidth(): number {
		return container.clientWidth || 800;
	}

	function getContainerHeight(): number {
		return bodyWrapper.clientHeight || container.clientHeight || 400;
	}

	function getDaysVisible(): number {
		return getContainerWidth() / config.pxPerDay;
	}

	function getViewport(): Viewport {
		return buildViewport(viewportStartMs, getContainerWidth(), getContainerHeight(), config.pxPerDay);
	}

	// ─── Navigation ─────────────────────────────────────────────

	function shiftViewport(deltaMs: number): void {
		viewportStartMs += deltaMs;
		repaint();
	}

	function scrollToToday(): void {
		viewportStartMs = todayStartMs() - (getDaysVisible() / 2) * MS_PER_DAY;
		repaint();
	}

	const nav = toolbarLeft.createDiv({ cls: cls("gantt-nav") });
	const makeBtn = (label: string, icon: string, onClick: () => void): void => {
		const btn = nav.createEl("button", { cls: cls("gantt-nav-btn"), attr: { "aria-label": label } });
		btn.textContent = icon;
		btn.addEventListener("click", onClick);
	};

	makeBtn("Back 1 month", "\u00AB", () => shiftViewport(-MONTH_MS));
	makeBtn("Back 1 week", "\u2039", () => shiftViewport(-WEEK_MS));

	const todayBtn = nav.createEl("button", { cls: cls("gantt-nav-btn", "gantt-today-btn"), text: "Today" });
	todayBtn.addEventListener("click", scrollToToday);

	makeBtn("Forward 1 week", "\u203A", () => shiftViewport(WEEK_MS));
	makeBtn("Forward 1 month", "\u00BB", () => shiftViewport(MONTH_MS));

	// ─── Pan interaction ────────────────────────────────────────

	viewportStartMs = todayStartMs() - (getDaysVisible() / 2) * MS_PER_DAY;

	cleanupPan = createPanHandler(bodyWrapper, config.pxPerDay, `.${cls("gantt-bar")}`, {
		getViewportStartMs: () => viewportStartMs,
		setViewportStartMs: (ms) => {
			viewportStartMs = ms;
		},
		repaint,
	});

	// ─── Rendering ──────────────────────────────────────────────

	function repaint(): void {
		if (!layoutFn) return;
		const viewport = getViewport();
		const data = layoutFn(viewport);
		renderFrame(viewport, data);
	}

	function renderFrame(viewport: Viewport, data: GanttRenderData): void {
		const dataHeight = data.rowCount * (config.barHeight + config.rowPadding) + config.rowPadding;
		const gridHeight = Math.max(dataHeight, getContainerHeight());

		renderHeader(headerContent, viewport, config, cls);
		renderGrid(gridSvg, viewport, data.rowCount, config, gridHeight, cls);
		renderBars(barContainer, data.bars, data.taskMap, hooks, cls);
		renderArrows(arrowSvg, data.arrows, hooks, cls, markerId);

		barLayer.style.width = `${viewport.widthPx}px`;
		barLayer.style.minHeight = `${gridHeight}px`;

		arrowSvg.size(viewport.widthPx, gridHeight);
	}

	// ─── Public API ─────────────────────────────────────────────

	function render(fn: LayoutFn, centerOnTasks?: { startMs: number; endMs: number }[]): void {
		layoutFn = fn;

		if (centerOnTasks && centerOnTasks.length > 0) {
			const minStart = Math.min(...centerOnTasks.map((t) => t.startMs));
			const maxEnd = Math.max(...centerOnTasks.map((t) => t.endMs));
			const dataCenter = (minStart + maxEnd) / 2;
			viewportStartMs = dataCenter - (getDaysVisible() / 2) * MS_PER_DAY;
		}

		repaint();
	}

	function destroy(): void {
		cleanupPan?.();
		cleanupPan = null;
		layoutFn = null;
		container.empty();
	}

	return { toolbarLeft, toolbarRight, render, scrollToToday, destroy };
}
