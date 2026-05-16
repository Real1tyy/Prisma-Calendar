import type { CellOption, CellPlacement, GridLayoutState, ResizeMode } from "./types";

interface ResolveInput {
	columns: number;
	rows: number;
	cells: CellPlacement[] | undefined;
	cellPalette: CellOption[] | undefined;
	initialState: GridLayoutState | undefined;
}

export interface ResolvedInitialState {
	cols: number;
	rows: number;
	cells: CellPlacement[];
	columnSizes?: number[];
	rowSizes?: number[];
	cellColumnSizes?: Record<string, number[]>;
	cellRowSizes?: Record<string, number[]>;
}

export function resolveInitialState(input: ResolveInput): ResolvedInitialState {
	const { initialState, cellPalette, cells: configCells } = input;
	if (!initialState) {
		return { cols: input.columns, rows: input.rows, cells: configCells ?? [] };
	}

	const dimsAgree = initialState.columns === input.columns && initialState.rows === input.rows;
	const persistedSizes = dimsAgree
		? {
				...(initialState.columnSizes !== undefined ? { columnSizes: initialState.columnSizes } : {}),
				...(initialState.rowSizes !== undefined ? { rowSizes: initialState.rowSizes } : {}),
				...(initialState.cellColumnSizes !== undefined ? { cellColumnSizes: initialState.cellColumnSizes } : {}),
				...(initialState.cellRowSizes !== undefined ? { cellRowSizes: initialState.cellRowSizes } : {}),
			}
		: {};

	if (!cellPalette?.length) {
		return { cols: input.columns, rows: input.rows, cells: configCells ?? [], ...persistedSizes };
	}

	const paletteMap = new Map(cellPalette.map((o) => [o.id, o]));
	const resolvedCells: CellPlacement[] = [];
	for (const cell of initialState.cells) {
		const option = paletteMap.get(cell.optionId);
		if (option) resolvedCells.push({ ...option, row: cell.row, col: cell.col });
	}

	return {
		cols: initialState.columns,
		rows: initialState.rows,
		cells: resolvedCells,
		...persistedSizes,
	};
}

export function defaultSizes(count: number): number[] {
	return Array.from({ length: count }, () => 1);
}

export function adjustSizes(current: number[] | undefined, oldCount: number, newCount: number): number[] | undefined {
	if (!current) return undefined;
	if (newCount <= 0) return undefined;
	if (newCount === oldCount) return current;
	if (newCount < oldCount) return current.slice(0, newCount);
	return [...current, ...Array.from({ length: newCount - oldCount }, () => 1)];
}

/**
 * Adjust a per-axis sizes record (cellColumnSizes / cellRowSizes) for a resize.
 * Drops outer-axis keys past the new limit and rewrites each remaining sizes
 * array for the new inner-axis length. Returns undefined when the result is empty.
 */
export function adjustCellSizesRecord(
	record: Record<string, number[]> | undefined,
	outerLimit: number,
	oldInner: number,
	newInner: number
): Record<string, number[]> | undefined {
	if (!record) return undefined;
	const next: Record<string, number[]> = {};
	for (const [key, sizes] of Object.entries(record)) {
		if (Number(key) >= outerLimit) continue;
		const adjusted = adjustSizes(sizes, oldInner, newInner);
		if (adjusted) next[key] = adjusted;
	}
	return Object.keys(next).length > 0 ? next : undefined;
}

export function resolveSizes(
	resizable: ResizeMode | undefined,
	provided: number[] | undefined,
	count: number
): number[] | undefined {
	if (!resizable) return undefined;
	if (provided?.length === count) return provided;
	return defaultSizes(count);
}

export function sizesToTemplate(sizes: number[] | undefined, count: number, fallback: string): string {
	if (sizes) return sizes.map((s) => `${s}fr`).join(" ");
	return `repeat(${count}, ${fallback})`;
}
