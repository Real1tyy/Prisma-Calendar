import type { Locator, Page } from "@playwright/test";

// Drag primitives for FullCalendar + Prisma drag flows. Three shapes exist in
// the wild:
//
//   1. Straight drag (drag-select on empty time grid) — mousedown → move →
//      mouseup. FC's own range-select handler runs; no dragstart pacing needed.
//   2. Jittered drag (block → drop-target) — adds an initial ~8px move so FC's
//      `eventDragMinDistance` threshold is crossed and `dragstart` fires. Without
//      the jitter the interaction degrades to a click and `eventDrop` never runs.
//   3. Stepped drag by delta (drag-reschedule) — many small 1-frame moves so
//      FC's per-frame debouncer observes every intermediate position.
//
// All three paths used to be hand-rolled or scattered across `events-helpers`
// and `calendar-helpers`. This module is the single entry point: pick the
// variant via the `mode` option.

export interface Point {
	readonly x: number;
	readonly y: number;
}

export interface BoundingBox {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface DragOptions {
	/**
	 * Drag flavour:
	 * - `"plain"` (default) — mousedown → move → mouseup, with a single `steps`
	 *   parameter on the move. Good for range-select on empty slots.
	 * - `"jitter"` — adds an initial orthogonal nudge past FC's drag-min-distance
	 *   before the main move. Required for any event-block drag.
	 * - `"stepped"` — breaks the move into N frames with a `waitForTimeout(15)`
	 *   between each so FC's per-frame handler sees every intermediate position.
	 *   Use for drag-to-resize + FC-native drag-reschedule gestures.
	 */
	readonly mode?: "plain" | "jitter" | "stepped";
	/** Main-drag interpolation steps. Default depends on mode. */
	readonly steps?: number;
	/** Pause after mousedown, before the first move (ms). Default `50` in jitter mode, `0` otherwise. */
	readonly preDragPauseMs?: number;
	/** Pause between final move and mouseup (ms). Default `100` in jitter mode, `0` otherwise. */
	readonly preReleasePauseMs?: number;
	/** Jitter nudge magnitude (only used in `"jitter"` mode). */
	readonly jitterDx?: number;
	readonly jitterDy?: number;
	readonly jitterSteps?: number;
}

/**
 * Drag from `from` to `to`. The single entry point for every Prisma drag flow.
 * Pick the flavour via `opts.mode`; defaults cover the vast majority of
 * FC-native range-selects.
 */
export async function drag(page: Page, from: Point, to: Point, opts: DragOptions = {}): Promise<void> {
	const { mode = "plain" } = opts;
	const isJitter = mode === "jitter";
	const preDragPauseMs = opts.preDragPauseMs ?? (isJitter ? 50 : 0);
	const preReleasePauseMs = opts.preReleasePauseMs ?? (isJitter ? 100 : 0);
	const steps = opts.steps ?? (mode === "stepped" ? 15 : 25);

	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	if (preDragPauseMs > 0) await page.waitForTimeout(preDragPauseMs);

	if (isJitter) {
		const jitterDx = opts.jitterDx ?? 8;
		const jitterDy = opts.jitterDy ?? 0;
		const jitterSteps = opts.jitterSteps ?? 4;
		await page.mouse.move(from.x + jitterDx, from.y + jitterDy, { steps: jitterSteps });
	}

	if (mode === "stepped") {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		for (let i = 1; i <= steps; i++) {
			await page.mouse.move(from.x + (dx * i) / steps, from.y + (dy * i) / steps);
			// 15 ms ≥ 1 frame at 60 Hz so FC's per-frame handler observes every step.
			await page.waitForTimeout(15);
		}
		await page.mouse.move(to.x, to.y);
	} else {
		await page.mouse.move(to.x, to.y, { steps });
	}

	if (preReleasePauseMs > 0) await page.waitForTimeout(preReleasePauseMs);
	await page.mouse.up();
}

/**
 * Drag a source locator by a delta (dx, dy) in pixels from its bounding-box
 * center. Uses the `stepped` gesture by default so FC observes every frame.
 */
export async function dragByDelta(
	page: Page,
	source: Locator,
	dx: number,
	dy: number,
	opts: DragOptions = {}
): Promise<void> {
	const box = await boundingBoxOrThrow(source, "drag source");
	const from = centerOf(box);
	const to = { x: from.x + dx, y: from.y + dy };
	await drag(page, from, to, { mode: "stepped", ...opts });
}

/**
 * Drag from a source locator's center to a target locator's center. Uses
 * `jitter` mode by default — that's what event-block drags need.
 */
export async function dragLocatorToLocator(
	page: Page,
	from: Locator,
	to: Locator,
	opts: DragOptions = {}
): Promise<void> {
	const fromBox = await boundingBoxOrThrow(from, "drag source");
	const toBox = await boundingBoxOrThrow(to, "drag target");
	await drag(page, centerOf(fromBox), centerOf(toBox), { mode: "jitter", ...opts });
}

/**
 * Resolve a locator's bounding box or throw — saves callers from the
 * `expect(box).not.toBeNull(); if (!box) return;` dance Playwright's nullable
 * return type forces.
 */
export async function boundingBoxOrThrow(locator: Locator, name = "locator"): Promise<BoundingBox> {
	const box = await locator.boundingBox();
	if (!box) throw new Error(`${name} has no bounding box (detached or not visible)`);
	return box;
}

/** Return the center point of a bounding box. */
export function centerOf(box: BoundingBox): Point {
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
