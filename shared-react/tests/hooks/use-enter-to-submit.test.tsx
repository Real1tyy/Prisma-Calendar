import { fireEvent, render, screen } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import { useEnterToSubmit } from "../../src/hooks/keyboard/use-enter-to-submit";

function Harness({ submit }: { submit: () => void }) {
	const onKeyDown = useEnterToSubmit<HTMLDivElement>(submit);
	return (
		<div onKeyDown={onKeyDown} data-testid="root">
			<input data-testid="input" />
			<textarea data-testid="textarea" />
			<button type="button" data-testid="button">
				go
			</button>
			<select data-testid="select">
				<option value="a">a</option>
			</select>
			<input data-testid="stopper" onKeyDown={(e) => e.stopPropagation()} />
		</div>
	);
}

describe("useEnterToSubmit", () => {
	it("fires submit when Enter is pressed in a plain input", () => {
		const submit = vi.fn();
		render(<Harness submit={submit} />);

		fireEvent.keyDown(screen.getByTestId("input"), { key: "Enter" });

		expect(submit).toHaveBeenCalledTimes(1);
	});

	it("ignores non-Enter keys", () => {
		const submit = vi.fn();
		render(<Harness submit={submit} />);

		fireEvent.keyDown(screen.getByTestId("input"), { key: "Escape" });
		fireEvent.keyDown(screen.getByTestId("input"), { key: "a" });

		expect(submit).not.toHaveBeenCalled();
	});

	it.each([
		["textarea", "textarea"],
		["button", "button"],
		["select", "select"],
	] as const)("skips Enter inside %s (native semantics)", (_label, testId) => {
		const submit = vi.fn();
		render(<Harness submit={submit} />);

		fireEvent.keyDown(screen.getByTestId(testId), { key: "Enter" });

		expect(submit).not.toHaveBeenCalled();
	});

	it("respects descendant stopPropagation (chip / tag input opt-out)", () => {
		const submit = vi.fn();
		render(<Harness submit={submit} />);

		fireEvent.keyDown(screen.getByTestId("stopper"), { key: "Enter" });

		expect(submit).not.toHaveBeenCalled();
	});

	it("calls preventDefault to suppress the default form submit", () => {
		const submit = vi.fn();
		render(<Harness submit={submit} />);

		const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
		const dispatched = fireEvent(screen.getByTestId("input"), event);

		expect(submit).toHaveBeenCalledTimes(1);
		expect(dispatched).toBe(false);
	});

	it("returns a stable handler across renders so memoized children don't re-bind", () => {
		const submit = vi.fn();
		const captured: Array<(e: KeyboardEvent<HTMLDivElement>) => void> = [];

		function CaptureHarness({ submit: s }: { submit: () => void }) {
			const onKeyDown = useEnterToSubmit<HTMLDivElement>(s);
			captured.push(onKeyDown);
			return <div onKeyDown={onKeyDown} data-testid="root" />;
		}

		const { rerender } = render(<CaptureHarness submit={submit} />);
		rerender(<CaptureHarness submit={() => submit()} />);
		rerender(<CaptureHarness submit={() => submit()} />);

		expect(captured[0]).toBe(captured[1]);
		expect(captured[1]).toBe(captured[2]);
	});

	it("invokes the latest submit closure even when handler identity is stable", () => {
		const first = vi.fn();
		const second = vi.fn();

		function StableHarness({ submit }: { submit: () => void }) {
			const onKeyDown = useEnterToSubmit<HTMLDivElement>(submit);
			return <input data-testid="input" onKeyDown={onKeyDown} />;
		}

		const { rerender } = render(<StableHarness submit={first} />);
		rerender(<StableHarness submit={second} />);

		fireEvent.keyDown(screen.getByTestId("input"), { key: "Enter" });

		expect(first).not.toHaveBeenCalled();
		expect(second).toHaveBeenCalledTimes(1);
	});
});
