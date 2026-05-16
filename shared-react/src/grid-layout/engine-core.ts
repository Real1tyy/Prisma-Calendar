import { adjustCellSizesRecord, adjustSizes, resolveInitialState, resolveSizes } from "./engine-state";
import { injectGridStyles } from "./styles";
import type {
	CellCleanup,
	CellOption,
	CellPlacement,
	CellRender,
	GridLayoutConfig,
	GridLayoutHandle,
	GridLayoutState,
} from "./types";

export interface CellEntry {
	instanceId: number;
	row: number;
	col: number;
	rowSpan: number | undefined;
	colSpan: number | undefined;
	id: string | undefined;
	enlargeable: boolean | undefined;
	enlargeTitle: string | undefined;
	render: CellRender;
	cleanup: CellCleanup | undefined;
}

export interface EngineSnapshot {
	cols: number;
	rows: number;
	cells: ReadonlyArray<CellEntry>;
	ghostKeys: ReadonlySet<string>;
	columnSizes: number[] | undefined;
	rowSizes: number[] | undefined;
	cellColumnSizes: Record<string, number[]> | undefined;
	cellRowSizes: Record<string, number[]> | undefined;
	destroyed: boolean;
}

export interface EngineCallbacks {
	onStateChange?: ((state: GridLayoutState) => void) | undefined;
	onCellChange?: ((row: number, col: number, id?: string) => void) | undefined;
	onOpenLayoutEditor?: GridLayoutConfig["onOpenLayoutEditor"];
	onOpenCellPicker?: GridLayoutConfig["onOpenCellPicker"];
	cellPalette?: CellOption[] | undefined;
}

/**
 * Pure state-machine for the grid layout. Owns cellMap/idMap/sizes/ghostKeys and
 * exposes the imperative `GridLayoutHandle` directly. The React view subscribes
 * via `useSyncExternalStore(subscribe, getSnapshot)` and renders the current
 * state — but the engine has no React dependency.
 */
export interface EngineCore {
	readonly handle: GridLayoutHandle;
	readonly config: GridLayoutConfig;
	subscribe(listener: () => void): () => void;
	getSnapshot(): EngineSnapshot;
	/** Update mutable callbacks. Call this every render with the latest props. */
	setCallbacks(callbacks: EngineCallbacks): void;
	/** Called by the view to associate a cell instance with its mounted DOM node. */
	registerElement(instanceId: number, el: HTMLElement | null): void;
	/** Internal: resize-handle drag commits. Not part of the public handle. */
	commitColumnSizes(sizes: number[]): void;
	commitRowSizes(sizes: number[]): void;
	commitCellColumnSizes(rowIdx: number, sizes: number[]): void;
	commitCellRowSizes(colIdx: number, sizes: number[]): void;
}

export interface EngineCoreOptions {
	/**
	 * Wraps subscriber notification so a renderer can commit synchronously.
	 * Defaults to identity. The React mount layer passes `flushSync` from
	 * `react-dom` so handle mutations result in observable DOM changes
	 * before the mutator returns — required to satisfy the imperative
	 * `GridLayoutHandle` contract.
	 */
	flush?: (cb: () => void) => void;
}

const cellKey = (row: number, col: number): string => `${row}:${col}`;

function placementToEntry(placement: CellPlacement, instanceId: number): CellEntry {
	return {
		instanceId,
		row: placement.row,
		col: placement.col,
		rowSpan: placement.rowSpan,
		colSpan: placement.colSpan,
		id: placement.id,
		enlargeable: placement.enlargeable,
		enlargeTitle: placement.enlargeTitle,
		render: placement.render,
		cleanup: placement.cleanup,
	};
}

