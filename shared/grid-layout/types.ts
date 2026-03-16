import type { App } from "obsidian";
import { z } from "zod";

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
	})
	.transform((state) => ({
		...state,
		cells: state.cells.filter((c) => c.row < state.rows && c.col < state.columns),
		columnSizes: state.columnSizes?.length === state.columns ? state.columnSizes : undefined,
		rowSizes: state.rowSizes?.length === state.rows ? state.rowSizes : undefined,
	}));

/** Serializable snapshot of grid layout state. Safe to persist in plugin settings. */
export type GridLayoutState = z.infer<typeof GridLayoutStateSchema>;

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
	/** When true, renders a gear button on the grid to open the layout editor. Requires `app` and `cellPalette`. */
	editable?: boolean;
	/** When true, adds drag handles between grid tracks for resizing columns and rows. Mutually exclusive with `minCellWidth`. */
	resizable?: boolean;
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
