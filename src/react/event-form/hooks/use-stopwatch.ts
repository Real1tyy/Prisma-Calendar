import { parseAsLocalDate, toSafeString } from "@real1ty-obsidian-plugins";
import { useCallback, useRef, type Dispatch, type RefObject, type SetStateAction } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { EventFormState } from "../../../components/modals/event/event-form-state";
import { PositiveFloat } from "../../../types/event-boundaries";
import { formatDateTimeForInput } from "../../../utils/format";
import type { StopwatchHandle, StopwatchSnapshot } from "../../views/stopwatch";

export interface UseStopwatchOptions {
	form: UseFormReturn<EventFormState>;
	initialSnapshot: StopwatchSnapshot | null;
	autoStart: boolean;
	setMetadataValues: Dispatch<SetStateAction<Record<string, unknown>>>;
}

export interface UseStopwatchResult {
	snapshotRef: RefObject<StopwatchSnapshot | null>;
	setHandle: (handle: StopwatchHandle | null) => void;
	refreshSnapshot: () => void;
	reset: () => void;
	onStart: (startTime: Date) => void;
	onContinueRequested: () => Date | null;
	onStop: (endTime: Date) => void;
	onBreakUpdate: (breakMinutes: number) => void;
}

/**
 * Owns the stopwatch lifecycle for the event form: the imperative handle, the
 * cached snapshot (kept fresh for the unmount auto-save), and the break-minute
 * baseline that lets resumed sessions accumulate instead of overwriting the
 * user-entered value (mirrors base-event-modal.ts:504-543).
 *
 * The hook drives `form.setValue` directly for start/end fields; break-minute
 * writes go through `setMetadataValues` because that field still lives outside
 * the RHF schema. Drop that prop once the metadata fields move into the form.
 */
export function useStopwatch({
	form,
	initialSnapshot,
	autoStart,
	setMetadataValues,
}: UseStopwatchOptions): UseStopwatchResult {
	const snapshotRef = useRef<StopwatchSnapshot | null>(initialSnapshot);
	const handleRef = useRef<StopwatchHandle | null>(null);
	const initialBreakMinutesRef = useRef(0);

	const setHandle = useCallback(
		(handle: StopwatchHandle | null) => {
			handleRef.current = handle;
			if (!handle) return;
			if (initialSnapshot) handle.importState(initialSnapshot);
			if (autoStart) {
				handle.expand();
				queueMicrotask(() => handle.start());
			}
		},
		[autoStart, initialSnapshot]
	);

	const refreshSnapshot = useCallback(() => {
		const handle = handleRef.current;
		if (!handle) return;
		snapshotRef.current = handle.exportState();
	}, []);

	const reset = useCallback(() => {
		handleRef.current?.reset();
		initialBreakMinutesRef.current = 0;
	}, []);

	// Read the current breakMinutes from metadata via setMetadataValues's
	// updater function — gives us a fresh snapshot of state without
	// re-rendering. Returning `prev` unchanged is a no-op for React.
	const captureInitialBreakMinutes = useCallback(() => {
		setMetadataValues((prev) => {
			const parsed = PositiveFloat.parse(toSafeString(prev["breakMinutes"]) ?? "") ?? 0;
			initialBreakMinutesRef.current = parsed;
			return prev;
		});
	}, [setMetadataValues]);

	const onStart = useCallback(
		(startTime: Date) => {
			captureInitialBreakMinutes();
			form.setValue("start", formatDateTimeForInput(startTime));
			const endMs = startTime.getTime() + 5 * 60 * 1000;
			form.setValue("end", formatDateTimeForInput(new Date(endMs)));
			// Stopwatch fires onStart before transitioning to "running" (see
			// stopwatch.tsx start() — onStart, then beginTracking flips state).
			// Defer the snapshot read so we capture post-transition state.
			queueMicrotask(refreshSnapshot);
		},
		[captureInitialBreakMinutes, form, refreshSnapshot]
	);

	const onContinueRequested = useCallback((): Date | null => {
		captureInitialBreakMinutes();
		const startValue = form.getValues("start");
		if (!startValue) return null;

		// Mirror base-event-modal.ts:524-532 — if the existing end stamp is in
		// the past the user is resuming after a gap; push end forward to "now".
		const endValue = form.getValues("end");
		if (endValue) {
			const endDate = parseAsLocalDate(endValue);
			if (endDate && endDate.getTime() < Date.now()) {
				form.setValue("end", formatDateTimeForInput(new Date()));
			}
		}

		queueMicrotask(refreshSnapshot);
		return parseAsLocalDate(startValue);
	}, [captureInitialBreakMinutes, form, refreshSnapshot]);

	const onStop = useCallback(
		(endTime: Date) => {
			form.setValue("end", formatDateTimeForInput(endTime));
			refreshSnapshot();
		},
		[form, refreshSnapshot]
	);

	const onBreakUpdate = useCallback(
		(breakMinutes: number) => {
			const total = initialBreakMinutesRef.current + breakMinutes;
			setMetadataValues((prev) => ({ ...prev, breakMinutes: total.toString() }));
			refreshSnapshot();
		},
		[refreshSnapshot, setMetadataValues]
	);

	return {
		snapshotRef,
		setHandle,
		refreshSnapshot,
		reset,
		onStart,
		onContinueRequested,
		onStop,
		onBreakUpdate,
	};
}
