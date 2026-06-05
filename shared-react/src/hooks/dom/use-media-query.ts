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
			const matchMedia = getMatchMedia();
			if (!matchMedia) return () => {};
			const mql = matchMedia(query);
			mql.addEventListener("change", onChange);
			return () => mql.removeEventListener("change", onChange);
		},
		[query]
	);

	const getSnapshot = (): boolean => {
		const matchMedia = getMatchMedia();
		return matchMedia ? matchMedia(query).matches : false;
	};

	return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * `lib.dom` types `window.matchMedia` as always present, but it is absent under
 * SSR and in jsdom test envs that don't implement it — read it through a
 * nullable lens so the runtime guard stays honest instead of being optimised
 * away by `no-unnecessary-condition`.
 */
function getMatchMedia(): typeof window.matchMedia | undefined {
	if (typeof window === "undefined") return undefined;
	return window.matchMedia;
}
