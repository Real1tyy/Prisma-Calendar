import { useEnterToSubmit } from "@real1ty-obsidian-plugins-react";
import type React from "react";
import { useCallback, useEffect, useEffectEvent, useRef, type RefObject } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { MinimizedModalManager, type MinimizedModalState } from "../../../core/minimized-modal-manager";
import type { StopwatchSnapshot } from "../../views/stopwatch";
import type { EventFormValues } from "../event-form";

export interface UseEventFormLifecycleOptions {
	bundle: CalendarBundle;
	stopwatchSnapshotRef: RefObject<StopwatchSnapshot | null>;
	collectFormValues: () => EventFormValues;
	submit: () => void;
	onMinimize?: ((values: EventFormValues) => void) | undefined;
	onUnmountWithActiveStopwatch?: ((values: EventFormValues) => MinimizedModalState) | undefined;
}

export interface UseEventFormLifecycleResult {
	handleKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
	handleMinimize: () => void;
}

/**
 * Owns the event form's lifecycle wiring: the Enter-to-save hotkey, the
 * explicit Minimize handler, and the unmount auto-save that persists a running
 * stopwatch when the modal is dismissed (ESC, click-outside, AND Submit — see
 * the `persistOnUnmount` comment for the close-route truth table).
 *
 * `persistOnUnmount` is a `useEffectEvent` so the long-lived unmount cleanup
 * stays bound to a stable closure but still reads the latest prop values when
 * it actually fires (mirrors the imperative `scope.register` pattern in
 * base-event-modal.ts:1148). `isMinimizingRef` stays internal — it's the only
 * close route that opts out of the auto-save.
 */
export function useEventFormLifecycle({
	bundle,
	stopwatchSnapshotRef,
	collectFormValues,
	submit,
	onMinimize,
	onUnmountWithActiveStopwatch,
}: UseEventFormLifecycleOptions): UseEventFormLifecycleResult {
	const isMinimizingRef = useRef(false);

	const handleMinimize = useCallback(() => {
		isMinimizingRef.current = true;
		onMinimize?.(collectFormValues());
	}, [onMinimize, collectFormValues]);

	// Auto-save state to MinimizedModalManager when the modal unmounts with an
	// active stopwatch. Mirrors base-event-modal.ts:229-235: the "running
	// stopwatch survives Save" parity test (event-form-react-parity-regression
	// "Save with a running stopwatch keeps the minimized state alive") pins
	// that Submit MUST still trigger this auto-save — only Minimize opts out,
	// because handleMinimize already called saveState and a second write would
	// double-save. Reads the cached snapshot rather than the live handle
	// because the Stopwatch child has already unmounted by the time this
	// cleanup runs.
	const persistOnUnmount = useEffectEvent(() => {
		if (isMinimizingRef.current) return;
		const snapshot = stopwatchSnapshotRef.current;
		if (!snapshot || (snapshot.state !== "running" && snapshot.state !== "paused")) return;
		const state = onUnmountWithActiveStopwatch?.(collectFormValues());
		if (!state) return;
		MinimizedModalManager.saveState(state, bundle);
	});

	useEffect(() => persistOnUnmount, []);

	// Enter-to-save hotkey. Mirrors registerSubmitHotkey in
	// base-event-modal.ts:1148. Scoped to the form root so inputs that
	// `stopPropagation` on Enter (e.g. participant input) opt out.
	const handleKeyDown = useEnterToSubmit(submit);

	return { handleKeyDown, handleMinimize };
}
