import { useCallback, useSyncExternalStore } from "react";

/**
 * Reactively track whether a CSS media query currently matches, re-rendering the
 * component when it flips (viewport resize, device rotation, `emulateMobile`).
 *
 * Built on `useSyncExternalStore` — React's purpose-built primitive for
 * subscribing to a browser store — rather than a `useEffect`+`useState` pair, so
 * it reads a tear-free value even under concurrent rendering. Returns `false`
 * when `window.matchMedia` is unavailable (SSR, or a jsdom test env that doesn't
 * implement it), which keeps the desktop layout the safe default.
 */
export function useMediaQuery(query: string): boolean {
	const subscribe = useCallback(
		(onChange: () => void) => {
			if (typeof window === "undefined" || !window.matchMedia) return () => {};
			const mql = window.matchMedia(query);
			mql.addEventListener("change", onChange);
			return () => mql.removeEventListener("change", onChange);
		},
		[query]
	);

	const getSnapshot = (): boolean =>
		typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(query).matches;

	return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
