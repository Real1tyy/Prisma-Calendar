import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CsvInput } from "../../src/components/csv-input";
import { renderReact } from "../helpers/render-react";

describe("CsvInput", () => {
	it("renders the array joined with ', ' as its text value", () => {
		renderReact(<CsvInput value={["alpha", "beta"]} itemType="string" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("alpha, beta");
	});

	it("renders an empty string when `value` is not an array", () => {
		renderReact(<CsvInput value={undefined} itemType="string" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("");
	});

	it("preserves in-progress text (trailing commas / spaces) until blur", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<CsvInput value={[]} itemType="string" onChange={onChange} />);
		const input = screen.getByRole("textbox");

		await user.type(input, "a, b, ");

		expect(input).toHaveValue("a, b, ");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("commits parsed string[] on blur", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<CsvInput value={[]} itemType="string" onChange={onChange} />);

		await user.type(screen.getByRole("textbox"), "one, two ,three");
		await user.tab();

		expect(onChange).toHaveBeenCalledExactlyOnceWith(["one", "two", "three"]);
	});

	it("commits on Enter", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<CsvInput value={[]} itemType="string" onChange={onChange} />);
		const input = screen.getByRole("textbox");

		await user.click(input);
		await user.keyboard("a, b{Enter}");

		expect(onChange).toHaveBeenCalledExactlyOnceWith(["a", "b"]);
	});

	it("coerces to number[] and drops NaN entries when itemType is 'number'", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<CsvInput value={[]} itemType="number" onChange={onChange} />);

		await user.type(screen.getByRole("textbox"), "1, abc, 2");
		await user.tab();

		expect(onChange).toHaveBeenCalledExactlyOnceWith([1, 2]);
	});

	it("rejects non-finite numeric entries (Infinity, -Infinity)", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<CsvInput value={[]} itemType="number" onChange={onChange} />);

		await user.type(screen.getByRole("textbox"), "1, Infinity, -Infinity, 2");
		await user.tab();

		expect(onChange).toHaveBeenCalledExactlyOnceWith([1, 2]);
	});

	it("resyncs the draft when the `value` prop changes externally", () => {
		const { rerender } = renderReact(<CsvInput value={["a"]} itemType="string" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("a");

		rerender(<CsvInput value={["x", "y"]} itemType="string" onChange={vi.fn()} />);
		expect(screen.getByRole("textbox")).toHaveValue("x, y");
	});
});
