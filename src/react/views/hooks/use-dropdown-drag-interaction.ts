import { useCallback, useEffect, useRef, type RefObject } from "react";

import { addCls, removeCls } from "../../../constants";

const DROP_CLICK_IGNORE_MS = 500;
const DRAG_START_CLICK_IGNORE_MS = 1500;
const DRAG_HOVER_HIDE_DELAY_MS = 1000;
const DROP_END_CLICK_IGNORE_MS = 250;

export interface UseDropdownDragInteractionOptions {
	dropdownRef: RefObject<HTMLElement | null>;
	isOpen: boolean;
}

export interface UseDropdownDragInteractionResult {
	shouldIgnoreOutsideClick: () => boolean;
	resetTempHide: () => void;
	ignoreOutsideClicksFor: (ms: number) => void;
	bumpAfterRefresh: () => void;
}

/**
 * Owns the drag-aware interaction state machine for an open dropdown:
 *
 * - **outside-click suppression** (`ignoreOutsideClicksUntilRef`) — a
 *   timestamp that gates `useOutsideClick`; bumped after refreshes, on
 *   drag start, and on drag end so the synthetic events those produce
 *   don't close the dropdown.
 * - **drag-in-progress flag** (`isDraggingRef`) — set on pointerdown over
 *   an item, cleared on pointerup/pointercancel.
 * - **temp-hide on hover** (`tempHiddenRef` + `dragHoverTimeoutRef`) —
 *   while dragging, if the cursor lingers over the still-open dropdown
 *   for `DRAG_HOVER_HIDE_DELAY_MS`, hide it so the calendar grid
 *   underneath is droppable. Restore on pointerup or when the cursor
 *   leaves.
 *
 * All four refs are internal to this hook. The consumer reads through
 * `shouldIgnoreOutsideClick` and gets back four callable methods for the
 * three places it needs to bump state: imperative API, post-refresh, and
 * the public reset for `restoreIfTemporarilyHidden`.
 */
export function useDropdownDragInteraction({
	dropdownRef,
	isOpen,
}: UseDropdownDragInteractionOptions): UseDropdownDragInteractionResult {
	const ignoreOutsideClicksUntilRef = useRef(0);
	const isDraggingRef = useRef(false);
	const tempHiddenRef = useRef(false);
	const dragHoverTimeoutRef = useRef<number | null>(null);

	const clearDragHoverTimeout = useCallback(() => {
		if (dragHoverTimeoutRef.current !== null) {
			window.clearTimeout(dragHoverTimeoutRef.current);
			dragHoverTimeoutRef.current = null;
		}
	}, []);

	const resetTempHide = useCallback(() => {
		clearDragHoverTimeout();
		tempHiddenRef.current = false;
		if (dropdownRef.current) removeCls(dropdownRef.current, "hidden");
	}, [clearDragHoverTimeout, dropdownRef]);

	const shouldIgnoreOutsideClick = useCallback(
		() => isDraggingRef.current || Date.now() < ignoreOutsideClicksUntilRef.current,
		[]
	);

	const ignoreOutsideClicksFor = useCallback((ms: number) => {
		const until = Date.now() + Math.max(0, ms);
		ignoreOutsideClicksUntilRef.current = Math.max(ignoreOutsideClicksUntilRef.current, until);
	}, []);

	const bumpAfterRefresh = useCallback(() => {
		ignoreOutsideClicksUntilRef.current = Date.now() + DROP_CLICK_IGNORE_MS;
	}, []);

	useEffect(() => {
		if (!isOpen) return;
		const dropEl = dropdownRef.current;
		if (!dropEl) return;

		const onItemPointerDown = (e: PointerEvent) => {
			const target = e.target as HTMLElement | null;
			if (!target?.closest(".prisma-untracked-dropdown-item")) return;
			isDraggingRef.current = true;
			tempHiddenRef.current = false;
			ignoreOutsideClicksUntilRef.current = Date.now() + DRAG_START_CLICK_IGNORE_MS;
		};

		const onPointerMove = (e: PointerEvent) => {
			if (!isDraggingRef.current) return;
			if (tempHiddenRef.current) return;
			const rect = dropEl.getBoundingClientRect();
			const isOver =
				e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
			if (!isOver) {
				clearDragHoverTimeout();
				return;
			}
			if (dragHoverTimeoutRef.current !== null) return;
			dragHoverTimeoutRef.current = window.setTimeout(() => {
				dragHoverTimeoutRef.current = null;
				if (!isDraggingRef.current) return;
				tempHiddenRef.current = true;
				addCls(dropEl, "hidden");
			}, DRAG_HOVER_HIDE_DELAY_MS);
		};

		const onPointerEnd = () => {
			if (!isDraggingRef.current) return;
			isDraggingRef.current = false;
			ignoreOutsideClicksUntilRef.current = Date.now() + DROP_END_CLICK_IGNORE_MS;
			clearDragHoverTimeout();
			if (tempHiddenRef.current) {
				tempHiddenRef.current = false;
				removeCls(dropEl, "hidden");
			}
		};

		dropEl.addEventListener("pointerdown", onItemPointerDown);
		activeDocument.addEventListener("pointermove", onPointerMove, true);
		activeDocument.addEventListener("pointerup", onPointerEnd, true);
		activeDocument.addEventListener("pointercancel", onPointerEnd, true);

		return () => {
			dropEl.removeEventListener("pointerdown", onItemPointerDown);
			activeDocument.removeEventListener("pointermove", onPointerMove, true);
			activeDocument.removeEventListener("pointerup", onPointerEnd, true);
			activeDocument.removeEventListener("pointercancel", onPointerEnd, true);
			clearDragHoverTimeout();
			isDraggingRef.current = false;
			tempHiddenRef.current = false;
			removeCls(dropEl, "hidden");
		};
	}, [isOpen, clearDragHoverTimeout, dropdownRef]);

	return {
		shouldIgnoreOutsideClick,
		resetTempHide,
		ignoreOutsideClicksFor,
		bumpAfterRefresh,
	};
}
