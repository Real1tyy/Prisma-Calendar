import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMediaQuery } from "../../src/hooks/dom/use-media-query";

/** A controllable `matchMedia` stand-in: set `matches`, then `emit()` to notify subscribers. */
function installMatchMedia(initialMatches: boolean) {
	const listeners = new Set<() => void>();
	const mql = {
		matches: initialMatches,
		media: "",
		addEventListener: (_event: "change", cb: () => void) => listeners.add(cb),
		removeEventListener: (_event: "change", cb: () => void) => listeners.delete(cb),
	};
	const matchMedia = vi.fn((query: string) => {
		mql.media = query;
		return mql as unknown as MediaQueryList;
	});
	window.matchMedia = matchMedia;
	return {
		matchMedia,
		set: (matches: boolean) => {
			mql.matches = matches;
		},
		emit: () => listeners.forEach((cb) => cb()),
		listenerCount: () => listeners.size,
	};
}

const QUERY = "(max-width: 768px)";
let original: typeof window.matchMedia;

beforeEach(() => {
	original = window.matchMedia;
});

afterEach(() => {
	window.matchMedia = original;
});

describe("useMediaQuery", () => {
	it("returns the current match state on mount", () => {
		installMatchMedia(true);
		const { result } = renderHook(() => useMediaQuery(QUERY));
		expect(result.current).toBe(true);
	});

	it("re-renders with the new value when the query flips", () => {
		const mm = installMatchMedia(false);
		const { result } = renderHook(() => useMediaQuery(QUERY));
		expect(result.current).toBe(false);

		act(() => {
			mm.set(true);
			mm.emit();
		});

		expect(result.current).toBe(true);
	});

	it("unsubscribes from the media query list on unmount", () => {
		const mm = installMatchMedia(false);
		const { unmount } = renderHook(() => useMediaQuery(QUERY));
		expect(mm.listenerCount()).toBe(1);

		unmount();

		expect(mm.listenerCount()).toBe(0);
	});

	it("returns false when matchMedia is unavailable (jsdom / SSR)", () => {
		(window as unknown as { matchMedia: undefined }).matchMedia = undefined;
		const { result } = renderHook(() => useMediaQuery(QUERY));
		expect(result.current).toBe(false);
	});
});
