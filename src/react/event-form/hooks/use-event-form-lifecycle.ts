import { useEnterToSubmit } from "@real1ty-obsidian-plugins-react";
import type React from "react";
import { type RefObject, useCallback, useEffect, useRef } from "react";

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
 * stopwatch when the user dismisses the modal (ESC / click-outside).
 *
 * The hook holds latest-value refs for the props the long-lived cleanup needs
 * so callers don't re-bind effects on every keystroke (mirrors the imperative
 * scope.register pattern in base-event-modal.ts:1148). `isMinimizingRef` stays
 * internal — only the unmount cleanup needs to read it.
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

	const collectFormValuesRef = useRef(collectFormValues);
	collectFormValuesRef.current = collectFormValues;
	const onUnmountWithActiveStopwatchRef = useRef(onUnmountWithActiveStopwatch);
	onUnmountWithActiveStopwatchRef.current = onUnmountWithActiveStopwatch;

	const handleMinimize = useCallback(() => {
		isMinimizingRef.current = true;
		onMinimize?.(collectFormValuesRef.current());
	}, [onMinimize]);

	// Auto-save state to MinimizedModalManager if the user dismisses the modal
	// (ESC / click-outside) while a stopwatch is active. Mirrors
	// base-event-modal.ts:229-235. Skipped when explicit Minimize / Submit ran.
	// Reads the cached snapshot rather than the live handle because the
	// Stopwatch child has already unmounted by the time this cleanup runs.
	useEffect(() => {
		return () => {
			if (isMinimizingRef.current) return;
			// oxlint-disable-next-line react-hooks/exhaustive-deps -- reading the latest snapshot at unmount is the whole point; copying at effect-mount captures the initial null
			const snapshot = stopwatchSnapshotRef.current;
			if (!snapshot || (snapshot.state !== "running" && snapshot.state !== "paused")) return;
			const values = collectFormValuesRef.current();
			const stateFactory = onUnmountWithActiveStopwatchRef.current;
			if (!stateFactory) return;
			const state = stateFactory(values);
			MinimizedModalManager.saveState(state, bundle);
		};
	}, [bundle, stopwatchSnapshotRef]);

	// Enter-to-save hotkey. Mirrors registerSubmitHotkey in
	// base-event-modal.ts:1148. Scoped to the form root so inputs that
	// `stopPropagation` on Enter (e.g. participant input) opt out.
	const handleKeyDown = useEnterToSubmit<HTMLDivElement>(submit);

	return { handleKeyDown, handleMinimize };
}
