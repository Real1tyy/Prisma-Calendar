import type { App } from "obsidian";
import { setIcon } from "obsidian";

import type { CssUtils } from "../../utils/css-utils";
import { type EditableItem, renderManagerEditForm } from "./manager-edit-form";

const DEFAULT_COLOR_SENTINEL = "#000000";
const FALLBACK_EDIT_COLOR = "#ffffff";

export interface ManagerRowConfig<T extends EditableItem> {
	app: App;
	css: CssUtils;
	rowPrefix: string;
	item: T;
	isVisible: boolean;
	isExpanded: boolean;
	visibleCount: number;
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
	onToggleExpand: () => void;
	onHide: () => void;
	onRestore: () => void;
	onRename: (id: string, label: string | undefined) => void;
	onIconChange: (id: string, icon: string | undefined) => void;
	onColorChange: (id: string, color: string | undefined) => void;
	rerender: () => void;
}

export function renderManagerRowContent<T extends EditableItem>(row: HTMLElement, config: ManagerRowConfig<T>): void {
	const { css, rowPrefix, item, isVisible, isExpanded, visibleCount, renames, iconOverrides, colorOverrides } = config;

	const displayLabel = renames.get(item.id) ?? item.label;
	const displayIcon = iconOverrides.get(item.id) ?? item.icon;
	const displayColor = colorOverrides.get(item.id) ?? item.color;

	const label = row.createDiv(css.cls(`${rowPrefix}-label`));
	const iconSpan = label.createEl("span", { cls: css.cls(`${rowPrefix}-icon`) });
	setIcon(iconSpan, displayIcon);
	if (displayColor && displayColor !== DEFAULT_COLOR_SENTINEL) {
		iconSpan.style.setProperty("color", displayColor);
	}
	label.createEl("span", { text: displayLabel, cls: css.cls(`${rowPrefix}-label-text`) });

	if (renames.has(item.id)) {
		const originalBadge = label.createEl("span", {
			text: item.label,
			cls: css.cls(`${rowPrefix}-label-original`),
		});
		originalBadge.setAttribute("title", "Original name");
	}

	const controls = row.createDiv(css.cls(`${rowPrefix}-controls`));

	const editBtn = controls.createEl("button", { cls: css.cls(`${rowPrefix}-btn`) });
	setIcon(editBtn, isExpanded ? "chevron-up" : "pencil");
	editBtn.setAttribute("title", isExpanded ? "Collapse" : "Edit");
	editBtn.addEventListener("click", () => config.onToggleExpand());

	const toggleBtn = controls.createEl("button", { cls: css.cls(`${rowPrefix}-btn`) });
	if (isVisible) {
		setIcon(toggleBtn, "eye");
		toggleBtn.setAttribute("title", "Hide");
		if (visibleCount <= 1) {
			toggleBtn.setAttribute("disabled", "true");
		}
		toggleBtn.addEventListener("click", () => {
			if (visibleCount > 1) config.onHide();
		});
	} else {
		setIcon(toggleBtn, "eye-off");
		toggleBtn.setAttribute("title", "Show");
		toggleBtn.addEventListener("click", () => config.onRestore());
	}

	if (isExpanded) {
		renderManagerEditForm(row, {
			app: config.app,
			css,
			formPrefix: rowPrefix,
			item,
			currentLabel: displayLabel,
			currentIcon: displayIcon,
			currentColor: displayColor ?? FALLBACK_EDIT_COLOR,
			hasRenameOverride: renames.has(item.id),
			hasIconOverride: iconOverrides.has(item.id),
			hasColorOverride: colorOverrides.has(item.id),
			onRename: config.onRename,
			onIconChange: config.onIconChange,
			onColorChange: config.onColorChange,
			rerender: config.rerender,
		});
	}
}
