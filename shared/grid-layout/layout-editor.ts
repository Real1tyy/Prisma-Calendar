import type { App } from "obsidian";
import { setIcon } from "obsidian";

import { showModal } from "../component-renderer/modal";
import { createCssUtils } from "../core/css-utils";
import type { CellOption, GridLayoutState } from "./types";

const MIN_DIM = 1;
const MAX_DIM = 6;

interface LayoutEditorConfig {
	app: App;
	cssPrefix: string;
	currentState: GridLayoutState;
	cellPalette: CellOption[];
	onApply: (newState: GridLayoutState) => void;
}

export function openLayoutEditor(config: LayoutEditorConfig): void {
	const { app, cssPrefix, cellPalette, onApply } = config;
	const css = createCssUtils(cssPrefix);
	const paletteMap = new Map(cellPalette.map((o) => [o.id, o]));

	let staged: GridLayoutState = structuredClone(config.currentState);

	showModal({
		app,
		cls: css.cls("grid-editor-modal"),
		title: "Layout Editor",
		render: (modalEl, ctx) => {
			renderEditor(modalEl, ctx.close);
		},
	});

	function renderEditor(root: HTMLElement, closeModal: () => void): void {
		root.empty();

		const controls = root.createDiv(css.cls("grid-editor-controls"));
		renderDimRow(controls, "Columns", staged.columns, (v) => {
			staged = { ...staged, columns: v, cells: staged.cells.filter((c) => c.col < v) };
			renderEditor(root, closeModal);
		});
		renderDimRow(controls, "Rows", staged.rows, (v) => {
			staged = { ...staged, rows: v, cells: staged.cells.filter((c) => c.row < v) };
			renderEditor(root, closeModal);
		});

		const preview = root.createDiv(css.cls("grid-editor-preview"));
		setGridVar(preview, "--editor-columns", String(staged.columns));
		setGridVar(preview, "--editor-rows", String(staged.rows));

		for (let r = 0; r < staged.rows; r++) {
			for (let c = 0; c < staged.columns; c++) {
				const cell = staged.cells.find((s) => s.row === r && s.col === c);
				if (cell) {
					renderOccupiedCell(preview, cell, root, closeModal);
				} else {
					renderEmptySlot(preview, r, c, root, closeModal);
				}
			}
		}

		const actions = root.createDiv(css.cls("grid-editor-actions"));

		const cancelBtn = actions.createEl("button", {
			text: "Cancel",
			cls: css.cls("grid-editor-btn", "grid-editor-btn-cancel"),
		});
		cancelBtn.addEventListener("click", closeModal);

		const applyBtn = actions.createEl("button", {
			text: "Apply",
			cls: css.cls("grid-editor-btn", "grid-editor-btn-apply"),
		});
		applyBtn.addEventListener("click", () => {
			onApply(staged);
			closeModal();
		});
	}

	function renderDimRow(parent: HTMLElement, label: string, value: number, onChange: (v: number) => void): void {
		const row = parent.createDiv(css.cls("grid-editor-dim-row"));
		row.createEl("span", { text: label, cls: css.cls("grid-editor-dim-label") });

		const minus = row.createEl("button", { cls: css.cls("grid-editor-dim-btn") });
		setIcon(minus, "minus");
		if (value <= MIN_DIM) minus.setAttribute("disabled", "true");
		minus.addEventListener("click", () => {
			if (value > MIN_DIM) onChange(value - 1);
		});

		row.createEl("span", { text: String(value), cls: css.cls("grid-editor-dim-value") });

		const plus = row.createEl("button", { cls: css.cls("grid-editor-dim-btn") });
		setIcon(plus, "plus");
		if (value >= MAX_DIM) plus.setAttribute("disabled", "true");
		plus.addEventListener("click", () => {
			if (value < MAX_DIM) onChange(value + 1);
		});
	}

	function renderOccupiedCell(
		parent: HTMLElement,
		cell: GridLayoutState["cells"][number],
		root: HTMLElement,
		closeModal: () => void
	): void {
		const el = parent.createDiv(css.cls("grid-editor-cell"));
		setGridVar(el, "--editor-cell-row", String(cell.row + 1));
		setGridVar(el, "--editor-cell-col", String(cell.col + 1));

		const option = paletteMap.get(cell.optionId);
		el.createEl("span", {
			text: option?.label ?? cell.optionId,
			cls: css.cls("grid-editor-cell-label"),
		});

		const removeBtn = el.createEl("button", { cls: css.cls("grid-editor-cell-remove") });
		setIcon(removeBtn, "x");
		removeBtn.addEventListener("click", () => {
			staged = { ...staged, cells: staged.cells.filter((c) => !(c.row === cell.row && c.col === cell.col)) };
			renderEditor(root, closeModal);
		});
	}

	function renderEmptySlot(
		parent: HTMLElement,
		row: number,
		col: number,
		root: HTMLElement,
		closeModal: () => void
	): void {
		const el = parent.createDiv(css.cls("grid-editor-empty"));
		setGridVar(el, "--editor-cell-row", String(row + 1));
		setGridVar(el, "--editor-cell-col", String(col + 1));

		const addBtn = el.createEl("button", { cls: css.cls("grid-editor-empty-btn") });
		setIcon(addBtn, "plus");
		addBtn.addEventListener("click", () => {
			showPalettePicker(row, col, root, closeModal);
		});
	}

	function showPalettePicker(row: number, col: number, root: HTMLElement, closeModal: () => void): void {
		const usedIds = new Set(staged.cells.map((c) => c.optionId));

		showModal({
			app,
			cls: css.cls("grid-picker-modal"),
			title: `Assign cell (${row + 1}, ${col + 1})`,
			render: (modalEl) => {
				const list = modalEl.createDiv(css.cls("grid-picker-list"));
				for (const option of cellPalette) {
					const isUsed = usedIds.has(option.id);
					const itemCls = [css.cls("grid-picker-item"), isUsed ? css.cls("grid-picker-item-used") : ""]
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

					if (isUsed) {
						labelSpan.createEl("span", {
							text: "In use",
							cls: css.cls("grid-picker-item-badge"),
						});
					}

					item.addEventListener("click", () => {
						staged = { ...staged, cells: [...staged.cells, { optionId: option.id, row, col }] };
						const modal = modalEl.closest(".modal-container");
						if (modal) {
							const closeBtn = modal.querySelector<HTMLElement>(".modal-close-button");
							closeBtn?.click();
						}
						renderEditor(root, closeModal);
					});
				}
			},
		});
	}
}

function setGridVar(el: HTMLElement, name: string, value: string): void {
	el.style.setProperty(name, value);
}
