import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { FilterPresetSelector } from "../../../src/react/views/filter-preset-selector";
import { createMockReactBundle, renderWithContexts } from "../../fixtures/react-view-fixtures";

function bundleWithPresets(presets: Array<{ name: string; expression: string }> = []) {
	return createMockReactBundle({ settings: { filterPresets: presets } as any });
}

describe("FilterPresetSelector", () => {
	it("renders the preset select even with no presets so e2e can target it", () => {
		renderWithContexts(<FilterPresetSelector onPresetSelected={vi.fn()} />, {
			bundle: bundleWithPresets(),
		});
		const select = screen.getByTestId("prisma-filter-preset");
		expect(select).toBeInTheDocument();
		expect(select.querySelectorAll("option")).toHaveLength(2);
	});

	it("includes a Clear option and one entry per preset", () => {
		renderWithContexts(<FilterPresetSelector onPresetSelected={vi.fn()} />, {
			bundle: bundleWithPresets([
				{ name: "Done Only", expression: "Status === 'Done'" },
				{ name: "Work", expression: "Category === 'Work'" },
			]),
		});
		const select = screen.getByTestId("prisma-filter-preset");
		expect(select.querySelectorAll("option")).toHaveLength(4);
	});

	it("calls onPresetSelected with expression when preset is chosen", async () => {
		const onPresetSelected = vi.fn();
		const user = userEvent.setup();
		renderWithContexts(<FilterPresetSelector onPresetSelected={onPresetSelected} />, {
			bundle: bundleWithPresets([{ name: "Done Only", expression: "Status === 'Done'" }]),
		});

		const select = screen.getByTestId("prisma-filter-preset") as HTMLSelectElement;
		await user.selectOptions(select, "Status === 'Done'");

		expect(onPresetSelected).toHaveBeenCalledWith("Status === 'Done'");
	});

	it("calls onPresetSelected with empty string on clear", async () => {
		const onPresetSelected = vi.fn();
		const user = userEvent.setup();
		renderWithContexts(<FilterPresetSelector onPresetSelected={onPresetSelected} />, {
			bundle: bundleWithPresets([{ name: "Test", expression: "x === 1" }]),
		});

		const select = screen.getByTestId("prisma-filter-preset") as HTMLSelectElement;
		await user.selectOptions(select, "__clear__");

		expect(onPresetSelected).toHaveBeenCalledWith("");
	});
});
