import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useScrollRestore } from "../../src/hooks/dom/use-scroll-restore";

function createScrollableDOM(): { child: HTMLElement; scrollParent: HTMLElement } {
	const scrollParent = document.createElement("div");
	scrollParent.classList.add("scroll-container");
	Object.defineProperty(scrollParent, "scrollTop", { value: 0, writable: true });

	const child = document.createElement("div");
	scrollParent.appendChild(child);
	document.body.appendChild(scrollParent);

	return { child, scrollParent };
}

function simulateScroll(el: HTMLElement, position: number): void {
	el.scrollTop = position;
	el.dispatchEvent(new Event("scroll"));
}

describe("useScrollRestore", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("restores saved scroll position on mount", () => {
		const { child, scrollParent } = createScrollableDOM();
		const state = { current: 150 };

		const { result } = renderHook(() => useScrollRestore(state, ".scroll-container"));

		act(() => {
			result.current(child);
		});

		act(() => {
			vi.advanceTimersByTime(16);
		});
		expect(scrollParent.scrollTop).toBe(150);

		document.body.removeChild(scrollParent);
	});

	it("does not restore when state is 0", () => {
		const { child, scrollParent } = createScrollableDOM();
		const state = { current: 0 };

		const { result } = renderHook(() => useScrollRestore(state, ".scroll-container"));

		act(() => {
			result.current(child);
		});

		expect(scrollParent.scrollTop).toBe(0);

		document.body.removeChild(scrollParent);
	});

	it("saves scroll position on scroll events", () => {
		const { child, scrollParent } = createScrollableDOM();
		const state = { current: 0 };

		const { result } = renderHook(() => useScrollRestore(state, ".scroll-container"));

		act(() => {
			result.current(child);
		});

		simulateScroll(scrollParent, 300);
		expect(state.current).toBe(300);

		simulateScroll(scrollParent, 500);
		expect(state.current).toBe(500);

		document.body.removeChild(scrollParent);
	});

	it("stops listening when ref detaches", () => {
		const { child, scrollParent } = createScrollableDOM();
		const state = { current: 0 };

		const { result } = renderHook(() => useScrollRestore(state, ".scroll-container"));

		act(() => {
			result.current(child);
		});

		simulateScroll(scrollParent, 200);
		expect(state.current).toBe(200);

		act(() => {
			result.current(null);
		});

		simulateScroll(scrollParent, 999);
		expect(state.current).toBe(200);

		document.body.removeChild(scrollParent);
	});

	it("does not throw when parent selector has no match", () => {
		const orphan = document.createElement("div");
		document.body.appendChild(orphan);
		const state = { current: 100 };

		const { result } = renderHook(() => useScrollRestore(state, ".nonexistent"));

		expect(() => {
			act(() => {
				result.current(orphan);
			});
		}).not.toThrow();

		document.body.removeChild(orphan);
	});

	it("does not throw when ref callback receives null immediately", () => {
		const state = { current: 50 };

		const { result } = renderHook(() => useScrollRestore(state, ".scroll-container"));

		expect(() => {
			act(() => {
				result.current(null);
			});
		}).not.toThrow();
	});
});
