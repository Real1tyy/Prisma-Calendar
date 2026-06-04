/** Edge a pointer is within, while dragging — the cue to page the calendar. */
export type EdgeScrollDirection = "prev" | "next" | null;

/**
 * Which edge (if any) a pointer at `pointerX` is hovering, given the calendar's
 * bounding `rect` and an `threshold` px band inside each edge. Pure so it can be
 * unit-tested without a live FullCalendar — the drag listener (pointer-based, so
 * it fires under both mouse and touch) just maps the result to `prev()`/`next()`.
 */
export function edgeScrollDirection(
	pointerX: number,
	rect: { left: number; right: number },
	threshold: number
): EdgeScrollDirection {
	if (pointerX < rect.left + threshold) return "prev";
	if (pointerX > rect.right - threshold) return "next";
	return null;
}
