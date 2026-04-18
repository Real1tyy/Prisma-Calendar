import { screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TextareaInput } from "../../src/components/setting-controls";
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
		<TextareaInput
			value={value}
			debounceMs={debounceMs ?? 300}
			onChange={(v) => {
				setValue(v);
				onCommit?.(v);
			}}
		/>
	);
}

describe("TextareaInput", () => {
	it("renders the `value` prop and defaults to 4 rows", () => {
		renderReact(<TextareaInput value="hello" onChange={vi.fn()} />);
		const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;

		expect(textarea).toHaveValue("hello");
		expect(textarea).toHaveAttribute("rows", "4");
	});

	it("applies a custom row count", () => {
		renderReact(<TextareaInput value="" rows={10} onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveAttribute("rows", "10");
	});

	it("applies the placeholder", () => {
		renderReact(<TextareaInput value="" placeholder="write something" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "write something");
	});

	it("emits a single onChange with the final value after the debounce window", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={20} />);

		await user.type(screen.getByRole("textbox"), "abc");

		await waitFor(() => {
			expect(onCommit).toHaveBeenCalledTimes(1);
		});
		expect(onCommit).toHaveBeenCalledWith("abc");
	});

	it("commits immediately on Ctrl+Enter, not plain Enter", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} debounceMs={5_000} />);
		const textarea = screen.getByRole("textbox");

		await user.type(textarea, "abc");
		await user.keyboard("{Enter}");
		// Plain Enter inserts a newline — no commit.
		expect(onCommit).not.toHaveBeenCalled();

		await user.keyboard("{Control>}{Enter}{/Control}");
		expect(onCommit).toHaveBeenCalledTimes(1);
	});

	it("reflects external `value` updates from the parent when no edit is pending", () => {
		const { rerender } = renderReact(<TextareaInput value="first" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("first");

		rerender(<TextareaInput value="second" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("second");
	});
});
