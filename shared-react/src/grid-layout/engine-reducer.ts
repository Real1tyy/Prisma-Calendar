import { adjustCellSizesRecord, adjustSizes, resolveSizes } from "./engine-state";
import type { GridLayoutState, ResizeMode } from "./types";

/**
 * One occupied slot in the grid. `instanceId` is React's reconciliation key —
 * incrementing on a swap forces a clean unmount/remount of the cell content.
 *
 * In the React-native engine, every placement references a palette entry by
 * `id`. The actual cell content is a React subtree owned by the consumer (via
 * the `<Cell>` children API); the engine never holds render closures.
 */
export interface Placement {
	instanceId: number;
	row: number;
	col: number;
	rowSpan: number | undefined;
	colSpan: number | undefined;
	id: string;
}

export interface EngineState {
	cols: number;
	rows: number;
	placements: Placement[];
	ghostKeys: Set<string>;
	columnSizes: number[] | undefined;
	rowSizes: number[] | undefined;
	cellColumnSizes: Record<string, number[]> | undefined;
	cellRowSizes: Record<string, number[]> | undefined;
	nextInstanceId: number;
	destroyed: boolean;
}

export const cellKey = (row: number, col: number): string => `${row}:${col}`;

export type Action =
	| { type: "swapCell"; row: number; col: number; optionId: string }
	| { type: "clearCell"; row: number; col: number }
	| { type: "resize"; cols: number; rows: number }
	| { type: "applyState"; state: GridLayoutState }
	| { type: "commitColumnSizes"; sizes: number[] }
	| { type: "commitRowSizes"; sizes: number[] }
	| { type: "commitCellColumnSizes"; rowIdx: number; sizes: number[] }
	| { type: "commitCellRowSizes"; colIdx: number; sizes: number[] }
	| { type: "destroy" };

export function findPlacementAt(state: EngineState, row: number, col: number): Placement | undefined {
	return state.placements.find((p) => p.row === row && p.col === col);
}

function addToSet<T>(set: Set<T>, value: T): Set<T> {
	if (set.has(value)) return set;
	const next = new Set(set);
	next.add(value);
	return next;
}

function removeFromSet<T>(set: Set<T>, value: T): Set<T> {
	if (!set.has(value)) return set;
	const next = new Set(set);
	next.delete(value);
	return next;
}

export function reducer(state: EngineState, action: Action): EngineState {
	if (state.destroyed && action.type !== "destroy") return state;
	switch (action.type) {
		case "destroy":
			return state.destroyed ? state : { ...state, destroyed: true };
		case "swapCell": {
			const existing = findPlacementAt(state, action.row, action.col);
			const next: Placement = {
				instanceId: state.nextInstanceId,
				row: action.row,
				col: action.col,
				rowSpan: existing?.rowSpan,
				colSpan: existing?.colSpan,
				id: action.optionId,
			};
			return {
				...state,
				placements: [...state.placements.filter((p) => !(p.row === action.row && p.col === action.col)), next],
				ghostKeys: removeFromSet(state.ghostKeys, cellKey(action.row, action.col)),
				nextInstanceId: state.nextInstanceId + 1,
			};
		}
		case "clearCell": {
			const existing = findPlacementAt(state, action.row, action.col);
			if (!existing) return state;
			return {
				...state,
				placements: state.placements.filter((p) => !(p.row === action.row && p.col === action.col)),
				ghostKeys: addToSet(state.ghostKeys, cellKey(action.row, action.col)),
			};
		}
		case "resize": {
			const remaining = state.placements.filter((p) => p.row < action.rows && p.col < action.cols);
			return {
				...state,
				cols: action.cols,
				rows: action.rows,
				placements: remaining,
				columnSizes: adjustSizes(state.columnSizes, state.cols, action.cols),
				rowSizes: adjustSizes(state.rowSizes, state.rows, action.rows),
				cellColumnSizes: adjustCellSizesRecord(state.cellColumnSizes, action.rows, state.cols, action.cols),
				cellRowSizes: adjustCellSizesRecord(state.cellRowSizes, action.cols, state.rows, action.rows),
			};
		}
		case "applyState": {
			let nextId = state.nextInstanceId;
			const newPlacements: Placement[] = action.state.cells.map((cell) => ({
				instanceId: nextId++,
				row: cell.row,
				col: cell.col,
				rowSpan: undefined,
				colSpan: undefined,
				id: cell.optionId,
			}));
			return {
				...state,
				cols: action.state.columns,
				rows: action.state.rows,
				placements: newPlacements,
				ghostKeys: new Set(),
				columnSizes: action.state.columnSizes,
				rowSizes: action.state.rowSizes,
				cellColumnSizes: action.state.cellColumnSizes,
				cellRowSizes: action.state.cellRowSizes,
				nextInstanceId: nextId,
			};
		}
		case "commitColumnSizes":
			return { ...state, columnSizes: action.sizes };
		case "commitRowSizes":
			return { ...state, rowSizes: action.sizes };
		case "commitCellColumnSizes":
			return {
				...state,
				cellColumnSizes: { ...(state.cellColumnSizes ?? {}), [String(action.rowIdx)]: action.sizes },
			};
		case "commitCellRowSizes":
			return {
				...state,
				cellRowSizes: { ...(state.cellRowSizes ?? {}), [String(action.colIdx)]: action.sizes },
			};
	}
}

