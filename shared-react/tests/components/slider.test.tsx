import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { Slider } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

function ControlledHarness({
	initial = 5,
	min = 0,
	max = 10,
	onCommit,
	debounceMs,
}: {
	initial?: number;
	min?: number;
	max?: number;
	onCommit?: (v: number) => void;
	debounceMs?: number;
}) {
	const [value, setValue] = useState(initial);
	return (
		<Slider
			value={value}
			min={min}
			max={max}
			debounceMs={debounceMs ?? 300}
			onChange={(v) => {
				setValue(v);
				onCommit?.(v);
			}}
		/>
	);
}

describe("Slider", () => {
	it("mounts a range input inside the host span", () => {
		renderReact(<Slider value={5} min={0} max={10} onChange={vi.fn()} />);
		const range = screen.getByRole("slider") as HTMLInputElement;

		expect(range).toHaveValue("5");
		expect(range).toHaveAttribute("min", "0");
		expect(range).toHaveAttribute("max", "10");
	});

	it("forwards step to the range input", () => {
		renderReact(<Slider value={5} min={0} max={100} step={5} onChange={vi.fn()} />);
		const range = screen.getByRole("slider") as HTMLInputElement;

		expect(range).toHaveAttribute("step", "5");
	});

	it("emits a single debounced onChange after a burst of drag ticks", async () => {
		const onCommit = vi.fn();
		renderReact(<ControlledHarness onCommit={onCommit} min={0} max={10} debounceMs={20} />);
		const range = screen.getByRole("slider") as HTMLInputElement;

		fireEvent.input(range, { target: { value: "3" } });
		fireEvent.input(range, { target: { value: "5" } });
		fireEvent.input(range, { target: { value: "7" } });

		await waitFor(() => {
			expect(onCommit).toHaveBeenCalledTimes(1);
		});
		expect(onCommit).toHaveBeenLastCalledWith(7);
	});

	it("flushes on pointerup (end of drag)", () => {
		const onCommit = vi.fn();
		renderReact(<ControlledHarness onCommit={onCommit} min={0} max={10} debounceMs={5_000} />);
		const range = screen.getByRole("slider") as HTMLInputElement;

		fireEvent.input(range, { target: { value: "7" } });
		// The Obsidian SliderComponent doesn't emit `onChange`; we depend on the
		// `pointerup`/`change`/`blur` listeners we register to flush the draft.
		fireEvent.pointerUp(range);

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenLastCalledWith(7);
	});

	it("reflects external `value` updates from the parent when no edit is pending", () => {
		const { rerender } = renderReact(<Slider value={3} min={0} max={10} onChange={vi.fn()} />);
		expect(screen.getByRole("slider")).toHaveValue("3");

		rerender(<Slider value={8} min={0} max={10} onChange={vi.fn()} />);

		expect(screen.getByRole("slider")).toHaveValue("8");
	});
});