export function createGridLayoutCore(config: GridLayoutConfig, options: EngineCoreOptions = {}): EngineCore {
	const flush = options.flush ?? ((cb: () => void) => cb());
	const trackMode = config.resizable === "track";
	const cellWidthMode = config.resizable === "cell-width";
	const cellHeightMode = config.resizable === "cell-height";

	injectGridStyles(config.cssPrefix);

	const resolved = resolveInitialState({
		initialState: config.initialState,
		cellPalette: config.cellPalette,
		cells: config.cells,
		columns: config.columns,
		rows: config.rows,
	});

	let nextInstanceId = 0;
	const newInstanceId = (): number => ++nextInstanceId;

	let cols = resolved.cols;
	let rows = resolved.rows;
	let cellMap = new Map<string, CellEntry>(
		resolved.cells.map((c) => [cellKey(c.row, c.col), placementToEntry(c, newInstanceId())])
	);
	let idMap = new Map<string, CellEntry>(
		Array.from(cellMap.values())
			.filter((e): e is CellEntry & { id: string } => e.id !== undefined)
			.map((e) => [e.id, e])
	);
	let ghostKeys = new Set<string>();
	let columnSizes =
		trackMode || cellHeightMode ? resolveSizes(config.resizable, resolved.columnSizes, resolved.cols) : undefined;
	let rowSizes =
		trackMode || cellWidthMode ? resolveSizes(config.resizable, resolved.rowSizes, resolved.rows) : undefined;
	let cellColumnSizes = cellWidthMode ? resolved.cellColumnSizes : undefined;
	let cellRowSizes = cellHeightMode ? resolved.cellRowSizes : undefined;
	let destroyed = false;

	const listeners = new Set<() => void>();
	const elementMap = new Map<number, HTMLElement>();

	let callbacks: EngineCallbacks = {
		onStateChange: config.onStateChange,
		onCellChange: config.onCellChange,
		onOpenLayoutEditor: config.onOpenLayoutEditor,
		onOpenCellPicker: config.onOpenCellPicker,
		cellPalette: config.cellPalette,
	};

	function buildSnapshot(): EngineSnapshot {
		return {
			cols,
			rows,
			cells: Array.from(cellMap.values()),
			ghostKeys: new Set(ghostKeys),
			columnSizes: columnSizes ? [...columnSizes] : undefined,
			rowSizes: rowSizes ? [...rowSizes] : undefined,
			cellColumnSizes: cellColumnSizes ? { ...cellColumnSizes } : undefined,
			cellRowSizes: cellRowSizes ? { ...cellRowSizes } : undefined,
			destroyed,
		};
	}

	let snapshot: EngineSnapshot = buildSnapshot();

	function notify(): void {
		snapshot = buildSnapshot();
		flush(() => {
			for (const l of listeners) l();
		});
	}

	function buildPublicState(): GridLayoutState {
		const stateCells: GridLayoutState["cells"] = [];
		for (const entry of cellMap.values()) {
			if (!entry.id) continue;
			stateCells.push({ optionId: entry.id, row: entry.row, col: entry.col });
		}
		return {
			columns: cols,
			rows,
			cells: stateCells,
			columnSizes: trackMode || cellHeightMode ? columnSizes : undefined,
			rowSizes: trackMode || cellWidthMode ? rowSizes : undefined,
			cellColumnSizes: cellWidthMode ? cellColumnSizes : undefined,
			cellRowSizes: cellHeightMode ? cellRowSizes : undefined,
		};
	}

	function emitStateChange(): void {
		callbacks.onStateChange?.(buildPublicState());
	}

	function swapCellAtPosition(row: number, col: number, option: CellOption): void {
		if (destroyed) return;
		const key = cellKey(row, col);
		const existing = cellMap.get(key);
		if (!existing) return;
		if (existing.id) idMap.delete(existing.id);
		const entry: CellEntry = {
			instanceId: newInstanceId(),
			row,
			col,
			rowSpan: existing.rowSpan,
			colSpan: existing.colSpan,
			id: option.id,
			enlargeable: option.enlargeable,
			enlargeTitle: option.enlargeTitle,
			render: option.render,
			cleanup: option.cleanup,
		};
		cellMap.set(key, entry);
		idMap.set(option.id, entry);
		notify();
		callbacks.onCellChange?.(row, col, option.id);
		emitStateChange();
	}

	function applyState(nextState: GridLayoutState): void {
		if (destroyed) return;
		const palette = callbacks.cellPalette ?? [];
		const paletteMap = new Map(palette.map((o) => [o.id, o]));
		const newCols = nextState.columns;
		const newRows = nextState.rows;
		const newMap = new Map<string, CellEntry>();
		const newIdMap = new Map<string, CellEntry>();
		for (const cellRef of nextState.cells) {
			const option = paletteMap.get(cellRef.optionId);
			if (!option) continue;
			const entry: CellEntry = {
				instanceId: newInstanceId(),
				row: cellRef.row,
				col: cellRef.col,
				rowSpan: undefined,
				colSpan: undefined,
				id: option.id,
				enlargeable: option.enlargeable,
				enlargeTitle: option.enlargeTitle,
				render: option.render,
				cleanup: option.cleanup,
			};
			newMap.set(cellKey(cellRef.row, cellRef.col), entry);
			newIdMap.set(option.id, entry);
		}
		cols = newCols;
		rows = newRows;
		cellMap = newMap;
		idMap = newIdMap;
		ghostKeys = new Set();
		columnSizes =
			trackMode || cellHeightMode ? resolveSizes(config.resizable, nextState.columnSizes, newCols) : undefined;
		rowSizes = trackMode || cellWidthMode ? resolveSizes(config.resizable, nextState.rowSizes, newRows) : undefined;
		cellColumnSizes = cellWidthMode ? (nextState.cellColumnSizes ?? undefined) : undefined;
		cellRowSizes = cellHeightMode ? (nextState.cellRowSizes ?? undefined) : undefined;
		notify();
		emitStateChange();
	}

	const handle: GridLayoutHandle = {
		get columns() {
			return cols;
		},
		get rows() {
			return rows;
		},
		setCell(row, col, render, cleanup) {
			if (destroyed) return;
			if (row < 0 || col < 0 || row >= rows || col >= cols) return;
			const key = cellKey(row, col);
			const existing = cellMap.get(key);
			if (existing && existing.id) idMap.delete(existing.id);
			ghostKeys.delete(key);
			const entry: CellEntry = {
				instanceId: newInstanceId(),
				row,
				col,
				rowSpan: existing?.rowSpan,
				colSpan: existing?.colSpan,
				id: undefined,
				enlargeable: existing?.enlargeable,
				enlargeTitle: existing?.enlargeTitle,
				render,
				cleanup,
			};
			cellMap.set(key, entry);
			notify();
			callbacks.onCellChange?.(row, col);
			emitStateChange();
		},
		setCellById(id, render, cleanup) {
			if (destroyed) return;
			const existing = idMap.get(id);
			if (!existing) return;
			const entry: CellEntry = {
				instanceId: newInstanceId(),
				row: existing.row,
				col: existing.col,
				rowSpan: existing.rowSpan,
				colSpan: existing.colSpan,
				id,
				enlargeable: existing.enlargeable,
				enlargeTitle: existing.enlargeTitle,
				render,
				cleanup,
			};
			cellMap.set(cellKey(existing.row, existing.col), entry);
			idMap.set(id, entry);
			notify();
			callbacks.onCellChange?.(existing.row, existing.col, id);
			emitStateChange();
		},
		clearCell(row, col) {
			if (destroyed) return;
			const key = cellKey(row, col);
			const existing = cellMap.get(key);
			if (!existing) return;
			if (existing.id) idMap.delete(existing.id);
			cellMap.delete(key);
			ghostKeys.add(key);
			notify();
			emitStateChange();
		},
		getCellElement(row, col) {
			if (destroyed) return null;
			const entry = cellMap.get(cellKey(row, col));
			if (!entry) return null;
			return elementMap.get(entry.instanceId) ?? null;
		},
		resize(newCols, newRows) {
			if (destroyed) return;
			const oldCols = cols;
			const oldRows = rows;
			for (const [key, entry] of cellMap) {
				if (entry.row >= newRows || entry.col >= newCols) {
					if (entry.id) idMap.delete(entry.id);
					cellMap.delete(key);
				}
			}
			cols = newCols;
			rows = newRows;
			columnSizes = adjustSizes(columnSizes, oldCols, newCols);
			rowSizes = adjustSizes(rowSizes, oldRows, newRows);
			cellColumnSizes = adjustCellSizesRecord(cellColumnSizes, newRows, oldCols, newCols);
			cellRowSizes = adjustCellSizesRecord(cellRowSizes, newCols, oldRows, newRows);
			notify();
			emitStateChange();
		},
		showCellPicker(row, col) {
			if (destroyed) return;
			const palette = callbacks.cellPalette;
			if (!palette?.length || !callbacks.onOpenCellPicker) return;
			const current = cellMap.get(cellKey(row, col));
			const currentId = current?.id;
			const usedIds = new Set<string>();
			for (const entry of cellMap.values()) {
				if (entry.id) usedIds.add(entry.id);
			}
			callbacks.onOpenCellPicker(row, col, currentId, usedIds, palette, (option) => {
				swapCellAtPosition(row, col, option);
			});
		},
		showLayoutEditor() {
			if (destroyed) return;
			const palette = callbacks.cellPalette;
			if (!palette?.length || !callbacks.onOpenLayoutEditor) return;
			callbacks.onOpenLayoutEditor(buildPublicState(), palette, applyState);
		},
		getState() {
			return buildPublicState();
		},
		destroy() {
			if (destroyed) return;
			destroyed = true;
			notify();
			cellMap.clear();
			idMap.clear();
			ghostKeys.clear();
			elementMap.clear();
		},
	};

	return {
		handle,
		config,
		subscribe(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		},
		getSnapshot() {
			return snapshot;
		},
		setCallbacks(next) {
			callbacks = next;
		},
		registerElement(instanceId, el) {
			if (el === null) elementMap.delete(instanceId);
			else elementMap.set(instanceId, el);
		},
		commitColumnSizes(sizes) {
			if (destroyed) return;
			columnSizes = sizes;
			notify();
			emitStateChange();
		},
		commitRowSizes(sizes) {
			if (destroyed) return;
			rowSizes = sizes;
			notify();
			emitStateChange();
		},
		commitCellColumnSizes(rowIdx, sizes) {
			if (destroyed) return;
			const current = cellColumnSizes ?? {};
			cellColumnSizes = { ...current, [String(rowIdx)]: sizes };
			notify();
			emitStateChange();
		},
		commitCellRowSizes(colIdx, sizes) {
			if (destroyed) return;
			const current = cellRowSizes ?? {};
			cellRowSizes = { ...current, [String(colIdx)]: sizes };
			notify();
			emitStateChange();
		},
	};
}
