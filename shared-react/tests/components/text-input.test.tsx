import { act, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TextInput } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

function ControlledHarness({
	initial = "",
	onCommit,
	debounceMs,
}: {
	initial?: string;
	onCommit?: (v: string) => void;
	debounceMs?: number;
}) {
	const [value, setValue] = useState(initial);
	return (
		<TextInput
			value={value}
			debounceMs={debounceMs ?? 300}
			onChange={(v) => {
				setValue(v);
				onCommit?.(v);
			}}
		/>
	);
}

describe("TextInput", () => {
	it("renders the `value` prop and `placeholder`", () => {
		renderReact(<TextInput value="hello" placeholder="type here" onChange={vi.fn()} />);
		const input = screen.getByRole("textbox") as HTMLInputElement;

		expect(input).toHaveValue("hello");
		expect(input).toHaveAttribute("placeholder", "type here");
	});

	it("updates the visible draft on every keystroke without emitting onChange synchronously", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={300} />);
		const input = screen.getByRole("textbox") as HTMLInputElement;

		await user.type(input, "abc");

		// Draft reflects each keystroke …
		expect(input).toHaveValue("abc");
		// … but the commit hasn't fired yet — the debounce window hasn't elapsed.
		expect(onCommit).not.toHaveBeenCalled();
	});

	it("emits a single onChange with the final value after the debounce window", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={20} />);
		const input = screen.getByRole("textbox");

		await user.type(input, "abc");

		await waitFor(() => {
			expect(onCommit).toHaveBeenCalledTimes(1);
		});
		expect(onCommit).toHaveBeenCalledWith("abc");
	});

	it("commits immediately on Enter", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={5_000} />);
		const input = screen.getByRole("textbox");

		await user.type(input, "abc");
		await user.keyboard("{Enter}");

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("abc");
	});

	it("commits immediately on blur", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={5_000} />);
		const input = screen.getByRole("textbox") as HTMLInputElement;

		await user.type(input, "abc");
		await act(async () => {
			input.blur();
		});

		expect(onCommit).toHaveBeenCalledTimes(1);
		expect(onCommit).toHaveBeenCalledWith("abc");
	});

	it("reflects external `value` updates from the parent when no edit is pending", () => {
		const { rerender } = renderReact(<TextInput value="first" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("first");

		rerender(<TextInput value="second" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("second");
	});
});
