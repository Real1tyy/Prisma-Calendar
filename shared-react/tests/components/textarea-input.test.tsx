import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TextareaInput } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

function ControlledHarness({ initial = "", onCommit }: { initial?: string; onCommit?: (v: string) => void }) {
	const [value, setValue] = useState(initial);
	return (
		<TextareaInput
			value={value}
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

	it("fires onChange on every keystroke", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} />);

		await user.type(screen.getByRole("textbox"), "abc");

		expect(onCommit).toHaveBeenCalledTimes(3);
		expect(onCommit).toHaveBeenLastCalledWith("abc");
	});

	it("reflects external `value` updates from the parent (no stale state)", () => {
		const { rerender } = renderReact(<TextareaInput value="first" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("first");

		rerender(<TextareaInput value="second" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("second");
	});
});
