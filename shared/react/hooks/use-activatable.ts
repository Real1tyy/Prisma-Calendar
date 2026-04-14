import type { KeyboardEventHandler, MouseEventHandler } from "react";
import { useCallback } from "react";

/**
 * Props produced by `useActivatable` that callers spread onto a focusable
 * non-native element (`<div>`, `<span>`) to give it button-like keyboard
 * semantics — Enter + Space activate, auto-repeat suppressed, modifier-key
 * combos ignored, focusable in tab order.
 *
 * Role is intentionally NOT included: the calling component knows whether it
 * is semantically a "button", "switch", "checkbox", etc. and sets that itself.
 *
 * All fields optional so that the hook can return `{}` when `onActivate` is
 * absent — no discriminated union for consumers to narrow.
 */
export interface ActivatableProps {
	tabIndex?: 0;
	onClick?: MouseEventHandler<HTMLElement>;
	onKeyDown?: KeyboardEventHandler<HTMLElement>;
}

/**
 * Behavioral hook for WAI-ARIA-style Enter/Space activation on a non-native
 * focusable element. Returns props to spread onto the rendered node; pass
 * `undefined` to opt out (hook still runs, returns an empty object — keeps
 * rules-of-hooks happy for conditionally-activatable components like `<Chip>`
 * whose label is only clickable when `onClick` is supplied).
 *
 * Wraps the one-liner pattern duplicated across every button-like primitive:
 *
 *     onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") ... }}
 *
 * One place to change the semantics instead of a dozen inline handlers.
 *
 * NOTE: Space currently activates on keydown, not keyup. Native `<button>`
 * activates Space on keyup only. For internal settings UIs this is acceptable;
 * if a consumer ever needs exact native semantics, split Space into a
 * keydown-press + keyup-activate pair.
 */
export function useActivatable(onActivate: (() => void) | undefined): ActivatableProps {
	const onClick = useCallback<MouseEventHandler<HTMLElement>>(() => {
		onActivate?.();
	}, [onActivate]);

	const onKeyDown = useCallback<KeyboardEventHandler<HTMLElement>>(
		(e) => {
			if (!onActivate) return;
			if (e.repeat) return;
			// Ignore modifier combos (Shift+Space, Ctrl+Enter, etc.) — callers that
			// want those should attach their own handler.
			if (e.altKey || e.ctrlKey || e.metaKey) return;
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				onActivate();
			}
		},
		[onActivate]
	);

	return onActivate ? { tabIndex: 0, onClick, onKeyDown } : {};
}
