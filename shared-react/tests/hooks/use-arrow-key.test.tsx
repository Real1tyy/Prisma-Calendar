import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
	useArrowDown,
	useArrowKey,
	useArrowLeft,
	useArrowRight,
	useArrowUp,
} from "../../src/hooks/keyboard/use-arrow-key";

function press(target: EventTarget, init: KeyboardEventInit): void {
	target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

describe("useArrowLeft / useArrowRight / useArrowUp / useArrowDown", () => {
	it("fires the matching handler on its key only", () => {
		const left = vi.fn();
		const right = vi.fn();
		const up = vi.fn();
		const down = vi.fn();
		renderHook(() => {
			useArrowLeft(left, document);
			useArrowRight(right, document);
			useArrowUp(up, document);
			useArrowDown(down, document);
		});

		press(document, { key: "ArrowLeft" });
		press(document, { key: "ArrowRight" });
		press(document, { key: "ArrowUp" });
		press(document, { key: "ArrowDown" });

		expect(left).toHaveBeenCalledTimes(1);
		expect(right).toHaveBeenCalledTimes(1);
		expect(up).toHaveBeenCalledTimes(1);
		expect(down).toHaveBeenCalledTimes(1);
	});

	it("non-arrow keys do not trigger the handlers", () => {
		const left = vi.fn();
		renderHook(() => useArrowLeft(left, document));

		press(document, { key: "Enter" });
		press(document, { key: "a" });
		press(document, { key: "Escape" });

		expect(left).not.toHaveBeenCalled();
	});

	it("passes the raw event so callers can read shiftKey / preventDefault", () => {
		const handler = vi.fn();
		renderHook(() => useArrowRight(handler, document));

		press(document, { key: "ArrowRight", shiftKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
		const e = handler.mock.calls[0]?.[0] as KeyboardEvent;
		expect(e.shiftKey).toBe(true);
		expect(typeof e.preventDefault).toBe("function");
	});

	it("skips events whose target is an INPUT (default — does not hijack typing)", () => {
		const handler = vi.fn();
		renderHook(() => useArrowLeft(handler, document));

		const input = document.createElement("input");
		document.body.appendChild(input);
		try {
			press(input, { key: "ArrowLeft" });
		} finally {
			input.remove();
		}
		expect(handler).not.toHaveBeenCalled();
	});

	it("skips events whose target is a TEXTAREA or SELECT", () => {
		const handler = vi.fn();
		renderHook(() => useArrowLeft(handler, document));

		const textarea = document.createElement("textarea");
		const select = document.createElement("select");
		document.body.append(textarea, select);
		try {
			press(textarea, { key: "ArrowLeft" });
			press(select, { key: "ArrowLeft" });
		} finally {
			textarea.remove();
			select.remove();
		}
		expect(handler).not.toHaveBeenCalled();
	});

	it("skips events whose target is contenteditable", () => {
		const handler = vi.fn();
		renderHook(() => useArrowLeft(handler, document));

		const div = document.createElement("div");
		// jsdom doesn't derive `isContentEditable` from the attribute, so stub it
		// to mirror the browser path the production guard relies on.
		Object.defineProperty(div, "isContentEditable", { value: true, configurable: true });
		document.body.appendChild(div);
		try {
			press(div, { key: "ArrowLeft" });
		} finally {
			div.remove();
		}
		expect(handler).not.toHaveBeenCalled();
	});

	it("respects captureInsideEditable when explicitly opted in", () => {
		const handler = vi.fn();
		renderHook(() => useArrowLeft(handler, document, { captureInsideEditable: true }));

		const input = document.createElement("input");
		document.body.appendChild(input);
		try {
			press(input, { key: "ArrowLeft" });
		} finally {
			input.remove();
		}
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does not fire when enabled is false (and rebinds when toggled back on)", () => {
		const handler = vi.fn();
		const { rerender } = renderHook(
			({ enabled }: { enabled: boolean }) => useArrowLeft(handler, document, { enabled }),
			{
				initialProps: { enabled: false },
			}
		);

		press(document, { key: "ArrowLeft" });
		expect(handler).not.toHaveBeenCalled();

		rerender({ enabled: true });
		press(document, { key: "ArrowLeft" });
		expect(handler).toHaveBeenCalledTimes(1);

		rerender({ enabled: false });
		press(document, { key: "ArrowLeft" });
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("skips repeat events by default", () => {
		const handler = vi.fn();
		renderHook(() => useArrowLeft(handler, document));

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", repeat: true, bubbles: true }));
		expect(handler).not.toHaveBeenCalled();

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", repeat: false, bubbles: true }));
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("allows repeat events when allowRepeat is true", () => {
		const handler = vi.fn();
		renderHook(() => useArrowLeft(handler, document, { allowRepeat: true }));

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", repeat: true, bubbles: true }));
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", repeat: true, bubbles: true }));
		expect(handler).toHaveBeenCalledTimes(2);
	});

	it("scopes to an explicit element target instead of the global default", () => {
		const handler = vi.fn();
		const el = document.createElement("div");
		document.body.appendChild(el);
		renderHook(() => useArrowLeft(handler, el));

		press(document, { key: "ArrowLeft" });
		expect(handler).not.toHaveBeenCalled();

		press(el, { key: "ArrowLeft" });
		expect(handler).toHaveBeenCalledTimes(1);

		el.remove();
	});

	it("useArrowKey forwards to the named hooks for runtime-chosen keys", () => {
		const handler = vi.fn();
		const { rerender } = renderHook(({ k }: { k: "ArrowLeft" | "ArrowRight" }) => useArrowKey(k, handler, document), {
			initialProps: { k: "ArrowLeft" },
		});

		press(document, { key: "ArrowLeft" });
		press(document, { key: "ArrowRight" });
		expect(handler).toHaveBeenCalledTimes(1);

		rerender({ k: "ArrowRight" });
		press(document, { key: "ArrowLeft" });
		press(document, { key: "ArrowRight" });
		expect(handler).toHaveBeenCalledTimes(2);
	});
});
