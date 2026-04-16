import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useEscapeKey } from "../../src/hooks/use-escape-key";

function press(target: EventTarget, key: string): void {
	target.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

describe("useEscapeKey", () => {
	it("fires on Escape against the document by default", () => {
		const handler = vi.fn();
		renderHook(() => useEscapeKey(handler));

		press(document, "Escape");

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("ignores non-Escape keys", () => {
		const handler = vi.fn();
		renderHook(() => useEscapeKey(handler));

		press(document, "Enter");
		press(document, "a");

		expect(handler).not.toHaveBeenCalled();
	});

	it("scopes to an explicit target when provided", () => {
		const handler = vi.fn();
		const el = document.createElement("div");
		renderHook(() => useEscapeKey(handler, el));

		press(document, "Escape");
		expect(handler).not.toHaveBeenCalled();

		press(el, "Escape");
		expect(handler).toHaveBeenCalledTimes(1);
	});
});
