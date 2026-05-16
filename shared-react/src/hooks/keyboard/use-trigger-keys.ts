import { useKeyDown } from "./use-key-down";

export interface UseEnterKeyOptions {
	/** When true, only fire on Ctrl+Enter / Cmd+Enter. Default: false. */
	requireModifier?: boolean;
	/** Allow key auto-repeat. Default: false. */
	allowRepeat?: boolean;
}

/**
 * Fires `handler` when the user presses Enter on `target`. Defaults to the
 * document — pass a specific element for scoped "submit" semantics inside
 * inline editors or forms.
 *
 * With `requireModifier`, only Ctrl+Enter / Cmd+Enter triggers — matches the
 * existing commit-on-modifier convention used by `TextInput`.
 */
export function useEnterKey(
	handler: (e: KeyboardEvent) => void,
	target: Window | Document | HTMLElement | null = typeof document !== "undefined" ? document : null,
	options: UseEnterKeyOptions = {}
): void {
	const { requireModifier = false, allowRepeat = false } = options;
	useKeyDown(
		target,
		"Enter",
		(e) => {
			if (requireModifier && !(e.ctrlKey || e.metaKey)) return;
			handler(e);
		},
		{ allowRepeat }
	);
}

/**
 * Fires `handler` when the user presses Escape on `target` (defaults to the
 * document, which is the natural scope for modal/popover close semantics).
 *
 * Use this everywhere the UI needs "press Esc to dismiss" — dialogs, popovers,
 * inline editors, stopwatch. Having one canonical hook means dismissal
 * semantics (repeat suppression, event target) stay consistent across the app.
 */
export function useEscapeKey(
	handler: (e: KeyboardEvent) => void,
	target: Window | Document | HTMLElement | null = typeof document !== "undefined" ? document : null
): void {
	useKeyDown(target, "Escape", handler);
}
