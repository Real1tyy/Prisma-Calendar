import type { MoreLinkArg } from "@fullcalendar/core";

/**
 * Sizing for FullCalendar's `+N more` day popover.
 *
 * FullCalendar positions the popover's top edge against the day cell and then
 * lets it be whatever height its content wants — it never looks at the space
 * below. Our stylesheet used to cap the body at a fixed 300px, which turned a
 * crowded day into a five-row scrollbox floating in an empty window. Here we
 * hand the stylesheet the height the screen can actually afford, and pull the
 * popover upward when its natural top sits too low to be useful.
 */

/** Bare minimum of screen left below the popover, per the product decision. */
export const POPOVER_BOTTOM_GAP_PX = 30;

/** Matches FullCalendar's own `PADDING_FROM_VIEWPORT` so we never fight it. */
export const POPOVER_TOP_GAP_PX = 10;

/** Below this, shifting the popover up buys more than staying aligned with the day cell. */
export const POPOVER_MIN_HEIGHT_PX = 240;

/** Read by `.fc-popover` in `_fullcalendar-2.scss`. */
export const POPOVER_MAX_HEIGHT_VAR = "--prisma-popover-max-height";

export interface MorePopoverLayout {
	/** Viewport-relative top the popover should end up at. */
	top: number;
	/** Height budget for the whole popover (header + scrolling body). */
	maxHeight: number;
}

export function computeMorePopoverLayout(naturalTop: number, viewportHeight: number): MorePopoverLayout {
	const bottom = viewportHeight - POPOVER_BOTTOM_GAP_PX;

	// Only ever moves the popover *up*: `min` keeps a comfortably-placed popover
	// anchored to its day cell, `max` stops a cramped viewport from pushing it
	// off the top of the screen.
	const top = Math.max(POPOVER_TOP_GAP_PX, Math.min(naturalTop, bottom - POPOVER_MIN_HEIGHT_PX));

	return { top, maxHeight: Math.max(bottom - top, 0) };
}

export function expandMorePopover(popoverEl: HTMLElement, viewportHeight: number): void {
	const naturalTop = popoverEl.getBoundingClientRect().top;
	const { top, maxHeight } = computeMorePopoverLayout(naturalTop, viewportHeight);

	if (top !== naturalTop) {
		// FullCalendar writes `top` inline, relative to the offset parent — so
		// shift that value by the viewport-space delta rather than trying to
		// re-derive the offset parent's origin.
		const inlineTop = Number.parseFloat(popoverEl.style.top);
		const currentTop = Number.isFinite(inlineTop) ? inlineTop : popoverEl.offsetTop;
		popoverEl.style.top = `${currentTop + (top - naturalTop)}px`;
	}

	popoverEl.style.setProperty(POPOVER_MAX_HEIGHT_VAR, `${maxHeight}px`);
}

/**
 * FullCalendar mounts the popover during its own render pass, so the element
 * doesn't exist yet when `moreLinkClick` fires. Retry across a few frames
 * instead of guessing how many the render takes.
 */
export function scheduleMorePopoverExpand(root: ParentNode, win: Window, remainingFrames = 5): void {
	win.requestAnimationFrame(() => {
		const popoverEl = root.querySelector<HTMLElement>(".fc-popover");
		if (popoverEl) {
			expandMorePopover(popoverEl, win.innerHeight);
			return;
		}
		if (remainingFrames > 1) scheduleMorePopoverExpand(root, win, remainingFrames - 1);
	});
}

/**
 * `moreLinkClick` handler for every view that renders a day popover. Returning
 * `"popover"` keeps FullCalendar's default behaviour — we only piggyback on the
 * click to learn that a popover is about to exist.
 */
export function handleMoreLinkClick(arg: MoreLinkArg): "popover" {
	const target = arg.jsEvent.target as Element | null;
	const doc = target?.ownerDocument ?? document;
	const win = doc.defaultView;
	// FullCalendar portals the popover into the clicked link's view harness, so
	// searching from there can't pick up another leaf's (or another window's).
	const root = target?.closest(".fc-view-harness") ?? doc;
	if (win) scheduleMorePopoverExpand(root, win);
	return "popover";
}
