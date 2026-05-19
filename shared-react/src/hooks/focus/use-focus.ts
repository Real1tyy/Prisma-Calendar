import { useEffect, type RefObject } from "react";

export interface UseFocusOnMountOptions {
	/** Delay before calling `.focus()`, in ms. 0 = immediately when the effect runs. Defaults to 0. */
	delayMs?: number;
	/** When false the effect is a no-op. Useful when the ref's owner mounts unconditionally but should only focus when "open". Defaults to true. */
	enabled?: boolean;
	/**
	 * After the initial focus, keep retrying via `requestAnimationFrame` for up
	 * to this many ms. Defends against host frameworks that asynchronously
	 * steal focus after our first attempt — e.g. Obsidian's two-step "activate
	 * workspace leaf, then handle modal" path when a modal is opened from the
	 * command palette / ribbon / hotkey. The retry stops as soon as the user
	 * interacts (pointerdown / keydown anywhere) so we never steal focus from
	 * a deliberate click. Default 0 = no retry.
	 */
	retryMs?: number;
}

/**
 * Focus `ref.current` once the element is mounted. Optionally waits `delayMs`
 * before focusing (useful when the element needs a frame to settle), and
 * optionally polls focus for `retryMs` to outlast late focus-stealing.
 *
 * When either `delayMs` or `retryMs` is > 0 the hook watches for a user
 * `pointerdown` / `keydown` (capture phase) and bails out — so a click that
 * lands during the delay or the retry window is never overridden.
 *
 * All timers/listeners are scoped to the element's `ownerDocument` /
 * `defaultView` so popout windows resolve to the correct context.
 */
export function useFocusOnMount<T extends HTMLElement>(
	ref: RefObject<T | null>,
	options?: UseFocusOnMountOptions
): void {
	const { delayMs = 0, enabled = true, retryMs = 0 } = options ?? {};

	useEffect(() => {
		if (!enabled) return;

		let cancelled = false;
		let userInterrupted = false;
		let rafId: number | null = null;
		let timer: number | null = null;

		const doc = ref.current?.ownerDocument ?? document;
		const win = doc.defaultView ?? window;

		const stopForUserInteraction = () => {
			userInterrupted = true;
		};

		const focus = () => {
			const el = ref.current;
			if (!el || !el.isConnected) return;
			if (el.ownerDocument.activeElement !== el) el.focus();
		};

		const shouldWatchUserInteraction = delayMs > 0 || retryMs > 0;
		if (shouldWatchUserInteraction) {
			doc.addEventListener("pointerdown", stopForUserInteraction, true);
			doc.addEventListener("keydown", stopForUserInteraction, true);
		}

		const start = () => {
			if (cancelled || userInterrupted) return;
			focus();
			if (retryMs <= 0) return;

			const deadline = performance.now() + retryMs;
			const tick = () => {
				if (cancelled || userInterrupted) return;
				focus();
				if (performance.now() < deadline) {
					rafId = win.requestAnimationFrame(tick);
				}
			};
			rafId = win.requestAnimationFrame(tick);
		};

		if (delayMs <= 0) {
			start();
		} else {
			timer = win.setTimeout(start, delayMs);
		}

		return () => {
			cancelled = true;
			if (timer !== null) win.clearTimeout(timer);
			if (rafId !== null) win.cancelAnimationFrame(rafId);
			if (shouldWatchUserInteraction) {
				doc.removeEventListener("pointerdown", stopForUserInteraction, true);
				doc.removeEventListener("keydown", stopForUserInteraction, true);
			}
		};
	}, [ref, enabled, delayMs, retryMs]);
}

/**
 * Focus the referenced element whenever the active index matches the row's
 * own index. Used by keyboard-navigated lists (menus, autocomplete) where the
 * parent owns selection state and children just react to it.
 */
export function useFocusOnIndex(ref: RefObject<HTMLElement | null>, index: number, focusIndex: number): void {
	useEffect(() => {
		if (focusIndex === index) ref.current?.focus();
	}, [ref, focusIndex, index]);
}
