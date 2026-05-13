import type { CellOption, GridLayoutState } from "@real1ty-obsidian-plugins";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LayoutEditorContent } from "../../src/grid-layout/layout-editor-modal";
import { renderWithProviders } from "../harness/render-with-providers";

const CSS_PREFIX = "test-";

function makePalette(ids: string[]): CellOption[] {
	return ids.map((id) => ({
		id,
		label: id.charAt(0).toUpperCase() + id.slice(1),
		render: vi.fn(),
	}));
}

function makeState(overrides: Partial<GridLayoutState> = {}): GridLayoutState {
	return {
		columns: 2,
		rows: 2,
		cells: [],
		columnSizes: undefined,
		rowSizes: undefined,
		cellColumnSizes: undefined,
		cellRowSizes: undefined,
		...overrides,
	};
}

function renderEditor(
	stateOverrides: Partial<GridLayoutState> = {},
	palette = makePalette(["alpha", "beta", "gamma"])
) {
	const onApply = vi.fn();
	const onCancel = vi.fn();
	const result = renderWithProviders(
		<LayoutEditorContent
			initialState={makeState(stateOverrides)}
			cellPalette={palette}
			onApply={onApply}
			onCancel={onCancel}
		/>,
		{ cssPrefix: CSS_PREFIX, testIdPrefix: CSS_PREFIX }
	);
	return { ...result, onApply, onCancel, palette };
}

