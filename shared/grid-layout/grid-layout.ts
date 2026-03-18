import { setIcon } from "obsidian";

import { showModal } from "../component-renderer/modal";
import { createCssUtils } from "../core/css-utils";
import type { GridResizeHandle, ResizeAxisConfig } from "./grid-resize";
import { setupGridResize } from "./grid-resize";
import { openLayoutEditor } from "./layout-editor";
import { injectGridStyles } from "./styles";
import type {
	CellCleanup,
	CellOption,
	CellPlacement,
	CellRender,
	GridLayoutConfig,
	GridLayoutHandle,
	GridLayoutState,
	ResizeMode,
} from "./types";

interface CellEntry {
	element: HTMLElement;
	render: CellRender;
	cleanup?: CellCleanup;
	id?: string;
	enlargeable?: boolean;
	enlargeTitle?: string;
}

interface PerCellAxis {
	containers: HTMLElement[];
	handles: Map<number, GridResizeHandle>;
	containerCls: string;
	gapProp: "columnGap" | "rowGap";
	templateProp: "gridTemplateColumns" | "gridTemplateRows";
	perContainerResizeKey: "columns" | "rows";
	globalResizeKey: "columns" | "rows";
	containerCount(): number;
	getContainerIndex(row: number, col: number): number;
	getSizes(containerIndex: number): number[];
	setSizes(containerIndex: number, sizes: number[]): void;
	getGlobalSizes(): number[];
	setGlobalSizes(sizes: number[]): void;
	getPerCellSizesMap(): Record<string, number[]> | undefined;
}

function cellKey(row: number, col: number): string {
	return `${row}:${col}`;
}

function setGridVar(el: HTMLElement, name: string, value: string): void {
	el.style.setProperty(name, value);
}

