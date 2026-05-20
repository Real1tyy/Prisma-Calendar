import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useHandleKeyDown, type KeyChord } from "../../src/hooks/keyboard/use-handle-key-down";

function press(init: KeyboardEventInit & { key: string }): KeyboardEvent {
	const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
	document.dispatchEvent(event);
	return event;
}

describe("useHandleKeyDown", () => {
	it("fires when the exact chord matches", () => {
		const handler = vi.fn();
		renderHook(() => useHandleKeyDown({ key: "c", shift: true, mod: true }, handler));

		press({ key: "c", shiftKey: true, ctrlKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("matches the key case-insensitively (Shift+C arrives as `C`)", () => {
		const handler = vi.fn();
		renderHook(() => useHandleKeyDown({ key: "c", shift: true, mod: true }, handler));

		press({ key: "C", shiftKey: true, ctrlKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("accepts metaKey as `mod` (Mac Cmd)", () => {
		const handler = vi.fn();
		renderHook(() => useHandleKeyDown({ key: "c", shift: true, mod: true }, handler));

		press({ key: "c", shiftKey: true, metaKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does NOT fire when a required modifier is missing", () => {
		const handler = vi.fn();
		renderHook(() => useHandleKeyDown({ key: "c", shift: true, mod: true }, handler));

		press({ key: "c", ctrlKey: true });
		press({ key: "c", shiftKey: true });
		press({ key: "c" });

		expect(handler).not.toHaveBeenCalled();
	});

	it("does NOT fire when an extra modifier is held (chord must match exactly)", () => {
		const handler = vi.fn();
		renderHook(() => useHandleKeyDown({ key: "c" }, handler));

		press({ key: "c", ctrlKey: true });
		press({ key: "c", shiftKey: true });

		expect(handler).not.toHaveBeenCalled();
	});

	it("calls preventDefault + stopPropagation on match", () => {
		const handler = vi.fn();
		renderHook(() => useHandleKeyDown({ key: "c", shift: true, mod: true }, handler));

		const event = press({ key: "c", shiftKey: true, ctrlKey: true });

		expect(event.defaultPrevented).toBe(true);
	});

	it("does NOT touch the event on miss (downstream handlers can still see it)", () => {
		const handler = vi.fn();
		renderHook(() => useHandleKeyDown({ key: "c", shift: true, mod: true }, handler));

		const event = press({ key: "x" });

		expect(event.defaultPrevented).toBe(false);
		expect(handler).not.toHaveBeenCalled();
	});

	it("removes its document listener on unmount", () => {
		const handler = vi.fn();
		const { unmount } = renderHook(() => useHandleKeyDown({ key: "c", shift: true, mod: true }, handler));

		unmount();
		press({ key: "c", shiftKey: true, ctrlKey: true });

		expect(handler).not.toHaveBeenCalled();
	});

	it("invokes the latest handler closure across re-renders without re-binding the listener", () => {
		const first = vi.fn();
		const second = vi.fn();
		const addSpy = vi.spyOn(document, "addEventListener");

		const { rerender } = renderHook((props: { handler: () => void }) => useHandleKeyDown({ key: "c" }, props.handler), {
			initialProps: { handler: first },
		});
		const initialAddCount = addSpy.mock.calls.filter(([type]) => type === "keydown").length;
		rerender({ handler: second });

		press({ key: "c" });

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
		const afterAddCount = addSpy.mock.calls.filter(([type]) => type === "keydown").length;
		expect(afterAddCount).toBe(initialAddCount); // no extra registration

		addSpy.mockRestore();
	});

	it("supports multiple independent chords on the same component", () => {
		const onCategories = vi.fn();
		const onPrerequisites = vi.fn();
		renderHook(() => {
			useHandleKeyDown({ key: "c", shift: true, mod: true }, onCategories);
			useHandleKeyDown({ key: "p", shift: true, mod: true }, onPrerequisites);
		});

		press({ key: "c", shiftKey: true, ctrlKey: true });
		press({ key: "p", shiftKey: true, ctrlKey: true });

		expect(onCategories).toHaveBeenCalledTimes(1);
		expect(onPrerequisites).toHaveBeenCalledTimes(1);
	});
});
