import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEnterKey } from "../../src/hooks/use-enter-key";

function press(target: EventTarget, init: KeyboardEventInit): void {
	target.dispatchEvent(new KeyboardEvent("keydown", init));
}

describe("useEnterKey", () => {
	it("fires on plain Enter by default", () => {
		const handler = vi.fn();
		renderHook(() => useEnterKey(handler));

		press(document, { key: "Enter" });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("requires Ctrl/Meta when `requireModifier` is set", () => {
		const handler = vi.fn();
		renderHook(() => useEnterKey(handler, document, { requireModifier: true }));

		press(document, { key: "Enter" });
		expect(handler).not.toHaveBeenCalled();

		press(document, { key: "Enter", ctrlKey: true });
		expect(handler).toHaveBeenCalledTimes(1);

		press(document, { key: "Enter", metaKey: true });
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it("scopes to an explicit target when provided", () => {
		const handler = vi.fn();
		const el = document.createElement("div");
		renderHook(() => useEnterKey(handler, el));

		press(document, { key: "Enter" });
		expect(handler).not.toHaveBeenCalled();

		press(el, { key: "Enter" });
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
