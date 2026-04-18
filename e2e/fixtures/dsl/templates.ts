import type { BatchBtnKey } from "../testids";
import type { CalendarHandle } from "./calendar";
import type { EventHandle } from "./event";

// Template patterns for the workflows that repeat across the history suite.
// Each is a thin wrapper around `CalendarHandle` that lets the spec body
// describe WHAT changes (via closures) instead of repeating HOW the full
// undo/redo dance is driven.
//
// See feedback_terse_changelog_and_replies.md — specs should read as one
// sentence of intent. These helpers exist to deliver on that.

export interface UndoRedoHooks {
	/** The action whose undo/redo symmetry we're verifying. */
	mutate: () => Promise<void>;
	/** Assert the post-mutate state — called after mutate AND after redo. */
	mutated: () => Promise<void>;
	/** Assert the pre-mutate state — called after undo. */
	baseline: () => Promise<void>;
}

/**
 * Drive the canonical undo/redo symmetry check: mutate → assert mutated →
 * undo → assert baseline → redo → assert mutated. Collapses the 5-step
 * repeating skeleton that saturates every single-event undo/redo spec.
 */
export async function undoRedoRoundTrip(calendar: CalendarHandle, hooks: UndoRedoHooks): Promise<void> {
	await hooks.mutate();
	await hooks.mutated();

	await calendar.undo();
	await hooks.baseline();

	await calendar.redo();
	await hooks.mutated();
}

export interface BatchRoundTripHooks {
	/** Assert the post-action state — called after the batch action AND after redo. */
	mutated: () => Promise<void>;
	/** Assert the baseline state — called after undo. */
	baseline: () => Promise<void>;
	/** True for destructive actions (delete) that require confirming a modal. */
	destructive?: boolean;
	/**
	 * Skip the redo leg. Use when the action is asymmetric or when a follow-up
	 * round-trip in the same test will exercise redo itself. Undo still runs
	 * and `baseline` still fires.
	 */
	skipRedo?: boolean;
}

/**
 * Drive a batch-selection action + undo + redo cycle. The caller owns the
 * seeded events and the assertions; this helper glues the enter → select →
 * do → [confirm] → exit → undo → redo skeleton together. `mutated` fires
 * twice (after action, after redo) — if the two states genuinely differ,
 * drop to `calendar.batch(events)` + manual undo/redo.
 */
export async function batchActionRoundTrip(
	calendar: CalendarHandle,
	events: readonly EventHandle[],
	action: BatchBtnKey,
	hooks: BatchRoundTripHooks
): Promise<void> {
	const batch = await calendar.batch(events);
	await batch.do(action);
	if (hooks.destructive) await batch.confirm();
	await hooks.mutated();
	await batch.exit();

	await calendar.undo();
	await hooks.baseline();

	if (hooks.skipRedo) return;
	await calendar.redo();
	await hooks.mutated();
}