export function buildPublicState(state: EngineState, resizable: ResizeMode | undefined): GridLayoutState {
	const trackMode = resizable === "track";
	const cellWidthMode = resizable === "cell-width";
	const cellHeightMode = resizable === "cell-height";
	return {
		columns: state.cols,
		rows: state.rows,
		cells: state.placements.map((p) => ({ optionId: p.id, row: p.row, col: p.col })),
		columnSizes: trackMode || cellHeightMode ? state.columnSizes : undefined,
		rowSizes: trackMode || cellWidthMode ? state.rowSizes : undefined,
		cellColumnSizes: cellWidthMode ? state.cellColumnSizes : undefined,
		cellRowSizes: cellHeightMode ? state.cellRowSizes : undefined,
	};
}

export interface BuildInitialStateInput {
	cols: number;
	rows: number;
	resizable: ResizeMode | undefined;
	initialState: GridLayoutState | undefined;
	knownIds: Set<string>;
	defaultPlacements: ReadonlyArray<{
		id: string;
		row: number;
		col: number;
		rowSpan?: number | undefined;
		colSpan?: number | undefined;
	}>;
}

export function buildInitialState(input: BuildInitialStateInput): EngineState {
	const { cols, rows, resizable, initialState, knownIds, defaultPlacements } = input;
	const trackMode = resizable === "track";
	const cellWidthMode = resizable === "cell-width";
	const cellHeightMode = resizable === "cell-height";

	let nextInstanceId = 0;
	const placements: Placement[] = [];

	const placementSource = initialState?.cells.length
		? initialState.cells
		: defaultPlacements.map((p) => ({ optionId: p.id, row: p.row, col: p.col }));
	const spans = new Map<string, { rowSpan: number | undefined; colSpan: number | undefined }>(
		defaultPlacements.map((p) => [p.id, { rowSpan: p.rowSpan, colSpan: p.colSpan }] as const)
	);

	const actualCols = initialState?.columns ?? cols;
	const actualRows = initialState?.rows ?? rows;

	for (const cell of placementSource) {
		if (!knownIds.has(cell.optionId)) continue;
		if (cell.row >= actualRows || cell.col >= actualCols) continue;
		const span = spans.get(cell.optionId);
		placements.push({
			instanceId: nextInstanceId++,
			row: cell.row,
			col: cell.col,
			rowSpan: span?.rowSpan,
			colSpan: span?.colSpan,
			id: cell.optionId,
		});
	}

	const dimsAgree = !initialState || (initialState.columns === cols && initialState.rows === rows);
	const persistedColumnSizes = dimsAgree ? initialState?.columnSizes : undefined;
	const persistedRowSizes = dimsAgree ? initialState?.rowSizes : undefined;
	const persistedCellColumnSizes = dimsAgree ? initialState?.cellColumnSizes : undefined;
	const persistedCellRowSizes = dimsAgree ? initialState?.cellRowSizes : undefined;

	return {
		cols: actualCols,
		rows: actualRows,
		placements,
		ghostKeys: new Set(),
		columnSizes: trackMode || cellHeightMode ? resolveSizes(resizable, persistedColumnSizes, actualCols) : undefined,
		rowSizes: trackMode || cellWidthMode ? resolveSizes(resizable, persistedRowSizes, actualRows) : undefined,
		cellColumnSizes: cellWidthMode ? persistedCellColumnSizes : undefined,
		cellRowSizes: cellHeightMode ? persistedCellRowSizes : undefined,
		nextInstanceId,
		destroyed: false,
	};
}
