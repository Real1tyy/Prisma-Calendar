import { setIcon } from "obsidian";

import type { CssUtils } from "../../utils/css-utils";

export interface ManagerRowConfig {
	itemId: string;
	displayLabel: string;
	originalLabel: string;
	isVisible: boolean;
	visibleIndex: number;
	visibleCount: number;
	hasRename: boolean;
	dragRef: { value: string | null };
	onRename: (rerender: () => void) => void;
	onHide: (() => void) | null;
	onShow: (() => void) | null;
	onMove: ((direction: -1 | 1) => void) | null;
	onDrop: (fromId: string) => void;
}

export function renderManagerRow(
	parent: HTMLElement,
	cfg: ManagerRowConfig,
	css: CssUtils,
	rerender: () => void
): HTMLElement {
	const row = parent.createDiv(css.cls("tab-manager-row"));
	if (!cfg.isVisible) css.addCls(row, "tab-manager-row-hidden");

	if (cfg.isVisible) {
		row.setAttribute("draggable", "true");
		row.dataset["tabId"] = cfg.itemId;

		row.addEventListener("dragstart", (e) => {
			cfg.dragRef.value = cfg.itemId;
			css.addCls(row, "tab-manager-row-dragging");
			if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
		});
		row.addEventListener("dragend", () => {
			cfg.dragRef.value = null;
			css.removeCls(row, "tab-manager-row-dragging");
		});
		row.addEventListener("dragover", (e) => {
			e.preventDefault();
			if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			css.addCls(row, "tab-manager-row-dragover");
		});
		row.addEventListener("dragleave", () => {
			css.removeCls(row, "tab-manager-row-dragover");
		});
		row.addEventListener("drop", (e) => {
			e.preventDefault();
			css.removeCls(row, "tab-manager-row-dragover");
			if (!cfg.dragRef.value || cfg.dragRef.value === cfg.itemId) return;
			cfg.onDrop(cfg.dragRef.value);
			rerender();
		});
	}

	const dragHandle = row.createDiv(css.cls("tab-manager-drag"));
	if (cfg.isVisible) {
		const gripIcon = dragHandle.createEl("span", { cls: css.cls("tab-manager-grip") });
		setIcon(gripIcon, "grip-vertical");
	}

	const arrows = row.createDiv(css.cls("tab-manager-arrows"));
	if (cfg.isVisible && cfg.onMove && cfg.visibleIndex > 0) {
		const upBtn = arrows.createEl("button", { cls: css.cls("tab-manager-drag-btn") });
		setIcon(upBtn, "chevron-up");
		upBtn.addEventListener("click", () => {
			cfg.onMove!(-1);
			rerender();
		});
	}
	if (cfg.isVisible && cfg.onMove && cfg.visibleIndex < cfg.visibleCount - 1) {
		const downBtn = arrows.createEl("button", { cls: css.cls("tab-manager-drag-btn") });
		setIcon(downBtn, "chevron-down");
		downBtn.addEventListener("click", () => {
			cfg.onMove!(1);
			rerender();
		});
	}

	const labelEl = row.createDiv(css.cls("tab-manager-label"));
	labelEl.createEl("span", { text: cfg.displayLabel, cls: css.cls("tab-manager-label-text") });
	if (cfg.hasRename) {
		const badge = labelEl.createEl("span", {
			text: cfg.originalLabel,
			cls: css.cls("tab-manager-label-original"),
		});
		badge.setAttribute("title", "Original name");
	}

	const controls = row.createDiv(css.cls("tab-manager-controls"));

	const renameBtn = controls.createEl("button", { cls: css.cls("tab-manager-btn") });
	setIcon(renameBtn, "pencil");
	renameBtn.setAttribute("title", "Rename");
	renameBtn.addEventListener("click", () => cfg.onRename(rerender));

	const toggleBtn = controls.createEl("button", { cls: css.cls("tab-manager-btn") });
	if (cfg.isVisible) {
		setIcon(toggleBtn, "eye");
		toggleBtn.setAttribute("title", "Hide");
		if (!cfg.onHide) toggleBtn.setAttribute("disabled", "true");
		toggleBtn.addEventListener("click", () => {
			cfg.onHide?.();
			rerender();
		});
	} else {
		setIcon(toggleBtn, "eye-off");
		toggleBtn.setAttribute("title", "Show");
		toggleBtn.addEventListener("click", () => {
			cfg.onShow?.();
			rerender();
		});
	}

	return row;
}
