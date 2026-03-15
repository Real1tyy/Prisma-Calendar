import type { App } from "obsidian";

export type CellRender = (container: HTMLElement) => void | Promise<void>;
export type CellCleanup = () => void;

export interface CellDefinition {
	id?: string;
	row: number;
	col: number;
	rowSpan?: number;
	colSpan?: number;
	render: CellRender;
	cleanup?: CellCleanup;
	/** When true, shows an enlarge button that opens the cell content in a modal. */
	enlargeable?: boolean;
	/** Title shown in the modal header when enlarged. Falls back to id if not set. */
	enlargeTitle?: string;
}

export interface GridLayoutConfig {
	columns: number;
	rows: number;
	cssPrefix: string;
	cells?: CellDefinition[];
	gap?: string;
	minCellWidth?: number;
	/** When true, adds a `{cssPrefix}grid-cell-divider` class to each cell for border styling. */
	dividers?: boolean;
	onCellChange?: (row: number, col: number, id?: string) => void;
	/** Required when any cell has `enlargeable: true`. The Obsidian App instance used to open modals. */
	app?: App;
}

export interface GridLayoutHandle {
	setCell(row: number, col: number, render: CellRender, cleanup?: CellCleanup): void;
	setCellById(id: string, render: CellRender, cleanup?: CellCleanup): void;
	clearCell(row: number, col: number): void;
	getCellElement(row: number, col: number): HTMLElement | null;
	resize(columns: number, rows: number): void;
	readonly columns: number;
	readonly rows: number;
	destroy(): void;
}
