import { screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { NumberInput } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

function ControlledHarness({
	initial = 0,
	onCommit,
	debounceMs,
}: {
	initial?: number;
	onCommit?: (v: number) => void;
	debounceMs?: number;
}) {
	const [value, setValue] = useState(initial);
	return (
		<NumberInput
			value={value}
			debounceMs={debounceMs ?? 300}
			onChange={(v) => {
				setValue(v);
				onCommit?.(v);
			}}
		/>
	);
}

describe("NumberInput", () => {
	it("renders the `value` prop", () => {
		renderReact(<NumberInput value={7} onChange={vi.fn()} />);
		expect(screen.getByRole("spinbutton")).toHaveValue(7);
	});

	it("commits the parsed number once after the debounce window", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={20} />);
		const input = screen.getByRole("spinbutton");

		await user.click(input);
		await user.keyboard("42");

		await waitFor(() => {
			expect(onCommit).toHaveBeenCalledTimes(1);
		});
		expect(onCommit).toHaveBeenCalledWith(42);
		expect(input).toHaveValue(42);
	});

	it("skips emission when the input is not a valid number", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness initial={5} onCommit={onCommit} debounceMs={20} />);
		const input = screen.getByRole("spinbutton");

		await user.clear(input);
		// Wait past the debounce window so any accidental commit would land.
		await new Promise((r) => setTimeout(r, 40));

		// Clearing an `<input type=number>` yields NaN via valueAsNumber; the
		// component swallows the event instead of emitting NaN downstream.
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("commits immediately on Enter", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={5_000} />);
		const input = screen.getByRole("spinbutton");

		await user.click(input);
		await user.keyboard("42");
		await user.keyboard("{Enter}");

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith(42);
	});

	it("forwards min/max/step as HTML attributes", () => {
		renderReact(<NumberInput value={5} min={0} max={10} step={2} onChange={vi.fn()} />);
		const input = screen.getByRole("spinbutton");

		expect(input).toHaveAttribute("min", "0");
		expect(input).toHaveAttribute("max", "10");
		expect(input).toHaveAttribute("step", "2");
	});

	it("reflects external `value` updates from the parent when no edit is pending", () => {
		const { rerender } = renderReact(<NumberInput value={1} onChange={vi.fn()} />);
		expect(screen.getByRole("spinbutton")).toHaveValue(1);

		rerender(<NumberInput value={9} onChange={vi.fn()} />);
		expect(screen.getByRole("spinbutton")).toHaveValue(9);
	});
});
