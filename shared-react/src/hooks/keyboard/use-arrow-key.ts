import { useKeyDown } from "./use-key-down";

export interface UseArrowKeyOptions {
	/**
	 * When false, the listener is detached. Use to bind/unbind based on
	 * component-local state (e.g., only when an interval config is active).
	 */
	enabled?: boolean;
	/** Allow key auto-repeat. Default: false. */
	allowRepeat?: boolean;
	/**
	 * When true, the handler also fires while typing in an input. Default: false
	 * — arrow keys inside `INPUT` / `TEXTAREA` / `SELECT` / `contenteditable`
	 * are reserved for caret movement.
	 */
	captureInsideEditable?: boolean;
}

type ArrowKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return true;
	return target.isContentEditable;
}

/**
 * Generic arrow-key binding. Prefer the named wrappers (`useArrowLeft`,
 * `useArrowRight`, …) for call-site clarity; reach for `useArrowKey` directly
 * when the key is computed at runtime.
 */
export function useArrowKey(
	key: ArrowKey,
	handler: (e: KeyboardEvent) => void,
	target: Window | Document | HTMLElement | null = typeof window !== "undefined" ? window : null,
	options: UseArrowKeyOptions = {}
): void {
	const { enabled = true, allowRepeat = false, captureInsideEditable = false } = options;

	useKeyDown(
		enabled ? target : null,
		key,
		(e) => {
			if (e.defaultPrevented) return;
			if (!captureInsideEditable && isTypingTarget(e.target)) return;
			handler(e);
		},
		{ allowRepeat }
	);
}

/**
 * Fires `handler` on `target` when the user presses ArrowLeft. By default,
 * skips events whose target is an INPUT/TEXTAREA/SELECT/contenteditable, so
 * the hook doesn't hijack caret movement while typing.
 *
 * Defaults `target` to `window` — pass an element ref for popover/modal-scoped
 * bindings. The handler receives the raw event so callers can inspect
 * `shiftKey`, `ctrlKey`, etc. and call `e.preventDefault()` themselves.
 */
export function useArrowLeft(
	handler: (e: KeyboardEvent) => void,
	target?: Window | Document | HTMLElement | null,
	options?: UseArrowKeyOptions
): void {
	useArrowKey("ArrowLeft", handler, target, options);
}

/** Mirror of {@link useArrowLeft} for ArrowRight. */
export function useArrowRight(
	handler: (e: KeyboardEvent) => void,
	target?: Window | Document | HTMLElement | null,
	options?: UseArrowKeyOptions
): void {
	useArrowKey("ArrowRight", handler, target, options);
}

/** Mirror of {@link useArrowLeft} for ArrowUp. */
export function useArrowUp(
	handler: (e: KeyboardEvent) => void,
	target?: Window | Document | HTMLElement | null,
	options?: UseArrowKeyOptions
): void {
	useArrowKey("ArrowUp", handler, target, options);
}

/** Mirror of {@link useArrowLeft} for ArrowDown. */
export function useArrowDown(
	handler: (e: KeyboardEvent) => void,
	target?: Window | Document | HTMLElement | null,
	options?: UseArrowKeyOptions
): void {
	useArrowKey("ArrowDown", handler, target, options);
}
