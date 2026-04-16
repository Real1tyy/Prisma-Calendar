import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { createGridLayout } from "../../src/components/grid-layout/grid-layout";
import type { CellPlacement, GridLayoutConfig } from "../../src/components/grid-layout/types";

const mockApp = {} as App;

function makeCells(rows: number, cols: number): CellPlacement[] {
	const cells: CellPlacement[] = [];
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < cols; c++) {
			cells.push({
				id: `cell-${r}-${c}`,
				label: `Cell ${r},${c}`,
				row: r,
				col: c,
				render: vi.fn((el: HTMLElement) => (el.textContent = `Content ${r},${c}`)),
				cleanup: vi.fn(),
			});
		}
	}
	return cells;
}

function makeConfig(overrides?: Partial<GridLayoutConfig>): GridLayoutConfig {
	return {
		columns: 2,
		rows: 2,
		cssPrefix: "test-",
		cells: makeCells(2, 2),
		...overrides,
	};
}

function getVar(el: HTMLElement, name: string): string {
	return el.style.getPropertyValue(name);
}

describe("createGridLayout", () => {
	it("creates a grid container element", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig());

		const grid = container.querySelector(".test-grid");
		expect(grid).toBeTruthy();
	});

	it("creates correct number of cell elements for a 2x2 grid", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig());

		const cells = container.querySelectorAll(".test-grid-cell");
		expect(cells.length).toBe(4);
	});

	it("sets data-row and data-col attributes on cells", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig());

		const cells = container.querySelectorAll<HTMLElement>(".test-grid-cell");
		const positions = Array.from(cells).map((c) => [c.dataset.row, c.dataset.col]);
		expect(positions).toContainEqual(["0", "0"]);
		expect(positions).toContainEqual(["0", "1"]);
		expect(positions).toContainEqual(["1", "0"]);
		expect(positions).toContainEqual(["1", "1"]);
	});

	it("calls render closures for initial cells", () => {
		const cells = makeCells(2, 2);
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ cells }));

		for (const cell of cells) {
			expect(cell.render).toHaveBeenCalledOnce();
		}
	});

	it("renders content into cell elements", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig());

		const cellEls = container.querySelectorAll<HTMLElement>(".test-grid-cell");
		const contents = Array.from(cellEls).map((c) => c.textContent);
		expect(contents).toContain("Content 0,0");
		expect(contents).toContain("Content 1,1");
	});

	it("sets --grid-columns custom property", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ columns: 3 }));

		const grid = container.querySelector<HTMLElement>(".test-grid")!;
		expect(getVar(grid, "--grid-columns")).toBe("repeat(3, 1fr)");
	});

	it("sets --grid-rows custom property", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ rows: 4 }));

		const grid = container.querySelector<HTMLElement>(".test-grid")!;
		expect(getVar(grid, "--grid-rows")).toBe("repeat(4, auto)");
	});

	it("applies minCellWidth with auto-fit and minmax", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ minCellWidth: 200 }));

		const grid = container.querySelector<HTMLElement>(".test-grid")!;
		expect(getVar(grid, "--grid-columns")).toBe("repeat(auto-fit, minmax(200px, 1fr))");
	});

	it("sets --grid-gap custom property", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ gap: "12px" }));

		const grid = container.querySelector<HTMLElement>(".test-grid")!;
		expect(getVar(grid, "--grid-gap")).toBe("12px");
	});

	it("sets --cell-row and --cell-col custom properties on cells", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig());

		const cell = container.querySelector<HTMLElement>('[data-row="1"][data-col="1"]')!;
		expect(getVar(cell, "--cell-row")).toBe("2 / span 1");
		expect(getVar(cell, "--cell-col")).toBe("2 / span 1");
	});

	it("handles colSpan correctly", () => {
		const container = document.createElement("div");
		createGridLayout(
			container,
			makeConfig({
				columns: 3,
				rows: 1,
				cells: [
					{ id: "wide", label: "Wide", row: 0, col: 0, colSpan: 2, render: vi.fn() },
					{ id: "side", label: "Side", row: 0, col: 2, render: vi.fn() },
				],
			})
		);

		const cell = container.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
		expect(getVar(cell, "--cell-col")).toBe("1 / span 2");
	});

	it("handles rowSpan correctly", () => {
		const container = document.createElement("div");
		createGridLayout(
			container,
			makeConfig({
				columns: 1,
				rows: 3,
				cells: [{ id: "tall", label: "Tall", row: 0, col: 0, rowSpan: 2, render: vi.fn() }],
			})
		);

		const cell = container.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
		expect(getVar(cell, "--cell-row")).toBe("1 / span 2");
	});

	it("setCell replaces content and calls old cleanup", () => {
		const cells = makeCells(2, 2);
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells }));

		const newRender = vi.fn((el: HTMLElement) => (el.textContent = "Replaced"));
		handle.setCell(0, 0, newRender);

		const oldCell = cells.find((c) => c.row === 0 && c.col === 0)!;
		expect(oldCell.cleanup).toHaveBeenCalledOnce();
		expect(newRender).toHaveBeenCalledOnce();

		const cellEl = container.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
		expect(cellEl.textContent).toBe("Replaced");
	});

	it("setCell creates a new cell if position was empty", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(
			container,
			makeConfig({
				columns: 3,
				rows: 3,
				cells: [],
			})
		);

		const render = vi.fn();
		handle.setCell(2, 2, render);

		expect(render).toHaveBeenCalledOnce();
		const cell = container.querySelector<HTMLElement>('[data-row="2"][data-col="2"]');
		expect(cell).toBeTruthy();
	});

	it("setCell with out-of-bounds is a no-op", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());

		const render = vi.fn();
		handle.setCell(5, 5, render);
		handle.setCell(-1, 0, render);
		handle.setCell(0, -1, render);

		expect(render).not.toHaveBeenCalled();
	});

	it("setCellById replaces content by id", () => {
		const cells = makeCells(2, 2);
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells }));

		const newRender = vi.fn((el: HTMLElement) => (el.textContent = "By ID"));
		handle.setCellById("cell-1-0", newRender);

		const oldCell = cells.find((c) => c.id === "cell-1-0")!;
		expect(oldCell.cleanup).toHaveBeenCalledOnce();
		expect(newRender).toHaveBeenCalledOnce();

		const cellEl = container.querySelector<HTMLElement>('[data-row="1"][data-col="0"]')!;
		expect(cellEl.textContent).toBe("By ID");
	});

	it("setCellById with unknown id is a no-op", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());

		const render = vi.fn();
		handle.setCellById("nonexistent", render);
		expect(render).not.toHaveBeenCalled();
	});

	it("clearCell empties content and calls cleanup", () => {
		const cells = makeCells(2, 2);
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells }));

		handle.clearCell(0, 1);

		const cell = cells.find((c) => c.row === 0 && c.col === 1)!;
		expect(cell.cleanup).toHaveBeenCalledOnce();

		const cellEl = container.querySelector<HTMLElement>('[data-row="0"][data-col="1"]')!;
		expect(cellEl.textContent).toBe("");
	});

	it("clearCell on empty position is a no-op", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells: [] }));

		handle.clearCell(0, 0);
	});

	it("getCellElement returns the cell element", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());

		const el = handle.getCellElement(1, 1);
		expect(el).toBeTruthy();
		expect(el?.dataset.row).toBe("1");
		expect(el?.dataset.col).toBe("1");
	});

	it("getCellElement returns null for empty position", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells: [] }));

		expect(handle.getCellElement(0, 0)).toBeNull();
	});

	it("resize updates grid dimensions", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());

		handle.resize(3, 3);

		expect(handle.columns).toBe(3);
		expect(handle.rows).toBe(3);

		const grid = container.querySelector<HTMLElement>(".test-grid")!;
		expect(getVar(grid, "--grid-columns")).toBe("repeat(3, 1fr)");
		expect(getVar(grid, "--grid-rows")).toBe("repeat(3, auto)");
	});

	it("resize removes out-of-bounds cells and calls their cleanup", () => {
		const cells = makeCells(2, 2);
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells }));

		handle.resize(1, 1);

		const removedCells = cells.filter((c) => c.row >= 1 || c.col >= 1);
		for (const cell of removedCells) {
			expect(cell.cleanup).toHaveBeenCalledOnce();
		}

		expect(handle.getCellElement(1, 1)).toBeNull();
		expect(handle.getCellElement(0, 1)).toBeNull();
		expect(handle.getCellElement(1, 0)).toBeNull();
		expect(handle.getCellElement(0, 0)).toBeTruthy();
	});

	it("columns and rows reflect current dimensions", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ columns: 4, rows: 3 }));

		expect(handle.columns).toBe(4);
		expect(handle.rows).toBe(3);
	});

	it("destroy calls all cell cleanups", () => {
		const cells = makeCells(2, 2);
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells }));

		handle.destroy();

		for (const cell of cells) {
			expect(cell.cleanup).toHaveBeenCalledOnce();
		}
	});

	it("destroy empties the container", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());

		expect(container.children.length).toBeGreaterThan(0);
		handle.destroy();
		expect(container.innerHTML).toBe("");
	});

	it("operations after destroy are no-ops", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());
		handle.destroy();

		const render = vi.fn();
		handle.setCell(0, 0, render);
		handle.setCellById("cell-0-0", render);
		handle.clearCell(0, 0);
		handle.resize(5, 5);

		expect(render).not.toHaveBeenCalled();
		expect(handle.columns).toBe(2);
		expect(handle.rows).toBe(2);
	});

	it("onCellChange fires on setCell", () => {
		const onCellChange = vi.fn();
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ onCellChange }));

		handle.setCell(1, 0, vi.fn());
		expect(onCellChange).toHaveBeenCalledWith(1, 0);
	});

	it("onCellChange fires on setCellById with id", () => {
		const onCellChange = vi.fn();
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ onCellChange }));

		handle.setCellById("cell-0-1", vi.fn());
		expect(onCellChange).toHaveBeenCalledWith(0, 1, "cell-0-1");
	});

	it("works with no initial cells", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig({ cells: undefined }));

		expect(handle.columns).toBe(2);
		expect(handle.rows).toBe(2);
		expect(container.querySelector(".test-grid")).toBeTruthy();
		expect(container.querySelectorAll(".test-grid-cell").length).toBe(0);
	});

	it("works with 1x1 grid", () => {
		const container = document.createElement("div");
		const render = vi.fn();
		const handle = createGridLayout(container, {
			columns: 1,
			rows: 1,
			cssPrefix: "test-",
			cells: [{ id: "only", label: "Only", row: 0, col: 0, render }],
		});

		expect(handle.columns).toBe(1);
		expect(handle.rows).toBe(1);
		expect(render).toHaveBeenCalledOnce();
	});

	it("grid container has the grid class", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig());

		const grid = container.querySelector<HTMLElement>(".test-grid")!;
		expect(grid).toBeTruthy();
	});

	it("dividers adds divider class to cells", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ dividers: true }));

		const cells = container.querySelectorAll(".test-grid-cell-divider");
		expect(cells.length).toBe(4);
	});

	it("no divider class when dividers is false", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ dividers: false }));

		const cells = container.querySelectorAll(".test-grid-cell-divider");
		expect(cells.length).toBe(0);
	});

	it("cellPalette adds swap buttons to cells", () => {
		const container = document.createElement("div");
		const nonDestructiveRender = vi.fn((el: HTMLElement) => el.createDiv({ text: "content" }));
		const cellDefs: CellPlacement[] = [
			{ id: "a", label: "A", row: 0, col: 0, render: nonDestructiveRender },
			{ id: "b", label: "B", row: 0, col: 1, render: nonDestructiveRender },
			{ id: "c", label: "C", row: 1, col: 0, render: nonDestructiveRender },
			{ id: "d", label: "D", row: 1, col: 1, render: nonDestructiveRender },
		];
		createGridLayout(container, {
			columns: 2,
			rows: 2,
			cssPrefix: "test-",
			cells: cellDefs,
			app: mockApp,
			cellPalette: [
				{ id: "opt-a", label: "Option A", render: vi.fn() },
				{ id: "opt-b", label: "Option B", render: vi.fn() },
			],
		});

		const swapButtons = container.querySelectorAll(".test-grid-cell-swap");
		expect(swapButtons.length).toBe(4);
	});

	it("no swap buttons without cellPalette", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig());

		const swapButtons = container.querySelectorAll(".test-grid-cell-swap");
		expect(swapButtons.length).toBe(0);
	});

	it("showCellPicker is a no-op without palette or app", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());

		handle.showCellPicker(0, 0);
	});

	it("showCellPicker is a no-op after destroy", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());
		handle.destroy();

		handle.showCellPicker(0, 0);
	});

	it("showLayoutEditor is a no-op without app", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());

		handle.showLayoutEditor();
	});

	it("showLayoutEditor is a no-op after destroy", () => {
		const container = document.createElement("div");
		const handle = createGridLayout(container, makeConfig());
		handle.destroy();

		handle.showLayoutEditor();
	});

	it("editable adds edit button to grid", () => {
		const container = document.createElement("div");
		const nonDestructiveRender = vi.fn((el: HTMLElement) => el.createDiv({ text: "content" }));
		createGridLayout(container, {
			columns: 2,
			rows: 2,
			cssPrefix: "test-",
			app: mockApp,
			editable: true,
			cellPalette: [
				{ id: "opt-a", label: "Option A", render: vi.fn() },
				{ id: "opt-b", label: "Option B", render: vi.fn() },
			],
			cells: [
				{ id: "opt-a", label: "A", row: 0, col: 0, render: nonDestructiveRender },
				{ id: "opt-b", label: "B", row: 0, col: 1, render: nonDestructiveRender },
			],
		});

		const editBtn = container.querySelector(".test-grid-edit-btn");
		expect(editBtn).toBeTruthy();
	});

	it("no edit button without editable flag", () => {
		const container = document.createElement("div");
		createGridLayout(container, makeConfig({ app: mockApp }));

		const editBtn = container.querySelector(".test-grid-edit-btn");
		expect(editBtn).toBeNull();
	});

	describe("resizable", () => {
		it("creates column resize handles between columns", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 3, rows: 1, resizable: "track", cells: [] }));

			const colHandles = container.querySelectorAll("[data-resize-col]");
			expect(colHandles.length).toBe(2);
			expect(colHandles[0].getAttribute("data-resize-col")).toBe("0");
			expect(colHandles[1].getAttribute("data-resize-col")).toBe("1");
		});

		it("creates row resize handles between rows", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 1, rows: 3, resizable: "track", cells: [] }));

			const rowHandles = container.querySelectorAll("[data-resize-row]");
			expect(rowHandles.length).toBe(2);
			expect(rowHandles[0].getAttribute("data-resize-row")).toBe("0");
			expect(rowHandles[1].getAttribute("data-resize-row")).toBe("1");
		});

		it("no resize handles when resizable is false", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ resizable: false }));

			expect(container.querySelectorAll("[data-resize-col]").length).toBe(0);
			expect(container.querySelectorAll("[data-resize-row]").length).toBe(0);
		});

		it("no resize handles when resizable is not set", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig());

			expect(container.querySelectorAll("[data-resize-col]").length).toBe(0);
			expect(container.querySelectorAll("[data-resize-row]").length).toBe(0);
		});

		it("uses fr units in --grid-columns when resizable", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 1, resizable: "track", cells: [] }));

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			expect(getVar(grid, "--grid-columns")).toBe("1fr 1fr");
		});

		it("uses fr units in --grid-rows when resizable", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 1, rows: 2, resizable: "track", cells: [] }));

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			expect(getVar(grid, "--grid-rows")).toBe("1fr 1fr");
		});

		it("restores custom column sizes from initialState", () => {
			const container = document.createElement("div");
			createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 1,
					resizable: "track",
					cells: [],
					cellPalette: [{ id: "a", label: "A", render: vi.fn() }],
					initialState: { columns: 2, rows: 1, cells: [], columnSizes: [2, 1], rowSizes: [1] },
				})
			);

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			expect(getVar(grid, "--grid-columns")).toBe("2fr 1fr");
		});

		it("restores custom row sizes from initialState", () => {
			const container = document.createElement("div");
			createGridLayout(
				container,
				makeConfig({
					columns: 1,
					rows: 3,
					resizable: "track",
					cells: [],
					cellPalette: [{ id: "a", label: "A", render: vi.fn() }],
					initialState: { columns: 1, rows: 3, cells: [], rowSizes: [1, 2, 1] },
				})
			);

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			expect(getVar(grid, "--grid-rows")).toBe("1fr 2fr 1fr");
		});

		it("includes sizes in getState", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 2,
					resizable: "track",
					cells: [],
					cellPalette: [{ id: "a", label: "A", render: vi.fn() }],
					initialState: { columns: 2, rows: 2, cells: [], columnSizes: [3, 1], rowSizes: [1, 2] },
				})
			);

			const state = handle.getState();
			expect(state.columnSizes).toEqual([3, 1]);
			expect(state.rowSizes).toEqual([1, 2]);
		});

		it("getState has no sizes when not resizable", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(container, makeConfig());

			const state = handle.getState();
			expect(state.columnSizes).toBeUndefined();
			expect(state.rowSizes).toBeUndefined();
		});

		it("resize adjusts sizes arrays when growing", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 1,
					resizable: "track",
					cells: [],
				})
			);

			handle.resize(3, 2);

			const state = handle.getState();
			expect(state.columnSizes).toEqual([1, 1, 1]);
			expect(state.rowSizes).toEqual([1, 1]);
		});

		it("resize trims sizes arrays when shrinking", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(
				container,
				makeConfig({
					columns: 3,
					rows: 3,
					resizable: "track",
					cells: [],
					cellPalette: [{ id: "a", label: "A", render: vi.fn() }],
					initialState: { columns: 3, rows: 3, cells: [], columnSizes: [2, 3, 1], rowSizes: [1, 2, 3] },
				})
			);

			handle.resize(2, 2);

			const state = handle.getState();
			expect(state.columnSizes).toEqual([2, 3]);
			expect(state.rowSizes).toEqual([1, 2]);
		});

		it("minCellWidth takes precedence over resizable for columns", () => {
			const container = document.createElement("div");
			createGridLayout(
				container,
				makeConfig({ columns: 2, rows: 1, resizable: "track", minCellWidth: 200, cells: [] })
			);

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			expect(getVar(grid, "--grid-columns")).toBe("repeat(auto-fit, minmax(200px, 1fr))");

			const colHandles = container.querySelectorAll("[data-resize-col]");
			expect(colHandles.length).toBe(0);
		});

		it("column resize handles have col-resize cursor", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 1, resizable: "track", cells: [] }));

			const handle = container.querySelector<HTMLElement>("[data-resize-col]")!;
			expect(handle.style.cursor).toBe("col-resize");
		});

		it("row resize handles have row-resize cursor", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 1, rows: 2, resizable: "track", cells: [] }));

			const handle = container.querySelector<HTMLElement>("[data-resize-row]")!;
			expect(handle.style.cursor).toBe("row-resize");
		});

		it("resize handles are cleaned up on destroy", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "track" }));

			expect(container.querySelectorAll("[data-resize-col]").length).toBe(1);
			expect(container.querySelectorAll("[data-resize-row]").length).toBe(1);

			handle.destroy();

			expect(container.innerHTML).toBe("");
		});

		it("onStateChange fires with sizes", () => {
			const onStateChange = vi.fn();
			const container = document.createElement("div");
			const handle = createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 1,
					resizable: "track",
					cells: [],
					onStateChange,
				})
			);

			handle.setCell(0, 0, vi.fn());

			const lastCall = onStateChange.mock.calls.at(-1)?.[0];
			expect(lastCall?.columnSizes).toEqual([1, 1]);
			expect(lastCall?.rowSizes).toEqual([1]);
		});
	});

	describe("resizable cell-width mode", () => {
		it("creates row containers", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "cell-width", cells: [] }));

			const rowContainers = container.querySelectorAll(".test-grid-row");
			expect(rowContainers.length).toBe(2);
		});

		it("places cells inside row containers", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "cell-width" }));

			const rowContainers = container.querySelectorAll<HTMLElement>(".test-grid-row");
			expect(rowContainers[0].querySelectorAll(".test-grid-cell").length).toBe(2);
			expect(rowContainers[1].querySelectorAll(".test-grid-cell").length).toBe(2);
		});

		it("cells have min-width 0 in cell mode", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 1, resizable: "cell-width" }));

			const cell = container.querySelector<HTMLElement>('[data-row="0"][data-col="0"]')!;
			expect(cell.style.minWidth).toBe("0");
		});

		it("sets grid-template-columns to 1fr in cell mode", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 3, rows: 1, resizable: "cell-width", cells: [] }));

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			expect(getVar(grid, "--grid-columns")).toBe("1fr");
		});

		it("row containers have display grid with column template", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "cell-width", cells: [] }));

			const rowContainer = container.querySelector<HTMLElement>(".test-grid-row")!;
			expect(rowContainer.style.display).toBe("grid");
			expect(rowContainer.style.gridTemplateColumns).toBe("1fr 1fr");
		});

		it("per-row resize handles are inside row containers", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 3, rows: 2, resizable: "cell-width", cells: [] }));

			const rowContainers = container.querySelectorAll<HTMLElement>(".test-grid-row");
			expect(rowContainers[0].querySelectorAll("[data-resize-col]").length).toBe(2);
			expect(rowContainers[1].querySelectorAll("[data-resize-col]").length).toBe(2);
		});

		it("has global row resize handles on the grid", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 3, resizable: "cell-width", cells: [] }));

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			const rowHandles = Array.from(grid.querySelectorAll("[data-resize-row]")).filter((h) => h.parentElement === grid);
			expect(rowHandles.length).toBe(2);
		});

		it("no global column handles in cell mode", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 3, rows: 2, resizable: "cell-width", cells: [] }));

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			const globalColHandles = Array.from(grid.querySelectorAll("[data-resize-col]")).filter(
				(h) => h.parentElement === grid
			);
			expect(globalColHandles.length).toBe(0);
		});

		it("getState includes cellColumnSizes", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 2,
					resizable: "cell-width",
					cells: [],
					cellPalette: [{ id: "a", label: "A", render: vi.fn() }],
					initialState: {
						columns: 2,
						rows: 2,
						cells: [],
						cellColumnSizes: { "0": [2, 1] },
					},
				})
			);

			const state = handle.getState();
			expect(state.cellColumnSizes).toEqual({ "0": [2, 1] });
			expect(state.columnSizes).toBeUndefined();
		});

		it("restores per-row grid template from initialState cellColumnSizes", () => {
			const container = document.createElement("div");
			createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 2,
					resizable: "cell-width",
					cellPalette: [
						{ id: "a", label: "A", render: vi.fn() },
						{ id: "b", label: "B", render: vi.fn() },
					],
					initialState: {
						columns: 2,
						rows: 2,
						cells: [
							{ optionId: "a", row: 0, col: 0 },
							{ optionId: "b", row: 0, col: 1 },
						],
						cellColumnSizes: { "0": [3, 1] },
					},
				})
			);

			const rowContainers = container.querySelectorAll<HTMLElement>(".test-grid-row");
			expect(rowContainers[0].style.gridTemplateColumns).toBe("3fr 1fr");
			expect(rowContainers[1].style.gridTemplateColumns).toBe("1fr 1fr");
		});

		it("resize adjusts cellColumnSizes", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(
				container,
				makeConfig({
					columns: 3,
					rows: 2,
					resizable: "cell-width",
					cells: [],
					cellPalette: [{ id: "a", label: "A", render: vi.fn() }],
					initialState: {
						columns: 3,
						rows: 2,
						cells: [],
						cellColumnSizes: { "0": [2, 3, 1], "1": [1, 1, 1] },
					},
				})
			);

			handle.resize(2, 1);

			const state = handle.getState();
			expect(state.cellColumnSizes?.["0"]).toEqual([2, 3]);
			expect(state.cellColumnSizes?.["1"]).toBeUndefined();
		});

		it("destroy cleans up per-row resize handles", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "cell-width" }));

			expect(container.querySelectorAll("[data-resize-col]").length).toBeGreaterThan(0);

			handle.destroy();
			expect(container.innerHTML).toBe("");
		});
	});

	describe("resizable cell-height mode", () => {
		it("creates column containers", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "cell-height", cells: [] }));

			const colContainers = container.querySelectorAll(".test-grid-col");
			expect(colContainers.length).toBe(2);
		});

		it("places cells inside column containers", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "cell-height" }));

			const colContainers = container.querySelectorAll<HTMLElement>(".test-grid-col");
			expect(colContainers[0].querySelectorAll(".test-grid-cell").length).toBe(2);
			expect(colContainers[1].querySelectorAll(".test-grid-cell").length).toBe(2);
		});

		it("sets grid-template-rows to 1fr in cell-height mode", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 3, resizable: "cell-height", cells: [] }));

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			expect(getVar(grid, "--grid-rows")).toBe("1fr");
		});

		it("column containers have display grid with row template", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 3, resizable: "cell-height", cells: [] }));

			const colContainer = container.querySelector<HTMLElement>(".test-grid-col")!;
			expect(colContainer.style.display).toBe("grid");
			expect(colContainer.style.gridTemplateRows).toBe("1fr 1fr 1fr");
		});

		it("per-column resize handles are inside column containers", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 2, rows: 3, resizable: "cell-height", cells: [] }));

			const colContainers = container.querySelectorAll<HTMLElement>(".test-grid-col");
			expect(colContainers[0].querySelectorAll("[data-resize-row]").length).toBe(2);
			expect(colContainers[1].querySelectorAll("[data-resize-row]").length).toBe(2);
		});

		it("has global column resize handles on the grid", () => {
			const container = document.createElement("div");
			createGridLayout(container, makeConfig({ columns: 3, rows: 2, resizable: "cell-height", cells: [] }));

			const grid = container.querySelector<HTMLElement>(".test-grid")!;
			const colHandles = Array.from(grid.querySelectorAll("[data-resize-col]")).filter((h) => h.parentElement === grid);
			expect(colHandles.length).toBe(2);
		});

		it("getState includes cellRowSizes", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 2,
					resizable: "cell-height",
					cells: [],
					cellPalette: [{ id: "a", label: "A", render: vi.fn() }],
					initialState: {
						columns: 2,
						rows: 2,
						cells: [],
						cellRowSizes: { "0": [2, 1] },
					},
				})
			);

			const state = handle.getState();
			expect(state.cellRowSizes).toEqual({ "0": [2, 1] });
			expect(state.rowSizes).toBeUndefined();
		});

		it("restores per-column grid template from initialState cellRowSizes", () => {
			const container = document.createElement("div");
			createGridLayout(
				container,
				makeConfig({
					columns: 2,
					rows: 2,
					resizable: "cell-height",
					cellPalette: [
						{ id: "a", label: "A", render: vi.fn() },
						{ id: "b", label: "B", render: vi.fn() },
					],
					initialState: {
						columns: 2,
						rows: 2,
						cells: [
							{ optionId: "a", row: 0, col: 0 },
							{ optionId: "b", row: 1, col: 0 },
						],
						cellRowSizes: { "0": [3, 1] },
					},
				})
			);

			const colContainers = container.querySelectorAll<HTMLElement>(".test-grid-col");
			expect(colContainers[0].style.gridTemplateRows).toBe("3fr 1fr");
			expect(colContainers[1].style.gridTemplateRows).toBe("1fr 1fr");
		});

		it("destroy cleans up per-column resize handles", () => {
			const container = document.createElement("div");
			const handle = createGridLayout(container, makeConfig({ columns: 2, rows: 2, resizable: "cell-height" }));

			expect(container.querySelectorAll("[data-resize-row]").length).toBeGreaterThan(0);

			handle.destroy();
			expect(container.innerHTML).toBe("");
		});
	});
});
