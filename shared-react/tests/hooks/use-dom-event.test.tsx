import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useDomEvent } from "../../src/hooks/use-dom-event";

describe("useDomEvent", () => {
	it("attaches the listener on mount and fires when the event dispatches", () => {
		const cb = vi.fn();
		const target = document.createElement("div");
		renderHook(() => useDomEvent(target, "click", cb));

		target.dispatchEvent(new MouseEvent("click"));

		expect(cb).toHaveBeenCalledTimes(1);
	});

	it("detaches the listener on unmount", () => {
		const cb = vi.fn();
		const target = document.createElement("div");
		const { unmount } = renderHook(() => useDomEvent(target, "click", cb));

		unmount();
		target.dispatchEvent(new MouseEvent("click"));

		expect(cb).not.toHaveBeenCalled();
	});

	it("swaps the active callback across renders without re-subscribing", () => {
		const first = vi.fn();
		const second = vi.fn();
		const target = document.createElement("div");
		const addSpy = vi.spyOn(target, "addEventListener");

		const { rerender } = renderHook(({ cb }: { cb: () => void }) => useDomEvent(target, "click", cb), {
			initialProps: { cb: first },
		});

		target.dispatchEvent(new MouseEvent("click"));
		expect(first).toHaveBeenCalledTimes(1);

		rerender({ cb: second });
		target.dispatchEvent(new MouseEvent("click"));

		// Subscription is stable (single addEventListener call).
		expect(addSpy).toHaveBeenCalledTimes(1);
		// But the latest callback fires via the ref — first is not re-invoked.
		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
	});

	it("is a no-op when target is null", () => {
		expect(() => {
			renderHook(() => useDomEvent(null, "click", vi.fn()));
		}).not.toThrow();
	});

	it("resubscribes when the target changes", () => {
		const cb = vi.fn();
		const a = document.createElement("div");
		const b = document.createElement("div");

		const { rerender } = renderHook(({ target }: { target: HTMLElement }) => useDomEvent(target, "click", cb), {
			initialProps: { target: a },
		});

		a.dispatchEvent(new MouseEvent("click"));
		expect(cb).toHaveBeenCalledTimes(1);

		act(() => {
			rerender({ target: b });
		});

		a.dispatchEvent(new MouseEvent("click"));
		expect(cb).toHaveBeenCalledTimes(1);
		b.dispatchEvent(new MouseEvent("click"));
		expect(cb).toHaveBeenCalledTimes(2);
	});
});
