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
 *
 * `onCommit` is snapshotted on every `setDraft` call. Trailing-timer, `flush`,
 * and unmount commits all invoke the snapshotted callback — NOT the one live
 * at commit time. Without this, a parent re-render that swaps `onCommit` to a
 * new target (e.g. a settings pane re-bound to a different entity mid-type)
 * would route the pending draft to the new target, silently corrupting the
 * wrong record. `commitImmediate` still uses the latest `onCommit` because
 * it represents a fresh explicit action, not a deferred older edit.
 */
export function useDebouncedCommit<T>({
	value,
	onCommit,
	debounceMs = DEBOUNCED_COMMIT_DEFAULT_MS,
}: UseDebouncedCommitOptions<T>): DebouncedCommitHandle<T> {
	const [draft, setDraftState] = useState<T>(value);

	const pendingRef = useRef(false);
	const pendingValueRef = useRef<T>(value);
	const pendingCommitRef = useRef<((next: T) => void) | null>(null);
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
			const commit = pendingCommitRef.current ?? onCommitRef.current;
			pendingRef.current = false;
			pendingCommitRef.current = null;
			commit(next);
		}
	}, [clearTimer]);

	const setDraft = useCallback(
		(next: T) => {
			setDraftState(next);
			pendingValueRef.current = next;
			pendingRef.current = true;
			pendingCommitRef.current = onCommitRef.current;
			clearTimer();
			timeoutRef.current = setTimeout(() => {
				timeoutRef.current = null;
				if (pendingRef.current) {
					const commit = pendingCommitRef.current ?? onCommitRef.current;
					pendingRef.current = false;
					pendingCommitRef.current = null;
					commit(pendingValueRef.current);
				}
			}, debounceMs);
		},
		[clearTimer, debounceMs]
	);

	const commitImmediate = useCallback(
		(next: T) => {
			clearTimer();
			pendingRef.current = false;
			pendingCommitRef.current = null;
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
				const commit = pendingCommitRef.current ?? onCommitRef.current;
				pendingRef.current = false;
				pendingCommitRef.current = null;
				commit(pendingValueRef.current);
			}
		};
	}, []);

	return { draft, setDraft, flush, commitImmediate };
}
