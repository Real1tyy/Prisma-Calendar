import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { TextInput } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

function ControlledHarness({ initial = "", onCommit }: { initial?: string; onCommit?: (v: string) => void }) {
	const [value, setValue] = useState(initial);
	return (
		<TextInput
			value={value}
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

	it("fires onChange on every keystroke with the new value", async () => {
		const onCommit = vi.fn();
		const { user } = renderReact(<ControlledHarness onCommit={onCommit} />);
		const input = screen.getByRole("textbox");

		await user.type(input, "abc");

		expect(onCommit).toHaveBeenCalledTimes(3);
		expect(onCommit).toHaveBeenNthCalledWith(1, "a");
		expect(onCommit).toHaveBeenNthCalledWith(2, "ab");
		expect(onCommit).toHaveBeenNthCalledWith(3, "abc");
		expect(input).toHaveValue("abc");
	});

	it("reflects external `value` updates from the parent", () => {
		const { rerender } = renderReact(<TextInput value="first" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("first");

		rerender(<TextInput value="second" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("second");
	});
});
