import type { CssUtils } from "../core/css-utils";

const MIN_TRACK_PX = 40;
const FR_PRECISION = 100;

export interface ResizeAxisConfig {
	getSizes: () => number[];
	onSizesChange: (sizes: number[]) => void;
}

export interface GridResizeConfig {
	gridEl: HTMLElement;
	css: CssUtils;
	columns?: ResizeAxisConfig;
	rows?: ResizeAxisConfig;
}

export interface GridResizeHandle {
	update(): void;
	destroy(): void;
}

interface AxisDescriptor extends ResizeAxisConfig {
	cls: string;
	dataAttr: string;
	cursor: string;
	resizingCls: string;
	trackTemplate: (style: CSSStyleDeclaration) => string;
	gap: (style: CSSStyleDeclaration) => number;
	padStart: (style: CSSStyleDeclaration) => number;
	padEnd: (style: CSSStyleDeclaration) => number;
	clientSize: (el: HTMLElement) => number;
	clientPos: (e: PointerEvent) => number;
	positionHandle: (h: HTMLElement, offset: number, thickness: number) => void;
}

export function roundFr(value: number): number {
	return Math.round(value * FR_PRECISION) / FR_PRECISION;
}

export function parseTracks(computed: string): number[] {
	if (!computed || computed === "none") return [];
	return computed
		.split(/\s+/)
		.map(parseFloat)
		.filter((n) => !Number.isNaN(n));
}

export function redistributeTracks(origSizes: number[], index: number, trackPxs: number[], delta: number): number[] {
	const beforePx = trackPxs[index];
	const afterPx = trackPxs[index + 1];
	const combinedPx = beforePx + afterPx;
	const combinedFr = origSizes[index] + origSizes[index + 1];

	const newBeforePx = Math.max(MIN_TRACK_PX, Math.min(combinedPx - MIN_TRACK_PX, beforePx + delta));
	const newAfterPx = combinedPx - newBeforePx;

	const newSizes = [...origSizes];
	newSizes[index] = roundFr((newBeforePx / combinedPx) * combinedFr);
	newSizes[index + 1] = roundFr((newAfterPx / combinedPx) * combinedFr);
	return newSizes;
}

export function computeTrackPxs(sizes: number[], totalPx: number, gap: number): number[] {
	const available = totalPx - gap * (sizes.length - 1);
	const totalFr = sizes.reduce((a, b) => a + b, 0);
	return sizes.map((s) => (s / totalFr) * available);
}

function parseStylePx(value: string): number {
	return parseFloat(value) || 0;
}

type AxisLayout = Omit<AxisDescriptor, "getSizes" | "onSizesChange">;

const COL_LAYOUT: AxisLayout = {
	cls: "grid-resize-col",
	dataAttr: "resizeCol",
	cursor: "col-resize",
	resizingCls: "grid-resizing-col",
	trackTemplate: (s) => s.gridTemplateColumns,
	gap: (s) => parseStylePx(s.columnGap) || parseStylePx(s.gap),
	padStart: (s) => parseStylePx(s.paddingLeft),
	padEnd: (s) => parseStylePx(s.paddingRight),
	clientSize: (el) => el.clientWidth,
	clientPos: (e) => e.clientX,
	positionHandle: (h, offset, thickness) => {
		h.style.left = `${offset}px`;
		h.style.top = "0";
		h.style.width = `${thickness}px`;
		h.style.height = "100%";
	},
};

const ROW_LAYOUT: AxisLayout = {
	cls: "grid-resize-row",
	dataAttr: "resizeRow",
	cursor: "row-resize",
	resizingCls: "grid-resizing-row",
	trackTemplate: (s) => s.gridTemplateRows,
	gap: (s) => parseStylePx(s.rowGap) || parseStylePx(s.gap),
	padStart: (s) => parseStylePx(s.paddingTop),
	padEnd: (s) => parseStylePx(s.paddingBottom),
	clientSize: (el) => el.clientHeight,
	clientPos: (e) => e.clientY,
	positionHandle: (h, offset, thickness) => {
		h.style.top = `${offset}px`;
		h.style.left = "0";
		h.style.height = `${thickness}px`;
		h.style.width = "100%";
	},
};

export function setupGridResize(config: GridResizeConfig): GridResizeHandle {
	const { gridEl, css } = config;

	const axes: AxisDescriptor[] = [];
	if (config.columns) axes.push({ ...COL_LAYOUT, ...config.columns });
	if (config.rows) axes.push({ ...ROW_LAYOUT, ...config.rows });

	let handlesByAxis: HTMLElement[][] = axes.map(() => []);
	let observer: ResizeObserver | null = null;
	let destroyed = false;

	gridEl.style.position = "relative";

	buildHandles();
	requestAnimationFrame(() => positionHandles());

	if (typeof ResizeObserver !== "undefined") {
		observer = new ResizeObserver(() => {
			if (!destroyed) positionHandles();
		});
		observer.observe(gridEl);
	}

	function buildHandles(): void {
		clearHandles();

		handlesByAxis = axes.map((axis) => {
			const sizes = axis.getSizes();
			const handles: HTMLElement[] = [];

			for (let i = 0; i < sizes.length - 1; i++) {
				const handle = document.createElement("div");
				handle.className = css.cls("grid-resize-handle", axis.cls);
				handle.dataset[axis.dataAttr] = String(i);
				handle.style.position = "absolute";
				handle.style.cursor = axis.cursor;
				handle.style.zIndex = "10";
				gridEl.appendChild(handle);
				handles.push(handle);
				handle.addEventListener("pointerdown", (e) => startResize(e, axis, handles, i));
			}

			return handles;
		});
	}

	function clearHandles(): void {
		for (const handles of handlesByAxis) {
			for (const h of handles) h.remove();
		}
		handlesByAxis = axes.map(() => []);
	}

	function positionHandles(): void {
		if (destroyed) return;

		const style = getComputedStyle(gridEl);

		for (let a = 0; a < axes.length; a++) {
			const axis = axes[a];
			const handles = handlesByAxis[a];
			const tracks = parseTracks(axis.trackTemplate(style));
			const gap = axis.gap(style);
			const thickness = Math.max(gap, 8);

			let offset = axis.padStart(style);
			for (let i = 0; i < handles.length; i++) {
				offset += tracks[i] || 0;
				axis.positionHandle(handles[i], offset - (thickness - gap) / 2, thickness);
				offset += gap;
			}
		}
	}

	function startResize(e: PointerEvent, axis: AxisDescriptor, handles: HTMLElement[], index: number): void {
		e.preventDefault();
		const startPos = axis.clientPos(e);
		const origSizes = [...axis.getSizes()];

		const style = getComputedStyle(gridEl);
		const gap = axis.gap(style);
		const totalPx = axis.clientSize(gridEl) - axis.padStart(style) - axis.padEnd(style);
		const trackPxs = computeTrackPxs(origSizes, totalPx, gap);

		css.addCls(gridEl, "grid-resizing", axis.resizingCls);

		const onMove = (ev: PointerEvent): void => {
			const delta = axis.clientPos(ev) - startPos;
			axis.onSizesChange(redistributeTracks(origSizes, index, trackPxs, delta));
			positionHandles();
		};

		const onUp = (): void => {
			css.removeCls(gridEl, "grid-resizing", axis.resizingCls);
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	}

	return {
		update(): void {
			if (destroyed) return;
			buildHandles();
			requestAnimationFrame(() => positionHandles());
		},
		destroy(): void {
			if (destroyed) return;
			destroyed = true;
			clearHandles();
			observer?.disconnect();
			observer = null;
		},
	};
}
