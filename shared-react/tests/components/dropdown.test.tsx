import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Dropdown } from "../../src/components/setting-controls";
import { renderReact } from "../helpers/render-react";

const OPTIONS = { light: "Light", dark: "Dark", auto: "Auto" };

describe("Dropdown", () => {
	it("renders one option per entry with labels", () => {
		renderReact(<Dropdown value="auto" options={OPTIONS} onChange={vi.fn()} />);
		const select = screen.getByRole("combobox") as HTMLSelectElement;

		expect(select.options).toHaveLength(3);
		expect(screen.getByRole("option", { name: "Light" })).toHaveValue("light");
		expect(screen.getByRole("option", { name: "Dark" })).toHaveValue("dark");
		expect(screen.getByRole("option", { name: "Auto" })).toHaveValue("auto");
	});

	it("selects the option matching the `value` prop", () => {
		renderReact(<Dropdown value="dark" options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("combobox")).toHaveValue("dark");
	});

	it("calls onChange with the option key (not the label) on selection", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<Dropdown value="auto" options={OPTIONS} onChange={onChange} />);

		await user.selectOptions(screen.getByRole("combobox"), "light");

		expect(onChange).toHaveBeenCalledExactlyOnceWith("light");
	});

	it("re-renders the selected value when the `value` prop updates", () => {
		const { rerender } = renderReact(<Dropdown value="light" options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("combobox")).toHaveValue("light");

		rerender(<Dropdown value="dark" options={OPTIONS} onChange={vi.fn()} />);
		expect(screen.getByRole("combobox")).toHaveValue("dark");
	});
});
