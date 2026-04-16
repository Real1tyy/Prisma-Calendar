import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useKeyDown } from "../../src/hooks/use-key-down";

function press(target: EventTarget, init: KeyboardEventInit): void {
	target.dispatchEvent(new KeyboardEvent("keydown", init));
}

describe("useKeyDown", () => {
	it("fires only when the key matches", () => {
		const target = document.createElement("div");
		const handler = vi.fn();
		renderHook(() => useKeyDown(target, "Enter", handler));

		press(target, { key: "Enter" });
		press(target, { key: "Escape" });
		press(target, { key: "a" });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("swallows auto-repeat events by default", () => {
		const target = document.createElement("div");
		const handler = vi.fn();
		renderHook(() => useKeyDown(target, "Enter", handler));

		press(target, { key: "Enter" });
		press(target, { key: "Enter", repeat: true });
		press(target, { key: "Enter", repeat: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("allows auto-repeat when `allowRepeat` is true", () => {
		const target = document.createElement("div");
		const handler = vi.fn();
		renderHook(() => useKeyDown(target, "ArrowDown", handler, { allowRepeat: true }));

		press(target, { key: "ArrowDown" });
		press(target, { key: "ArrowDown", repeat: true });
		press(target, { key: "ArrowDown", repeat: true });

		expect(handler).toHaveBeenCalledTimes(3);
	});

	it("detaches on unmount", () => {
		const target = document.createElement("div");
		const handler = vi.fn();
		const { unmount } = renderHook(() => useKeyDown(target, "Enter", handler));

		unmount();
		press(target, { key: "Enter" });

		expect(handler).not.toHaveBeenCalled();
	});
});