describe("LayoutEditorContent (React parity)", () => {
	it("renders dim rows for Columns and Rows", () => {
		const { container } = renderEditor();
		const dimRows = container.querySelectorAll(".test-grid-editor-dim-row");
		expect(dimRows.length).toBe(2);
		const labels = Array.from(container.querySelectorAll(".test-grid-editor-dim-label")).map((el) => el.textContent);
		expect(labels).toEqual(["Columns", "Rows"]);
	});

	it("shows current columns and rows values", () => {
		const { container } = renderEditor({ columns: 3, rows: 4 });
		const values = Array.from(container.querySelectorAll(".test-grid-editor-dim-value")).map((el) => el.textContent);
		expect(values).toEqual(["3", "4"]);
	});

	it("plus button is disabled when columns at max (6)", () => {
		const { container } = renderEditor({ columns: 6 });
		const dimRow = container.querySelectorAll<HTMLElement>(".test-grid-editor-dim-row")[0];
		const plus = dimRow.querySelectorAll<HTMLButtonElement>(".test-grid-editor-dim-btn")[1];
		expect(plus.disabled).toBe(true);
	});

	it("minus button is disabled when columns at min (1)", () => {
		const { container } = renderEditor({ columns: 1 });
		const dimRow = container.querySelectorAll<HTMLElement>(".test-grid-editor-dim-row")[0];
		const minus = dimRow.querySelectorAll<HTMLButtonElement>(".test-grid-editor-dim-btn")[0];
		expect(minus.disabled).toBe(true);
	});

	it("plus button on Columns increments to 3 and re-renders", () => {
		const { container } = renderEditor({ columns: 2 });
		const colRow = container.querySelectorAll<HTMLElement>(".test-grid-editor-dim-row")[0];
		const plus = colRow.querySelectorAll<HTMLButtonElement>(".test-grid-editor-dim-btn")[1];
		fireEvent.click(plus);
		const values = Array.from(container.querySelectorAll(".test-grid-editor-dim-value")).map((el) => el.textContent);
		expect(values[0]).toBe("3");
	});

	it("minus button on Rows decrements value", () => {
		const { container } = renderEditor({ rows: 3 });
		const rowRow = container.querySelectorAll<HTMLElement>(".test-grid-editor-dim-row")[1];
		const minus = rowRow.querySelectorAll<HTMLButtonElement>(".test-grid-editor-dim-btn")[0];
		fireEvent.click(minus);
		const values = Array.from(container.querySelectorAll(".test-grid-editor-dim-value")).map((el) => el.textContent);
		expect(values[1]).toBe("2");
	});

	it("plus button disabled at max does not increment", () => {
		const { container } = renderEditor({ columns: 6 });
		const colRow = container.querySelectorAll<HTMLElement>(".test-grid-editor-dim-row")[0];
		const plus = colRow.querySelectorAll<HTMLButtonElement>(".test-grid-editor-dim-btn")[1];
		fireEvent.click(plus);
		const values = Array.from(container.querySelectorAll(".test-grid-editor-dim-value")).map((el) => el.textContent);
		expect(values[0]).toBe("6");
	});

	it("renders preview container with editor columns/rows CSS vars", () => {
		const { container } = renderEditor({ columns: 3, rows: 2 });
		const preview = container.querySelector<HTMLElement>(".test-grid-editor-preview")!;
		expect(preview).toBeTruthy();
		expect(preview.style.getPropertyValue("--editor-columns")).toBe("3");
		expect(preview.style.getPropertyValue("--editor-rows")).toBe("2");
	});

	it("renders empty slots for unoccupied cells", () => {
		const { container } = renderEditor({ columns: 2, rows: 2 });
		const empties = container.querySelectorAll(".test-grid-editor-empty");
		expect(empties.length).toBe(4);
	});

	it("renders occupied cells with their label", () => {
		const palette = makePalette(["alpha", "beta"]);
		const { container } = renderEditor(
			{
				columns: 2,
				rows: 2,
				cells: [{ optionId: "alpha", row: 0, col: 0 }],
			},
			palette
		);
		const occupied = container.querySelectorAll<HTMLElement>(".test-grid-editor-cell");
		expect(occupied.length).toBe(1);
		expect(occupied[0].querySelector(".test-grid-editor-cell-label")?.textContent).toBe("Alpha");
	});

	it("falls back to optionId when palette option not found", () => {
		const { container } = renderEditor(
			{
				columns: 2,
				rows: 1,
				cells: [{ optionId: "unknown-id", row: 0, col: 0 }],
			},
			makePalette(["alpha", "beta"])
		);
		const label = container.querySelector(".test-grid-editor-cell-label")?.textContent;
		expect(label).toBe("unknown-id");
	});

	it("clicking remove on occupied cell removes it from staged state", () => {
		const palette = makePalette(["alpha", "beta"]);
		const { container } = renderEditor(
			{
				columns: 2,
				rows: 1,
				cells: [{ optionId: "alpha", row: 0, col: 0 }],
			},
			palette
		);
		const removeBtn = container.querySelector<HTMLButtonElement>(".test-grid-editor-cell-remove")!;
		fireEvent.click(removeBtn);
		expect(container.querySelectorAll(".test-grid-editor-cell").length).toBe(0);
		expect(container.querySelectorAll(".test-grid-editor-empty").length).toBe(2);
	});

	it("CSS vars set --editor-cell-row / --editor-cell-col for occupied cells", () => {
		const { container } = renderEditor(
			{
				columns: 2,
				rows: 2,
				cells: [{ optionId: "alpha", row: 1, col: 1 }],
			},
			makePalette(["alpha"])
		);
		const cell = container.querySelector<HTMLElement>(".test-grid-editor-cell")!;
		expect(cell.style.getPropertyValue("--editor-cell-row")).toBe("2");
		expect(cell.style.getPropertyValue("--editor-cell-col")).toBe("2");
	});

	it("CSS vars set --editor-cell-row / --editor-cell-col for empty slots", () => {
		const { container } = renderEditor({ columns: 2, rows: 2 });
		const empties = Array.from(container.querySelectorAll<HTMLElement>(".test-grid-editor-empty"));
		const positions = empties.map((el) => [
			el.style.getPropertyValue("--editor-cell-row"),
			el.style.getPropertyValue("--editor-cell-col"),
		]);
		expect(positions).toContainEqual(["1", "1"]);
		expect(positions).toContainEqual(["1", "2"]);
		expect(positions).toContainEqual(["2", "1"]);
		expect(positions).toContainEqual(["2", "2"]);
	});

	it("Cancel button invokes onCancel without invoking onApply", () => {
		const { container, onCancel, onApply } = renderEditor();
		const actions = container.querySelector(".test-grid-editor-actions")!;
		const cancelBtn = actions.querySelector<HTMLButtonElement>(".test-grid-editor-btn-cancel")!;
		fireEvent.click(cancelBtn);
		expect(onCancel).toHaveBeenCalledTimes(1);
		expect(onApply).not.toHaveBeenCalled();
	});

	it("Apply button invokes onApply with current staged state", () => {
		const palette = makePalette(["alpha"]);
		const { container, onApply } = renderEditor(
			{
				columns: 1,
				rows: 1,
				cells: [{ optionId: "alpha", row: 0, col: 0 }],
			},
			palette
		);

		const applyBtn = container.querySelector<HTMLButtonElement>(".test-grid-editor-btn-apply")!;
		fireEvent.click(applyBtn);

		expect(onApply).toHaveBeenCalledTimes(1);
		const state: GridLayoutState = onApply.mock.calls[0][0];
		expect(state.columns).toBe(1);
		expect(state.rows).toBe(1);
		expect(state.cells).toEqual([{ optionId: "alpha", row: 0, col: 0 }]);
	});

	it("decreasing columns removes cells beyond new bound", () => {
		const palette = makePalette(["alpha", "beta"]);
		const { container, onApply } = renderEditor(
			{
				columns: 2,
				rows: 1,
				cells: [
					{ optionId: "alpha", row: 0, col: 0 },
					{ optionId: "beta", row: 0, col: 1 },
				],
			},
			palette
		);

		const colRow = container.querySelectorAll<HTMLElement>(".test-grid-editor-dim-row")[0];
		const minus = colRow.querySelectorAll<HTMLButtonElement>(".test-grid-editor-dim-btn")[0];
		fireEvent.click(minus);

		const applyBtn = container.querySelector<HTMLButtonElement>(".test-grid-editor-btn-apply")!;
		fireEvent.click(applyBtn);

		const state: GridLayoutState = onApply.mock.calls[0][0];
		expect(state.columns).toBe(1);
		expect(state.cells).toEqual([{ optionId: "alpha", row: 0, col: 0 }]);
	});

	it("decreasing rows removes cells beyond new bound", () => {
		const palette = makePalette(["alpha", "beta"]);
		const { container, onApply } = renderEditor(
			{
				columns: 1,
				rows: 2,
				cells: [
					{ optionId: "alpha", row: 0, col: 0 },
					{ optionId: "beta", row: 1, col: 0 },
				],
			},
			palette
		);

		const rowRow = container.querySelectorAll<HTMLElement>(".test-grid-editor-dim-row")[1];
		const minus = rowRow.querySelectorAll<HTMLButtonElement>(".test-grid-editor-dim-btn")[0];
		fireEvent.click(minus);

		const applyBtn = container.querySelector<HTMLButtonElement>(".test-grid-editor-btn-apply")!;
		fireEvent.click(applyBtn);

		const state: GridLayoutState = onApply.mock.calls[0][0];
		expect(state.rows).toBe(1);
		expect(state.cells).toEqual([{ optionId: "alpha", row: 0, col: 0 }]);
	});
});
