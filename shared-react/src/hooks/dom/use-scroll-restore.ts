import { type RefCallback, useCallback, useRef } from "react";

/**
 * Persists and restores the scroll position of a parent container across
 * component mount/unmount cycles. Attach the returned ref callback to any
 * child element — the hook walks up the DOM to find the scrollable ancestor
 * matched by `parentSelector` and manages its `scrollTop`.
 *
 * `scrollState` must be a mutable object that outlives the component (e.g. a
 * property on the plugin instance, a module-level variable, or a React ref
 * lifted to a parent that never unmounts). The hook reads `.current` on mount
 * and writes it on every scroll event so it is always up-to-date — even if
 * the DOM is torn down before the unmount effect fires.
 */
export function useScrollRestore(scrollState: { current: number }, parentSelector: string): RefCallback<HTMLElement> {
	const cleanupRef = useRef<(() => void) | null>(null);

	return useCallback(
		(node: HTMLElement | null) => {
			cleanupRef.current?.();
			cleanupRef.current = null;

			if (!node) return;

			const scrollParent = node.closest(parentSelector);
			if (!scrollParent) return;

			if (scrollState.current) {
				window.requestAnimationFrame(() => {
					scrollParent.scrollTop = scrollState.current;
				});
			}

			const onScroll = () => {
				scrollState.current = scrollParent.scrollTop;
			};
			scrollParent.addEventListener("scroll", onScroll, { passive: true });

			cleanupRef.current = () => {
				scrollParent.removeEventListener("scroll", onScroll);
			};
		},
		[scrollState, parentSelector]
	);
}
