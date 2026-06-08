import { useEffect, useRef } from "react";

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
 * Register a keyboard shortcut for the lifetime of the calling component.
 * Self-attaching — declaring the hook IS the registration; no onKeyDown
 * wrapper, no manual composition with other handlers. The listener lives on
 * `document` in capture phase so multiple shortcuts coexist cleanly.
 *
 * On match: `preventDefault` + `stopPropagation` fire and `handler` runs.
 * Modifier flags are checked both ways — `{ key: "c", shift: true, mod: true }`
 * matches **only** Mod+Shift+C, not bare C and not Mod+Alt+Shift+C.
 *
 * The latest `handler` closure is read through a ref so re-renders don't
 * re-bind the document listener every paint.
 */
export function useHandleKeyDown(chord: KeyChord, handler: () => void): void {
	const { key, shift = false, mod = false, alt = false } = chord;
	const handlerRef = useRef(handler);
	useEffect(() => {
		handlerRef.current = handler;
	});

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key.toLowerCase() !== key.toLowerCase()) return;
			if (shift !== event.shiftKey) return;
			const modPressed = event.metaKey || event.ctrlKey;
			if (mod !== modPressed) return;
			if (alt !== event.altKey) return;
			event.preventDefault();
			event.stopPropagation();
			handlerRef.current();
		};
		activeDocument.addEventListener("keydown", onKeyDown, true);
		return () => activeDocument.removeEventListener("keydown", onKeyDown, true);
	}, [key, shift, mod, alt]);
}
