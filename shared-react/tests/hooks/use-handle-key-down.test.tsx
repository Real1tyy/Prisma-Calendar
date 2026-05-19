import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useHandleKeyDown, type KeyChord } from "../../src/hooks/keyboard/use-handle-key-down";

function Harness({ chord, handler }: { chord: KeyChord; handler: () => void }) {
	const onKeyDown = useHandleKeyDown<HTMLDivElement>(chord, handler);
	return <div onKeyDown={onKeyDown} data-testid="root" />;
}

describe("useHandleKeyDown", () => {
	it("fires when the exact chord matches", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c", shift: true, mod: true }} handler={handler} />);

		fireEvent.keyDown(screen.getByTestId("root"), { key: "c", shiftKey: true, ctrlKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("treats key matching case-insensitively (Shift+C arrives as `C`)", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c", shift: true, mod: true }} handler={handler} />);

		fireEvent.keyDown(screen.getByTestId("root"), { key: "C", shiftKey: true, ctrlKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("accepts metaKey as `mod` (Mac Cmd)", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c", shift: true, mod: true }} handler={handler} />);

		fireEvent.keyDown(screen.getByTestId("root"), { key: "c", shiftKey: true, metaKey: true });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does NOT fire when a required modifier is missing", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c", shift: true, mod: true }} handler={handler} />);

		fireEvent.keyDown(screen.getByTestId("root"), { key: "c", ctrlKey: true });
		fireEvent.keyDown(screen.getByTestId("root"), { key: "c", shiftKey: true });
		fireEvent.keyDown(screen.getByTestId("root"), { key: "c" });

		expect(handler).not.toHaveBeenCalled();
	});

	it("does NOT fire when an extra modifier is held (chord must match exactly)", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c" }} handler={handler} />);

		fireEvent.keyDown(screen.getByTestId("root"), { key: "c", ctrlKey: true });
		fireEvent.keyDown(screen.getByTestId("root"), { key: "c", shiftKey: true });

		expect(handler).not.toHaveBeenCalled();
	});

	it("fires for bare `c` when no modifiers are configured", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c" }} handler={handler} />);

		fireEvent.keyDown(screen.getByTestId("root"), { key: "c" });

		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("calls preventDefault + stopPropagation on match", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c", shift: true, mod: true }} handler={handler} />);

		const event = new KeyboardEvent("keydown", {
			key: "c",
			shiftKey: true,
			ctrlKey: true,
			bubbles: true,
			cancelable: true,
		});
		const dispatched = fireEvent(screen.getByTestId("root"), event);

		expect(dispatched).toBe(false);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("does NOT touch the event on miss (downstream handlers can still see it)", () => {
		const handler = vi.fn();
		render(<Harness chord={{ key: "c", shift: true, mod: true }} handler={handler} />);

		const event = new KeyboardEvent("keydown", { key: "x", bubbles: true, cancelable: true });
		const dispatched = fireEvent(screen.getByTestId("root"), event);

		expect(dispatched).toBe(true);
		expect(handler).not.toHaveBeenCalled();
	});

	it("invokes the latest handler closure even when the returned function identity is stable", () => {
		const first = vi.fn();
		const second = vi.fn();

		function StableHarness({ handler }: { handler: () => void }) {
			const onKeyDown = useHandleKeyDown<HTMLDivElement>({ key: "c" }, handler);
			return <div onKeyDown={onKeyDown} data-testid="root" />;
		}

		const { rerender } = render(<StableHarness handler={first} />);
		rerender(<StableHarness handler={second} />);

		fireEvent.keyDown(screen.getByTestId("root"), { key: "c" });

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});
});
