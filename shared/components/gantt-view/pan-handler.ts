import { MS_PER_DAY } from "./gantt-types";

const DRAG_THRESHOLD_PX = 5;

export interface PanState {
	getViewportStartMs: () => number;
	setViewportStartMs: (ms: number) => void;
	repaint: () => void;
}

export function createPanHandler(
	bodyWrapper: HTMLElement,
	pxPerDay: number,
	barSelector: string,
	state: PanState
): () => void {
	let isPending = false;
	let isDragging = false;
	let startX = 0;
	let startY = 0;
	let origStartMs = 0;
	let origScrollTop = 0;

	const onPointerDown = (e: PointerEvent): void => {
		if (e.button !== 0) return;
		const target = e.target as HTMLElement;
		if (target.closest(barSelector)) return;

		isPending = true;
		isDragging = false;
		startX = e.clientX;
		startY = e.clientY;
		origStartMs = state.getViewportStartMs();
		origScrollTop = bodyWrapper.scrollTop;
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
			bodyWrapper.style.cursor = "grabbing";
		}

		if (!isDragging) return;
		const msDelta = (dx / pxPerDay) * MS_PER_DAY;
		state.setViewportStartMs(origStartMs - msDelta);
		bodyWrapper.scrollTop = origScrollTop - dy;
		state.repaint();
	};

	const onPointerUp = (): void => {
		isPending = false;
		if (!isDragging) return;
		isDragging = false;
		bodyWrapper.style.cursor = "";
	};

	bodyWrapper.addEventListener("pointerdown", onPointerDown);
	document.addEventListener("pointermove", onPointerMove);
	document.addEventListener("pointerup", onPointerUp);

	return () => {
		bodyWrapper.removeEventListener("pointerdown", onPointerDown);
		document.removeEventListener("pointermove", onPointerMove);
		document.removeEventListener("pointerup", onPointerUp);
	};
}
