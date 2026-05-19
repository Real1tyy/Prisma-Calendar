import type { App } from "obsidian";
import { z } from "zod";

/**
 * Imperative cell content callback. Receives a host `<div>`; consumer mounts
 * arbitrary DOM into it. Cleanup, if provided, runs when the cell is replaced
 * or unmounted. Use this for libraries that need a real DOM element
 * (Chart.js, FullCalendar, Cytoscape). For React content, use the `<Cell>`
 * children API on `<GridLayout>` instead — no shim, no cleanup boilerplate.
 */
export type CellRender = (container: HTMLElement) => void | Promise<void>;
export type CellCleanup = () => void;

export interface CellOption {
	id: string;
	label: string;
	render: CellRender;
	cleanup?: CellCleanup;
	/** When true, shows an enlarge button that opens the cell content in a modal. */
	enlargeable?: boolean;
	/** Title shown in the modal header when enlarged. Falls back to id if not set. */
	enlargeTitle?: string;
}

export interface CellPlacement extends CellOption {
	row: number;
	col: number;
	rowSpan?: number;
	colSpan?: number;
}

/** Zod schema for persisted grid layout state. Reuse in plugin settings schemas. */
export const GridLayoutStateSchema = z
	.object({
		columns: z.number().int().positive().catch(2),
		rows: z.number().int().positive().catch(2),
		cells: z
			.array(
				z.object({
					optionId: z.string(),
					row: z.number().int().nonnegative(),
					col: z.number().int().nonnegative(),
				})
			)
			.catch([]),
		columnSizes: z.array(z.number().positive()).optional().catch(undefined),
		rowSizes: z.array(z.number().positive()).optional().catch(undefined),
		cellColumnSizes: z.record(z.string(), z.array(z.number().positive())).optional().catch(undefined),
		cellRowSizes: z.record(z.string(), z.array(z.number().positive())).optional().catch(undefined),
	})
	.transform((state) => ({
		...state,
		cells: state.cells.filter((c) => c.row < state.rows && c.col < state.columns),
		columnSizes: state.columnSizes?.length === state.columns ? state.columnSizes : undefined,
		rowSizes: state.rowSizes?.length === state.rows ? state.rowSizes : undefined,
		cellColumnSizes: state.cellColumnSizes
			? Object.fromEntries(
					Object.entries(state.cellColumnSizes).filter(
						([row, sizes]) => Number(row) < state.rows && sizes.length === state.columns
					)
				)
			: undefined,
		cellRowSizes: state.cellRowSizes
			? Object.fromEntries(
					Object.entries(state.cellRowSizes).filter(
						([col, sizes]) => Number(col) < state.columns && sizes.length === state.rows
					)
				)
			: undefined,
	}));

/** Serializable snapshot of grid layout state. Safe to persist in plugin settings. */
export type GridLayoutState = z.infer<typeof GridLayoutStateSchema>;

/**
 * Shape of the defaults a settings-side `gridStateField()` declaration carries.
 * Mirrors the persistable subset of `GridLayoutState` that's actually meaningful
 * to seed at "no saved state yet" time — `cells` defaults to `[]` (the engine
 * synthesizes initial placements from `<Cell>` children).
 */
export interface GridStateFieldDefaults {
	columns: number;
	rows: number;
	columnSizes?: number[];
	rowSizes?: number[];
}

/**
 * Build a Zod field whose parsed value is a non-optional `GridLayoutState`
 * seeded from `defaults` when nothing has been persisted yet. Pairs with the
 * React `usePersistedGridState(store, path)` hook: the schema owns the initial
 * layout (columns × rows + initial sizes) and the hook owns the read / persist
 * wiring, so consumers don't hand-roll either side.
 */
export function gridStateField(defaults: GridStateFieldDefaults) {
	const seed: GridLayoutState = {
		columns: defaults.columns,
		rows: defaults.rows,
		cells: [],
		columnSizes: defaults.columnSizes,
		rowSizes: defaults.rowSizes,
		cellColumnSizes: undefined,
		cellRowSizes: undefined,
	};
	return GridLayoutStateSchema.default(seed).catch(seed);
}

