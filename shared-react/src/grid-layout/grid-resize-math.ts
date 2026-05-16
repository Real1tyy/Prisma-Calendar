const MIN_TRACK_PX = 40;
const FR_PRECISION = 100;

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

export type ResizeAxisKind = "col" | "row";

export interface AxisLayout {
	cls: string;
	/** Kebab-case data attribute name (used as `data-${dataAttr}`). */
	dataAttr: "resize-col" | "resize-row";
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

export const COL_LAYOUT: AxisLayout = {
	cls: "grid-resize-col",
	dataAttr: "resize-col",
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

export const ROW_LAYOUT: AxisLayout = {
	cls: "grid-resize-row",
	dataAttr: "resize-row",
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
