import type { App } from "obsidian";
import { Setting } from "obsidian";

import type { CssUtils } from "../../utils/css-utils";
import { showIconPicker } from "./icon-picker";

export interface EditableItem {
	id: string;
	label: string;
	icon: string;
	color?: string;
}

export interface ManagerEditFormConfig {
	app: App;
	css: CssUtils;
	formPrefix: string;
	item: EditableItem;
	currentLabel: string;
	currentIcon: string;
	currentColor: string;
	hasRenameOverride: boolean;
	hasIconOverride: boolean;
	hasColorOverride: boolean;
	onRename: (id: string, label: string | undefined) => void;
	onIconChange: (id: string, icon: string | undefined) => void;
	onColorChange: (id: string, color: string | undefined) => void;
	rerender: () => void;
}

export function renderManagerEditForm(container: HTMLElement, config: ManagerEditFormConfig): void {
	const { app, css, formPrefix, item, rerender } = config;

	const form = container.createDiv(css.cls(`${formPrefix}-edit-form`));

	const nameSetting = new Setting(form).setName("Name");
	nameSetting.addText((text) => {
		text.setValue(config.currentLabel);
		text.setPlaceholder(item.label);
		text.onChange((value) => {
			const trimmed = value.trim();
			const resolvedLabel = trimmed && trimmed !== item.label ? trimmed : undefined;
			config.onRename(item.id, resolvedLabel);
		});
	});
	if (config.hasRenameOverride) {
		nameSetting.addExtraButton((btn) => {
			btn.setIcon("rotate-ccw");
			btn.setTooltip(`Reset to "${item.label}"`);
			btn.onClick(() => {
				config.onRename(item.id, undefined);
				rerender();
			});
		});
	}

	const iconSetting = new Setting(form).setName("Icon");
	iconSetting.addButton((btn) => {
		btn.setButtonText(config.currentIcon);
		btn.onClick(() => {
			showIconPicker(app, (icon) => {
				const resolvedIcon = icon !== item.icon ? icon : undefined;
				config.onIconChange(item.id, resolvedIcon);
				rerender();
			});
		});
	});
	if (config.hasIconOverride) {
		iconSetting.addExtraButton((btn) => {
			btn.setIcon("rotate-ccw");
			btn.setTooltip(`Reset to "${item.icon}"`);
			btn.onClick(() => {
				config.onIconChange(item.id, undefined);
				rerender();
			});
		});
	}

	const colorSetting = new Setting(form).setName("Color");
	colorSetting.addColorPicker((picker) => {
		picker.setValue(config.currentColor);
		picker.onChange((value) => {
			const defaultColor = item.color ?? "#ffffff";
			const resolved = value !== defaultColor ? value : undefined;
			config.onColorChange(item.id, resolved);
		});
	});
	if (config.hasColorOverride) {
		colorSetting.addExtraButton((btn) => {
			btn.setIcon("rotate-ccw");
			btn.setTooltip("Reset to default color");
			btn.onClick(() => {
				config.onColorChange(item.id, undefined);
				rerender();
			});
		});
	}
}
