import { setIcon } from "obsidian";

import { showModal } from "../component-renderer/modal";
import { createCssUtils } from "../core/css-utils";
import type { CellCleanup, CellRender, GridLayoutConfig, GridLayoutHandle } from "./types";

interface CellEntry {
	element: HTMLElement;
	render: CellRender;
	cleanup?: CellCleanup;
	id?: string;
	enlargeable?: boolean;
	enlargeTitle?: string;
}

function cellKey(row: number, col: number): string {
	return `${row}:${col}`;
}

function setGridVar(el: HTMLElement, name: string, value: string): void {
	el.style.setProperty(name, value);
}

export function createGridLayout(container: HTMLElement, config: GridLayoutConfig): GridLayoutHandle {
	const { cssPrefix, cells: initialCells, gap, minCellWidth, dividers, onCellChange } = config;
	const css = createCssUtils(cssPrefix);

	let cols = config.columns;
	let rows = config.rows;
	let destroyed = false;

	const cellMap = new Map<string, CellEntry>();
	const idMap = new Map<string, string>();

	const gridEl = container.createDiv(css.cls("grid"));
	applyGridStyles();

	if (initialCells) {
		for (const cell of initialCells) {
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

	function applyGridStyles(): void {
		css.addCls(gridEl, "grid");
		const colTemplate = minCellWidth ? `repeat(auto-fit, minmax(${minCellWidth}px, 1fr))` : `repeat(${cols}, 1fr)`;
		setGridVar(gridEl, "--grid-columns", colTemplate);
		setGridVar(gridEl, "--grid-rows", `repeat(${rows}, auto)`);
		if (gap) setGridVar(gridEl, "--grid-gap", gap);
	}

	function createCellElement(row: number, col: number, rowSpan?: number, colSpan?: number): HTMLElement {
		const el = gridEl.createDiv(css.cls("grid-cell"));
		if (dividers) css.addCls(el, "grid-cell-divider");
		el.dataset.row = String(row);
		el.dataset.col = String(col);
		setGridVar(el, "--cell-row", `${row + 1} / span ${rowSpan ?? 1}`);
		setGridVar(el, "--cell-col", `${col + 1} / span ${colSpan ?? 1}`);
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

		if (!existing && (rowSpan || colSpan)) {
			setGridVar(element, "--cell-row", `${row + 1} / span ${rowSpan ?? 1}`);
			setGridVar(element, "--cell-col", `${col + 1} / span ${colSpan ?? 1}`);
		}

		const entry: CellEntry = { element, render, cleanup, id, enlargeable, enlargeTitle };
		cellMap.set(key, entry);
		if (id) idMap.set(id, key);

		if (enlargeable) {
			css.addCls(element, "grid-cell-enlargeable");
			addEnlargeButton(element, entry);
		}

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
				existing.cleanup = cleanup;
				existing.id = undefined;
				void render(existing.element);
			} else {
				addCell(row, col, render, cleanup);
			}

			onCellChange?.(row, col);
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
			existing.cleanup = cleanup;

			void render(existing.element);
			onCellChange?.(row, col, id);
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

			cols = newCols;
			rows = newRows;
			applyGridStyles();
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