/**
 * Build a Zod field that holds a `Record<id, GridLayoutState>` — the
 * settings-side counterpart to `usePersistedGridStateById`. Default is `{}`;
 * per-id seeds are supplied by the React hook when the id is first rendered
 * (the schema can't know which ids exist or what defaults each wants).
 */
export function gridStateRecordField() {
	const empty: Record<string, GridLayoutState> = {};
	return z.record(z.string(), GridLayoutStateSchema).default(empty).catch(empty);
}

export type ResizeMode = "track" | "cell-width" | "cell-height";

export interface GridLayoutConfig {
	columns: number;
	rows: number;
	cssPrefix: string;
	cells?: CellPlacement[];
	gap?: string;
	minCellWidth?: number;
	/** When true, adds a `{cssPrefix}grid-cell-divider` class to each cell for border styling. */
	dividers?: boolean;
	/** Catalog of all swappable cell options. When provided, each cell gets a swap button. */
	cellPalette?: CellOption[];
	/**
	 * Persisted state to restore. When provided, overrides `cells`, `columns`, and `rows`.
	 * Cell option IDs are resolved from `cellPalette`.
	 */
	initialState?: GridLayoutState;
	onCellChange?: (row: number, col: number, id?: string) => void;
	/** Fires on any state mutation (swap, resize) with the new serializable state. */
	onStateChange?: (state: GridLayoutState) => void;
	/**
	 * Invoked when the user triggers "edit layout" (via gear button or command).
	 * Receives the current state, palette, an `applyState` callback for submission,
	 * and the consumer's `defaultState` (derived from the original `<Cell>` palette)
	 * that the in-editor Reset button restores to.
	 */
	onOpenLayoutEditor?: (
		currentState: GridLayoutState,
		cellPalette: CellOption[],
		applyState: (state: GridLayoutState) => void,
		defaultState: GridLayoutState
	) => void;
	/**
	 * Invoked when the user requests the cell palette picker for a specific cell
	 * (via per-cell swap button or command). Caller opens a UI and calls
	 * `selectOption` with the chosen palette option when the user picks one.
	 */
	onOpenCellPicker?: (
		row: number,
		col: number,
		currentId: string | undefined,
		usedIds: Set<string>,
		cellPalette: CellOption[],
		selectOption: (option: CellOption) => void
	) => void;
	/** When true, renders a gear button on the grid to open the layout editor. Requires `app`, `cellPalette`, and `onOpenLayoutEditor`. */
	editable?: boolean;
	/**
	 * Enables drag handles for resizing. Mutually exclusive with `minCellWidth`.
	 * - `"track"`: resize entire grid columns/rows uniformly.
	 * - `"cell-width"`: per-row independent column widths (cells in row sub-grids).
	 * - `"cell-height"`: per-column independent row heights (cells in column sub-grids).
	 */
	resizable?: ResizeMode;
	/** Required when any cell has `enlargeable: true`, `cellPalette`, or `editable` is provided. */
	app?: App;
}

export interface GridLayoutHandle {
	setCell(row: number, col: number, render: CellRender, cleanup?: CellCleanup): void;
	setCellById(id: string, render: CellRender, cleanup?: CellCleanup): void;
	clearCell(row: number, col: number): void;
	getCellElement(row: number, col: number): HTMLElement | null;
	resize(columns: number, rows: number): void;
	/** Opens the cell palette picker for the given position. No-op if no palette configured. */
	showCellPicker(row: number, col: number): void;
	/** Opens the layout editor modal. No-op if no palette or app configured. */
	showLayoutEditor(): void;
	/** Returns a serializable snapshot of the current layout state. */
	getState(): GridLayoutState;
	readonly columns: number;
	readonly rows: number;
	destroy(): void;
}
