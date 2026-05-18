import { createCssUtils } from "@real1ty-obsidian-plugins";
import { memo, useEffect, useLayoutEffect, useRef, type CSSProperties } from "react";

import {
	COL_LAYOUT,
	computeTrackPxs,
	parseTracks,
	redistributeTracks,
	ROW_LAYOUT,
	type AxisLayout,
} from "./grid-resize-math";

export interface GridResizeHandlesProps {
	cssPrefix: string;
	getContainer: () => HTMLElement | null;
	axis: "col" | "row";
	count: number;
	getSizes: () => number[];
	onSizesChange: (sizes: number[]) => void;
}

const HANDLE_BASE_STYLE: CSSProperties = {
	position: "absolute",
	zIndex: 10,
};

const MIN_HANDLE_THICKNESS_PX = 8;

export const GridResizeHandles = memo(function GridResizeHandles({
	cssPrefix,
	getContainer,
	axis,
	count,
	getSizes,
	onSizesChange,
}: GridResizeHandlesProps) {
	const layout: AxisLayout = axis === "col" ? COL_LAYOUT : ROW_LAYOUT;
	const css = createCssUtils(cssPrefix);
	const handleRefs = useRef<(HTMLDivElement | null)[]>([]);
	const getSizesRef = useRef(getSizes);
	const onSizesChangeRef = useRef(onSizesChange);
	const getContainerRef = useRef(getContainer);
	const positionHandlesRef = useRef<(() => void) | null>(null);
	getSizesRef.current = getSizes;
	onSizesChangeRef.current = onSizesChange;
	getContainerRef.current = getContainer;

	useEffect(() => {
		const gridEl = getContainerRef.current();
		if (!gridEl) return;

		gridEl.style.position = "relative";

		const positionHandles = (): void => {
			const currentGrid = getContainerRef.current();
			if (!currentGrid) return;
			const handles = handleRefs.current.filter((h): h is HTMLDivElement => h !== null);
			if (handles.length === 0) return;

			const style = getComputedStyle(currentGrid);
			const tracks = parseTracks(layout.trackTemplate(style));
			const gap = layout.gap(style);
			const thickness = Math.max(gap, MIN_HANDLE_THICKNESS_PX);

			let offset = layout.padStart(style);
			for (let i = 0; i < handles.length; i++) {
				offset += tracks[i] || 0;
				layout.positionHandle(handles[i], offset - (thickness - gap) / 2, thickness);
				offset += gap;
			}
		};

		const raf = window.requestAnimationFrame(positionHandles);
		positionHandlesRef.current = positionHandles;

		let observer: ResizeObserver | null = null;
		if (typeof ResizeObserver !== "undefined") {
			observer = new ResizeObserver(() => positionHandles());
			observer.observe(gridEl);
		}

		return () => {
			cancelAnimationFrame(raf);
			observer?.disconnect();
			positionHandlesRef.current = null;
		};
	}, [layout, count]);

	// Re-position handles after every commit. The ResizeObserver above only
	// fires on container-size changes; an internal track-size commit leaves the
	// container size unchanged, so without this the handles stayed pinned at
	// their first-mount offsets and the user could only drag once.
	useLayoutEffect(() => {
		positionHandlesRef.current?.();
	});

	const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>, index: number): void => {
		const gridEl = getContainerRef.current();
		if (!gridEl) return;
		e.preventDefault();

		const startPos = layout.clientPos(e.nativeEvent);
		const origSizes = [...getSizesRef.current()];

		const style = getComputedStyle(gridEl);
		const gap = layout.gap(style);
		const totalPx = layout.clientSize(gridEl) - layout.padStart(style) - layout.padEnd(style);
		const trackPxs = computeTrackPxs(origSizes, totalPx, gap);

		css.addCls(gridEl, "grid-resizing", layout.resizingCls);

		const onMove = (ev: PointerEvent): void => {
			const delta = layout.clientPos(ev) - startPos;
			onSizesChangeRef.current(redistributeTracks(origSizes, index, trackPxs, delta));
		};

		const onUp = (): void => {
			css.removeCls(gridEl, "grid-resizing", layout.resizingCls);
			document.removeEventListener("pointermove", onMove);
			document.removeEventListener("pointerup", onUp);
		};

		document.addEventListener("pointermove", onMove);
		document.addEventListener("pointerup", onUp);
	};

	handleRefs.current.length = count;

	return (
		<>
			{Array.from({ length: count }, (_, i) => (
				<div
					key={i}
					ref={(el) => {
						handleRefs.current[i] = el;
					}}
					className={css.cls("grid-resize-handle", layout.cls)}
					{...{ [`data-${layout.dataAttr}`]: String(i) }}
					style={{ ...HANDLE_BASE_STYLE, cursor: layout.cursor }}
					onPointerDown={(e) => handlePointerDown(e, i)}
				/>
			))}
		</>
	);
});
