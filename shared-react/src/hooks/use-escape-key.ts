import { useKeyDown } from "./use-key-down";

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
