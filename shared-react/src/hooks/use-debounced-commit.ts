import { useCallback, useEffect, useRef, useState } from "react";

export const DEBOUNCED_COMMIT_DEFAULT_MS = 300;

export interface UseDebouncedCommitOptions<T> {
	/** Canonical (external) value — source of truth when no local edit is pending. */
	value: T;
	/** Called when a debounced or forced commit runs. */
	onCommit: (next: T) => void;
	/** Delay between last edit and commit. Defaults to 300ms. */
	debounceMs?: number;
}

export interface DebouncedCommitHandle<T> {
	/** Current draft value — bind this to the DOM input. */
	draft: T;
	/**
	 * Update the draft and schedule a commit. Use on every keystroke / drag
	 * tick. Consecutive calls within `debounceMs` restart the timer.
	 */
	setDraft: (next: T) => void;
	/**
	 * Commit any pending draft right now (Enter / blur). No-op when nothing is
	 * pending.
	 */
	flush: () => void;
	/**
	 * Skip debouncing and commit `next` immediately. Useful for explicit actions
	 * like picking a date from a native picker.
	 */
	commitImmediate: (next: T) => void;
}

/**
 * Local-draft + trailing-debounce commit. The draft tracks user input at full
 * fidelity (so the DOM stays responsive) while the `onCommit` callback only
 * fires after `debounceMs` of inactivity, on `flush()`, or on `commitImmediate()`.
 *
 * External `value` updates are adopted into the draft only when no edit is
 * pending — otherwise a mid-typing re-render from the store would clobber the
 * user's in-flight input. The hook flushes any pending commit on unmount so
 * work-in-progress isn't lost if the parent unmounts the input.
 */
export function useDebouncedCommit<T>({
	value,
	onCommit,
	debounceMs = DEBOUNCED_COMMIT_DEFAULT_MS,
}: UseDebouncedCommitOptions<T>): DebouncedCommitHandle<T> {
	const [draft, setDraftState] = useState<T>(value);

	const pendingRef = useRef(false);
	const pendingValueRef = useRef<T>(value);
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const onCommitRef = useRef(onCommit);
	onCommitRef.current = onCommit;

	useEffect(() => {
		if (!pendingRef.current) {
			setDraftState(value);
		}
	}, [value]);

	const clearTimer = useCallback(() => {
		if (timeoutRef.current !== null) {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = null;
		}
	}, []);

	const flush = useCallback(() => {
		clearTimer();
		if (pendingRef.current) {
			const next = pendingValueRef.current;
			pendingRef.current = false;
			onCommitRef.current(next);
		}
	}, [clearTimer]);

	const setDraft = useCallback(
		(next: T) => {
			setDraftState(next);
			pendingValueRef.current = next;
			pendingRef.current = true;
			clearTimer();
			timeoutRef.current = setTimeout(() => {
				timeoutRef.current = null;
				if (pendingRef.current) {
					pendingRef.current = false;
					onCommitRef.current(pendingValueRef.current);
				}
			}, debounceMs);
		},
		[clearTimer, debounceMs]
	);

	const commitImmediate = useCallback(
		(next: T) => {
			clearTimer();
			pendingRef.current = false;
			pendingValueRef.current = next;
			setDraftState(next);
			onCommitRef.current(next);
		},
		[clearTimer]
	);

	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
			if (pendingRef.current) {
				pendingRef.current = false;
				onCommitRef.current(pendingValueRef.current);
			}
		};
	}, []);

	return { draft, setDraft, flush, commitImmediate };
}
