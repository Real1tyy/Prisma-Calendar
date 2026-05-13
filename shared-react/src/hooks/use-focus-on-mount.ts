import { type RefObject, useEffect } from "react";

export interface UseFocusOnMountOptions {
	/** Delay before calling `.focus()`, in ms. 0 = same frame. Defaults to 0. */
	delayMs?: number;
	/** When false the effect is a no-op. Useful when the ref's owner mounts unconditionally but should only focus when "open". Defaults to true. */
	enabled?: boolean;
}

/**
 * Focus `ref.current` once the element is mounted. Optionally waits `delayMs`
 * before focusing — useful when the element needs a frame to settle (popover
 * positioning, modal entrance transition).
 *
 * The timer is cleaned up on unmount or when `enabled`/`delayMs` change, so
 * stale focus calls never land on the wrong element.
 */
export function useFocusOnMount<T extends HTMLElement>(
	ref: RefObject<T | null>,
	options?: UseFocusOnMountOptions
): void {
	const { delayMs = 0, enabled = true } = options ?? {};

	useEffect(() => {
		if (!enabled) return;
		if (delayMs <= 0) {
			ref.current?.focus();
			return;
		}
		const timer = window.setTimeout(() => ref.current?.focus(), delayMs);
		return () => window.clearTimeout(timer);
	}, [ref, enabled, delayMs]);
}
