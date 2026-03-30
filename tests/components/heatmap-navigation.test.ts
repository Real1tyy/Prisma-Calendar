import { describe, expect, it } from "vitest";

import {
	findAdjacentCell,
	type HeatmapGrid,
	type HeatmapGridCell,
} from "../../src/components/heatmap/heatmap-renderer";

function makeCell(row: number, col: number, dateKey = `${row}-${col}`): HeatmapGridCell {
	return { row, col, dateKey, events: [], element: {} as SVGRectElement };
}

function makeGrid(cells: HeatmapGridCell[], maxRow: number, maxCol: number): HeatmapGrid {
	const lookup = new Map<string, HeatmapGridCell>();
	for (const cell of cells) {
		lookup.set(`${cell.row},${cell.col}`, cell);
	}
	return { cells, lookup, maxRow, maxCol };
}

/**
 * Full 3×3 grid:
 *   col0  col1  col2
 * row0  [0,0] [0,1] [0,2]
 * row1  [1,0] [1,1] [1,2]
 * row2  [2,0] [2,1] [2,2]
 */
function makeFullGrid(): { grid: HeatmapGrid; cells: HeatmapGridCell[][] } {
	const rows: HeatmapGridCell[][] = [];
	const allCells: HeatmapGridCell[] = [];
	for (let r = 0; r < 3; r++) {
		rows[r] = [];
		for (let c = 0; c < 3; c++) {
			const cell = makeCell(r, c);
			rows[r].push(cell);
			allCells.push(cell);
		}
	}
	return { grid: makeGrid(allCells, 2, 2), cells: rows };
}

describe("findAdjacentCell", () => {
	describe("right", () => {
		it("moves to next column in same row", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[1][0], "right")).toBe(cells[1][1]);
		});

		it("wraps to next row when at last column", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[0][2], "right")).toBe(cells[1][0]);
		});

		it("wraps from last cell to first cell", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[2][2], "right")).toBe(cells[0][0]);
		});
	});

	describe("left", () => {
		it("moves to previous column in same row", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[1][2], "left")).toBe(cells[1][1]);
		});

		it("wraps to previous row when at first column", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[1][0], "left")).toBe(cells[0][2]);
		});

		it("wraps from first cell to last cell", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[0][0], "left")).toBe(cells[2][2]);
		});
	});

	describe("down", () => {
		it("moves to next row in same column", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[0][1], "down")).toBe(cells[1][1]);
		});

		it("wraps to next column when at last row", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[2][0], "down")).toBe(cells[0][1]);
		});

		it("wraps from bottom-right to top-left", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[2][2], "down")).toBe(cells[0][0]);
		});
	});

	describe("up", () => {
		it("moves to previous row in same column", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[2][1], "up")).toBe(cells[1][1]);
		});

		it("wraps to previous column when at first row", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[0][1], "up")).toBe(cells[2][0]);
		});

		it("wraps from top-left to bottom-right", () => {
			const { grid, cells } = makeFullGrid();
			expect(findAdjacentCell(grid, cells[0][0], "up")).toBe(cells[2][2]);
		});
	});

	describe("sparse grid", () => {
		/**
		 * Sparse grid (X = cell, . = empty):
		 *   col0  col1  col2
		 * row0  [X]   [.]   [X]
		 * row1  [.]   [X]   [.]
		 * row2  [X]   [.]   [.]
		 */
		function makeSparseGrid(): {
			grid: HeatmapGrid;
			c00: HeatmapGridCell;
			c02: HeatmapGridCell;
			c11: HeatmapGridCell;
			c20: HeatmapGridCell;
		} {
			const c00 = makeCell(0, 0);
			const c02 = makeCell(0, 2);
			const c11 = makeCell(1, 1);
			const c20 = makeCell(2, 0);
			return { grid: makeGrid([c00, c02, c11, c20], 2, 2), c00, c02, c11, c20 };
		}

		it("right skips empty cells", () => {
			const { grid, c00, c02 } = makeSparseGrid();
			expect(findAdjacentCell(grid, c00, "right")).toBe(c02);
		});

		it("left skips empty cells", () => {
			const { grid, c00, c02 } = makeSparseGrid();
			expect(findAdjacentCell(grid, c02, "left")).toBe(c00);
		});

		it("down skips empty rows and wraps to next column", () => {
			const { grid, c00, c20 } = makeSparseGrid();
			expect(findAdjacentCell(grid, c00, "down")).toBe(c20);
		});

		it("up wraps to previous column scanning bottom-to-top", () => {
			const { grid, c00, c02 } = makeSparseGrid();
			expect(findAdjacentCell(grid, c00, "up")).toBe(c02);
		});

		it("down from bottom wraps to next column top", () => {
			const { grid, c11, c20 } = makeSparseGrid();
			expect(findAdjacentCell(grid, c20, "down")).toBe(c11);
		});
	});

	describe("single cell grid", () => {
		it("returns null for all directions", () => {
			const cell = makeCell(0, 0);
			const grid = makeGrid([cell], 0, 0);
			expect(findAdjacentCell(grid, cell, "right")).toBeNull();
			expect(findAdjacentCell(grid, cell, "left")).toBeNull();
			expect(findAdjacentCell(grid, cell, "down")).toBeNull();
			expect(findAdjacentCell(grid, cell, "up")).toBeNull();
		});
	});

	describe("yearly-like grid (7 rows, many columns)", () => {
		it("navigates down within a column", () => {
			const cells = Array.from({ length: 7 }, (_, r) => makeCell(r, 0));
			const grid = makeGrid(cells, 6, 0);
			expect(findAdjacentCell(grid, cells[2], "down")).toBe(cells[3]);
		});

		it("wraps down from row 6 to next column row 0", () => {
			const col0 = Array.from({ length: 7 }, (_, r) => makeCell(r, 0));
			const col1 = Array.from({ length: 7 }, (_, r) => makeCell(r, 1));
			const grid = makeGrid([...col0, ...col1], 6, 1);
			expect(findAdjacentCell(grid, col0[6], "down")).toBe(col1[0]);
		});
	});
});