function resolveInitialState(config: GridLayoutConfig): {
	cols: number;
	rows: number;
	cells: CellPlacement[];
	columnSizes?: number[];
	rowSizes?: number[];
	cellColumnSizes?: Record<string, number[]>;
	cellRowSizes?: Record<string, number[]>;
} {
	const { initialState, cellPalette, cells: configCells } = config;

	if (!initialState || !cellPalette?.length) {
		return { cols: config.columns, rows: config.rows, cells: configCells ?? [] };
	}

	const paletteMap = new Map(cellPalette.map((o) => [o.id, o]));
	const resolvedCells: CellPlacement[] = [];

	for (const cell of initialState.cells) {
		const option = paletteMap.get(cell.optionId);
		if (option) {
			resolvedCells.push({ ...option, row: cell.row, col: cell.col });
		}
	}

	return {
		cols: initialState.columns,
		rows: initialState.rows,
		cells: resolvedCells,
		...(initialState.columnSizes !== undefined ? { columnSizes: initialState.columnSizes } : {}),
		...(initialState.rowSizes !== undefined ? { rowSizes: initialState.rowSizes } : {}),
		...(initialState.cellColumnSizes !== undefined ? { cellColumnSizes: initialState.cellColumnSizes } : {}),
		...(initialState.cellRowSizes !== undefined ? { cellRowSizes: initialState.cellRowSizes } : {}),
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

function resolveSizes(
	resizable: ResizeMode | undefined,
	persisted: number[] | undefined,
	count: number
): number[] | undefined {
	return resizable ? (persisted ?? defaultSizes(count)) : undefined;
}

function sizesToTemplate(sizes: number[] | undefined, count: number, fallbackUnit: string): string {
	return sizes ? sizes.map((s) => `${s}fr`).join(" ") : `repeat(${count}, ${fallbackUnit})`;
}

function adjustPerCellSizes(
	current: Record<string, number[]> | undefined,
	oldCrossCount: number,
	newCrossCount: number,
	newContainerCount: number
): Record<string, number[]> | undefined {
	if (!current) return undefined;
	const result: Record<string, number[]> = {};
	for (const [idx, sizes] of Object.entries(current)) {
		if (Number(idx) >= newContainerCount) continue;
		result[idx] = adjustSizes(sizes, oldCrossCount, newCrossCount) ?? defaultSizes(newCrossCount);
	}
	return Object.keys(result).length > 0 ? result : undefined;
}

export function createGridLayout(container: HTMLElement, config: GridLayoutConfig): GridLayoutHandle {
	const { cssPrefix, gap, minCellWidth, dividers, cellPalette, editable, resizable, onCellChange, onStateChange } =
		config;
	const css = createCssUtils(cssPrefix);
	injectGridStyles(cssPrefix);

	const cellWidthMode = resizable === "cell-width";
	const cellHeightMode = resizable === "cell-height";
	const trackMode = resizable === "track";
	const hasCellAxis = cellWidthMode || cellHeightMode;
	const isResizable = hasCellAxis || trackMode;

	const initial = resolveInitialState(config);
	let cols = initial.cols;
	let rows = initial.rows;
	let columnSizes = trackMode || cellHeightMode ? resolveSizes(resizable, initial.columnSizes, cols) : undefined;
	let rowSizes = trackMode || cellWidthMode ? resolveSizes(resizable, initial.rowSizes, rows) : undefined;
	let cellColumnSizes: Record<string, number[]> | undefined = cellWidthMode
		? (initial.cellColumnSizes ?? undefined)
		: undefined;
	let cellRowSizes: Record<string, number[]> | undefined = cellHeightMode
		? (initial.cellRowSizes ?? undefined)
		: undefined;
	let destroyed = false;

	const cellMap = new Map<string, CellEntry>();
	const idMap = new Map<string, string>();

	const perCell: PerCellAxis | null = hasCellAxis
		? cellWidthMode
			? {
					containers: [],
					handles: new Map(),
					containerCls: "grid-row",
					gapProp: "columnGap",
					templateProp: "gridTemplateColumns",
					perContainerResizeKey: "columns",
					globalResizeKey: "rows",
					containerCount: () => rows,
					getContainerIndex: (row: number) => row,
					getSizes: (i: number) => cellColumnSizes?.[String(i)] ?? defaultSizes(cols),
					setSizes: (i: number, s: number[]) => {
						if (!cellColumnSizes) cellColumnSizes = {};
						cellColumnSizes[String(i)] = s;
					},
					getGlobalSizes: () => rowSizes ?? defaultSizes(rows),
					setGlobalSizes: (s: number[]) => {
						rowSizes = s;
					},
					getPerCellSizesMap: () => cellColumnSizes,
				}
			: {
					containers: [],
					handles: new Map(),
					containerCls: "grid-col",
					gapProp: "rowGap",
					templateProp: "gridTemplateRows",
					perContainerResizeKey: "rows",
					globalResizeKey: "columns",
					containerCount: () => cols,
					getContainerIndex: (_row: number, col: number) => col,
					getSizes: (i: number) => cellRowSizes?.[String(i)] ?? defaultSizes(rows),
					setSizes: (i: number, s: number[]) => {
						if (!cellRowSizes) cellRowSizes = {};
						cellRowSizes[String(i)] = s;
					},
					getGlobalSizes: () => columnSizes ?? defaultSizes(cols),
					setGlobalSizes: (s: number[]) => {
						columnSizes = s;
					},
					getPerCellSizesMap: () => cellRowSizes,
				}
		: null;

	const gridEl = container.createDiv(css.cls("grid"));
	if (perCell) buildPerCellContainers();
	applyGridStyles();
	renderCells(initial.cells);

	let resizeHandle: GridResizeHandle | null = null;

	if (isResizable && !minCellWidth) {
		if (trackMode) {
			const makeAxis = (getSizes: () => number[] | undefined, count: () => number, set: (s: number[]) => void) => ({
				getSizes: () => getSizes() ?? defaultSizes(count()),
				onSizesChange: (sizes: number[]) => {
					set(sizes);
					applyGridStyles();
					emitStateChange();
				},
			});

			resizeHandle = setupGridResize({
				gridEl,
				css,
				columns: makeAxis(
					() => columnSizes,
					() => cols,
					(s) => {
						columnSizes = s;
					}
				),
				rows: makeAxis(
					() => rowSizes,
					() => rows,
					(s) => {
						rowSizes = s;
					}
				),
			});
		} else if (perCell) {
			const globalAxis: ResizeAxisConfig = {
				getSizes: () => perCell.getGlobalSizes(),
				onSizesChange: (sizes) => {
					perCell.setGlobalSizes(sizes);
					applyGridStyles();
					emitStateChange();
				},
			};

			resizeHandle = setupGridResize({
				gridEl,
				css,
				[perCell.globalResizeKey]: globalAxis,
			});
			setupPerCellResize();
		}
	}

	if (editable && config.app && cellPalette?.length) {
		const editBtn = gridEl.createEl("button", { cls: css.cls("grid-edit-btn") });
		setIcon(editBtn, "settings-2");
		editBtn.addEventListener("click", () => handle.showLayoutEditor());
	}

	function applyContainerTemplate(index: number): void {
		if (!perCell) return;
		const el = perCell.containers[index];
		if (!el) return;
		const sizes = perCell.getSizes(index);
		el.style[perCell.templateProp] = sizes.map((s) => `${s}fr`).join(" ");
	}

	function buildPerCellContainers(): void {
		if (!perCell) return;
		for (const el of perCell.containers) el.remove();
		perCell.containers.length = 0;

		for (let i = 0; i < perCell.containerCount(); i++) {
			const el = gridEl.createDiv(css.cls(perCell.containerCls));
			el.style.display = "grid";
			el.style.position = "relative";
			el.style.minHeight = "0";
			el.style.minWidth = "0";
			if (gap) el.style[perCell.gapProp] = gap;
			perCell.containers.push(el);
			applyContainerTemplate(i);
		}
	}

	function setupPerCellResize(): void {
		destroyPerCellResize();
		if (!perCell) return;

		for (let i = 0; i < perCell.containerCount(); i++) {
			const el = perCell.containers[i];
			if (!el) continue;

			const idx = i;
			const axisConfig: ResizeAxisConfig = {
				getSizes: () => perCell.getSizes(idx),
				onSizesChange: (sizes) => {
					perCell.setSizes(idx, sizes);
					applyContainerTemplate(idx);
					emitStateChange();
				},
			};

			const h = setupGridResize({
				gridEl: el,
				css,
				[perCell.perContainerResizeKey]: axisConfig,
			});
			perCell.handles.set(i, h);
		}
	}

	function destroyPerCellResize(): void {
		if (!perCell) return;
		for (const h of perCell.handles.values()) h.destroy();
		perCell.handles.clear();
	}

	function renderCells(cells: CellPlacement[]): void {
		for (const cell of cells) {
			addCell(
				cell.row,
				cell.col,
				cell.render,
				cell.cleanup,
				cell.id,
				cell.rowSpan,
				cell.colSpan,
				cell.enlargeable,
				cell.enlargeTitle
			);
		}
	}

	function clearAllCells(): void {
		for (const entry of cellMap.values()) {
			entry.cleanup?.();
			entry.element.remove();
		}
		cellMap.clear();
		idMap.clear();
	}

	function rebuildFromState(state: GridLayoutState): void {
		clearAllCells();

		const resolved = resolveInitialState({ ...config, initialState: state });
		cols = resolved.cols;
		rows = resolved.rows;
		columnSizes = trackMode || cellHeightMode ? resolveSizes(resizable, resolved.columnSizes, cols) : undefined;
		rowSizes = trackMode || cellWidthMode ? resolveSizes(resizable, resolved.rowSizes, rows) : undefined;
		cellColumnSizes = cellWidthMode ? (resolved.cellColumnSizes ?? undefined) : undefined;
		cellRowSizes = cellHeightMode ? (resolved.cellRowSizes ?? undefined) : undefined;

		if (perCell) buildPerCellContainers();
		applyGridStyles();
		renderCells(resolved.cells);
		resizeHandle?.update();
		if (perCell) setupPerCellResize();
		emitStateChange();
	}

	function applyGridStyles(): void {
		css.addCls(gridEl, "grid");

		if (cellWidthMode) {
			setGridVar(gridEl, "--grid-columns", "1fr");
			setGridVar(gridEl, "--grid-rows", sizesToTemplate(rowSizes, rows, "auto"));
		} else if (cellHeightMode) {
			setGridVar(gridEl, "--grid-columns", sizesToTemplate(columnSizes, cols, "1fr"));
			setGridVar(gridEl, "--grid-rows", "1fr");
		} else {
			const colTemplate = minCellWidth
				? `repeat(auto-fit, minmax(${minCellWidth}px, 1fr))`
				: sizesToTemplate(columnSizes, cols, "1fr");
			setGridVar(gridEl, "--grid-columns", colTemplate);
			setGridVar(gridEl, "--grid-rows", sizesToTemplate(rowSizes, rows, "auto"));
		}

		if (gap) setGridVar(gridEl, "--grid-gap", gap);
	}

	function buildState(): GridLayoutState {
		const stateCells: GridLayoutState["cells"] = [];
		for (const [key, entry] of cellMap) {
			if (!entry.id) continue;
			const { row, col } = parseKey(key);
			stateCells.push({ optionId: entry.id, row, col });
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
		onStateChange?.(buildState());
	}

	function createCellElement(row: number, col: number, rowSpan?: number, colSpan?: number): HTMLElement {
		const parent = perCell ? perCell.containers[perCell.getContainerIndex(row, col)] : gridEl;
		if (!parent) return gridEl.createDiv(css.cls("grid-cell"));

		const el = parent.createDiv(css.cls("grid-cell"));
		if (dividers) css.addCls(el, "grid-cell-divider");
		el.dataset["row"] = String(row);
		el.dataset["col"] = String(col);

		if (perCell) {
			el.style.minWidth = "0";
			el.style.minHeight = "0";
		} else {
			setGridVar(el, "--cell-row", `${row + 1} / span ${rowSpan ?? 1}`);
			setGridVar(el, "--cell-col", `${col + 1} / span ${colSpan ?? 1}`);
		}

		return el;
	}

	function addEnlargeButton(element: HTMLElement, entry: CellEntry): void {
		if (!config.app) return;
		const app = config.app;

		const btn = element.createEl("button", { cls: css.cls("grid-cell-enlarge") });
		setIcon(btn, "maximize-2");
		btn.addEventListener("click", () => {
			showModal({
				app,
				cls: css.cls("grid-enlarge-modal"),
				title: entry.enlargeTitle ?? entry.id ?? "",
				render: (modalEl) => entry.render(modalEl),
			});
		});
	}

	function addSwapButton(element: HTMLElement, row: number, col: number): void {
		if (!config.app || !cellPalette?.length) return;

		const btn = element.createEl("button", { cls: css.cls("grid-cell-swap") });
		setIcon(btn, "arrow-left-right");
		btn.addEventListener("click", () => openCellPicker(row, col));
	}

	function getUsedOptionIds(): Set<string> {
		const used = new Set<string>();
		for (const entry of cellMap.values()) {
			if (entry.id) used.add(entry.id);
		}
		return used;
	}

	function openCellPicker(row: number, col: number): void {
		if (!config.app || !cellPalette?.length) return;

		const currentEntry = cellMap.get(cellKey(row, col));
		const currentId = currentEntry?.id;
		const usedIds = getUsedOptionIds();

		showModal({
			app: config.app,
			cls: css.cls("grid-picker-modal"),
			title: `Swap cell (${row + 1}, ${col + 1})`,
			render: (modalEl) => {
				const list = modalEl.createDiv(css.cls("grid-picker-list"));
				for (const option of cellPalette) {
					const isCurrent = option.id === currentId;
					const isUsed = usedIds.has(option.id) && !isCurrent;

					const itemCls = [
						css.cls("grid-picker-item"),
						isCurrent ? css.cls("grid-picker-item-current") : "",
						isUsed ? css.cls("grid-picker-item-used") : "",
					]
						.filter(Boolean)
						.join(" ");

					const item = list.createEl("button", {
						cls: itemCls,
						attr: { "data-option-id": option.id },
					});

					const labelSpan = item.createEl("span", {
						text: option.label,
						cls: css.cls("grid-picker-item-label"),
					});

					if (isCurrent) {
						labelSpan.createEl("span", {
							text: "Current",
							cls: css.cls("grid-picker-item-badge"),
						});
					} else if (isUsed) {
						labelSpan.createEl("span", {
							text: "In use",
							cls: css.cls("grid-picker-item-badge"),
						});
					}

					item.addEventListener("click", () => {
						if (isCurrent) return;
						swapCellFromPalette(row, col, option);
						const modal = modalEl.closest(".modal-container");
						if (modal) {
							const closeBtn = modal.querySelector<HTMLElement>(".modal-close-button");
							closeBtn?.click();
						}
					});
				}
			},
		});
	}

	function swapCellFromPalette(row: number, col: number, option: CellOption): void {
		const key = cellKey(row, col);
		const existing = cellMap.get(key);
		if (!existing) return;

		existing.cleanup?.();
		existing.element.empty();

		if (dividers) css.addCls(existing.element, "grid-cell-divider");
		if (option.enlargeable) css.addCls(existing.element, "grid-cell-enlargeable");

		existing.render = option.render;
		if (option.cleanup !== undefined) {
			existing.cleanup = option.cleanup;
		} else {
			delete existing.cleanup;
		}
		if (option.id !== undefined) {
			existing.id = option.id;
		} else {
			delete existing.id;
		}
		if (option.enlargeable !== undefined) {
			existing.enlargeable = option.enlargeable;
		} else {
			delete existing.enlargeable;
		}
		if (option.enlargeTitle !== undefined) {
			existing.enlargeTitle = option.enlargeTitle;
		} else {
			delete existing.enlargeTitle;
		}

		if (existing.id) {
			for (const [existingId, existingKey] of idMap) {
				if (existingKey === key && existingId !== existing.id) {
					idMap.delete(existingId);
				}
			}
			idMap.set(existing.id, key);
		}

		if (option.enlargeable) addEnlargeButton(existing.element, existing);
		if (cellPalette?.length) addSwapButton(existing.element, row, col);

		void option.render(existing.element);
		onCellChange?.(row, col, option.id);
		emitStateChange();
	}

	function addCell(
		row: number,
		col: number,
		render: CellRender,
		cleanup?: CellCleanup,
		id?: string,
		rowSpan?: number,
		colSpan?: number,
		enlargeable?: boolean,
		enlargeTitle?: string
	): void {
		const key = cellKey(row, col);
		const existing = cellMap.get(key);
		if (existing) {
			existing.cleanup?.();
			if (existing.id) idMap.delete(existing.id);
			existing.element.empty();
		}

		const element = existing?.element ?? createCellElement(row, col, rowSpan, colSpan);

		if (!existing && !perCell && (rowSpan || colSpan)) {
			setGridVar(element, "--cell-row", `${row + 1} / span ${rowSpan ?? 1}`);
			setGridVar(element, "--cell-col", `${col + 1} / span ${colSpan ?? 1}`);
		}

		const entry: CellEntry = {
			element,
			render,
			...(cleanup !== undefined ? { cleanup } : {}),
			...(id !== undefined ? { id } : {}),
			...(enlargeable !== undefined ? { enlargeable } : {}),
			...(enlargeTitle !== undefined ? { enlargeTitle } : {}),
		};
		cellMap.set(key, entry);
		if (id) idMap.set(id, key);

		if (enlargeable) {
			css.addCls(element, "grid-cell-enlargeable");
			addEnlargeButton(element, entry);
		}

		if (cellPalette?.length) addSwapButton(element, row, col);

		void render(element);
	}

	function findKeyById(id: string): string | undefined {
		return idMap.get(id);
	}

	function parseKey(key: string): { row: number; col: number } {
		const [r, c] = key.split(":");
		return { row: Number(r), col: Number(c) };
	}

	const handle: GridLayoutHandle = {
		setCell(row: number, col: number, render: CellRender, cleanup?: CellCleanup): void {
			if (destroyed) return;
			if (row < 0 || row >= rows || col < 0 || col >= cols) return;

			const key = cellKey(row, col);
			const existing = cellMap.get(key);

			if (existing) {
				existing.cleanup?.();
				existing.element.empty();
				const oldId = existing.id;
				if (oldId) idMap.delete(oldId);
				existing.render = render;
				if (cleanup !== undefined) {
					existing.cleanup = cleanup;
				} else {
					delete existing.cleanup;
				}
				delete existing.id;
				void render(existing.element);
			} else {
				addCell(row, col, render, cleanup);
			}

			onCellChange?.(row, col);
			emitStateChange();
		},

		setCellById(id: string, render: CellRender, cleanup?: CellCleanup): void {
			if (destroyed) return;
			const key = findKeyById(id);
			if (!key) return;

			const { row, col } = parseKey(key);
			const existing = cellMap.get(key);
			if (!existing) return;

			existing.cleanup?.();
			existing.element.empty();
			existing.render = render;
			if (cleanup !== undefined) {
				existing.cleanup = cleanup;
			} else {
				delete existing.cleanup;
			}

			void render(existing.element);
			onCellChange?.(row, col, id);
			emitStateChange();
		},

		clearCell(row: number, col: number): void {
			if (destroyed) return;
			const key = cellKey(row, col);
			const existing = cellMap.get(key);
			if (!existing) return;

			existing.cleanup?.();
			existing.element.empty();
			if (existing.id) idMap.delete(existing.id);
			cellMap.delete(key);
			emitStateChange();
		},

		getCellElement(row: number, col: number): HTMLElement | null {
			const entry = cellMap.get(cellKey(row, col));
			return entry?.element ?? null;
		},

		resize(newCols: number, newRows: number): void {
			if (destroyed) return;

			for (const [key, entry] of cellMap) {
				const { row, col } = parseKey(key);
				if (row >= newRows || col >= newCols) {
					entry.cleanup?.();
					entry.element.remove();
					if (entry.id) idMap.delete(entry.id);
					cellMap.delete(key);
				}
			}

			columnSizes = adjustSizes(columnSizes, cols, newCols);
			rowSizes = adjustSizes(rowSizes, rows, newRows);
			cellColumnSizes = adjustPerCellSizes(cellColumnSizes, cols, newCols, newRows);
			cellRowSizes = adjustPerCellSizes(cellRowSizes, rows, newRows, newCols);
			cols = newCols;
			rows = newRows;

			if (perCell) buildPerCellContainers();
			applyGridStyles();
			resizeHandle?.update();
			if (perCell) setupPerCellResize();
			emitStateChange();
		},

		showCellPicker(row: number, col: number): void {
			if (destroyed) return;
			openCellPicker(row, col);
		},

		showLayoutEditor(): void {
			if (destroyed || !config.app || !cellPalette?.length) return;
			openLayoutEditor({
				app: config.app,
				cssPrefix,
				currentState: buildState(),
				cellPalette,
				onApply: (newState) => rebuildFromState(newState),
			});
		},

		getState(): GridLayoutState {
			return buildState();
		},

		get columns(): number {
			return cols;
		},

		get rows(): number {
			return rows;
		},

		destroy(): void {
			if (destroyed) return;
			destroyed = true;

			resizeHandle?.destroy();
			resizeHandle = null;
			destroyPerCellResize();

			for (const entry of cellMap.values()) {
				entry.cleanup?.();
			}
			cellMap.clear();
			idMap.clear();
			container.empty();
		},
	};

	return handle;
}
