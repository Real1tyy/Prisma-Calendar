import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";

export interface KeyChord {
	/** Bare key name. Matched case-insensitively (`"c"` matches Shift+C). */
	key: string;
	/** Require Shift to be held. */
	shift?: boolean;
	/** Require Ctrl (Win/Linux) or Cmd (Mac). */
	mod?: boolean;
	/** Require Alt / Option. */
	alt?: boolean;
}

/**
 * React `onKeyDown` handler that fires `handler` only when the chord matches
 * exactly — modifier flags are checked both ways (Shift+C does not match
 * `{ key: "c" }` unless `shift: true` is set). On match, `preventDefault` and
 * `stopPropagation` are applied so callers can layer multiple chord handlers
 * with `defaultPrevented` as the short-circuit.
 *
 * Handler identity is stable across renders — the latest `handler` is read
 * through a ref so memoised children that receive the returned function never
 * re-render just because the parent's closure changed.
 */
export function useHandleKeyDown<T extends HTMLElement = HTMLDivElement>(
	chord: KeyChord,
	handler: () => void
): (event: KeyboardEvent<T>) => void {
	const { key, shift = false, mod = false, alt = false } = chord;
	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	});

	return useCallback(
		(event: KeyboardEvent<T>) => {
			if (event.key.toLowerCase() !== key.toLowerCase()) return;
			if (shift !== event.shiftKey) return;
			const modPressed = event.metaKey || event.ctrlKey;
			if (mod !== modPressed) return;
			if (alt !== event.altKey) return;
			event.preventDefault();
			event.stopPropagation();
			handlerRef.current();
		},
		[key, shift, mod, alt]
	);
}
