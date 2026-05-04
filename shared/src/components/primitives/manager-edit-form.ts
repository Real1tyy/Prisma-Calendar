import type { App } from "obsidian";
import { Setting } from "obsidian";

import type { CssUtils } from "../../utils/css-utils";
import { showIconPicker } from "./icon-picker";

export interface EditableItem {
	id: string;
	label: string;
	icon?: string;
	color?: string;
}

export interface ManagerEditFormConfig {
	app: App;
	css: CssUtils;
	formPrefix: string;
	testIdPrefix?: string;
	item: EditableItem;
	currentLabel: string;
	currentIcon: string | undefined;
	currentColor: string;
	hasRenameOverride: boolean;
	hasIconOverride: boolean;
	hasColorOverride: boolean;
	onRename: (id: string, label: string | undefined) => void;
	onIconChange: (id: string, icon: string | undefined) => void;
	onColorChange: (id: string, color: string | undefined) => void;
	rerender: () => void;
	/** When false, the icon picker hides the "No icon" option. Defaults to true. */
	allowNoIcon?: boolean;
}

export function renderManagerEditForm(container: HTMLElement, config: ManagerEditFormConfig): void {
	const { app, css, formPrefix, item, rerender } = config;

	const form = container.createDiv(css.cls(`${formPrefix}-edit-form`));

	function addResetButton(setting: Setting, tooltip: string, onReset: () => void, visible: boolean): HTMLElement {
		let resetEl!: HTMLElement;
		setting.addExtraButton((btn) => {
			btn.setIcon("rotate-ccw");
			btn.setTooltip(tooltip);
			btn.onClick(onReset);
			resetEl = btn.extraSettingsEl;
		});
		if (!visible) resetEl.style.display = "none";
		return resetEl;
	}

	const nameSetting = new Setting(form).setName("Name");
	const nameResetEl = addResetButton(
		nameSetting,
		`Reset to "${item.label}"`,
		() => {
			config.onRename(item.id, undefined);
			rerender();
		},
		config.hasRenameOverride
	);
	nameSetting.addText((text) => {
		text.setValue(config.currentLabel);
		text.setPlaceholder(item.label);
		text.onChange((value) => {
			const trimmed = value.trim();
			const resolvedLabel = trimmed && trimmed !== item.label ? trimmed : undefined;
			config.onRename(item.id, resolvedLabel);
			nameResetEl.style.display = resolvedLabel ? "" : "none";
		});
	});

	const iconSetting = new Setting(form).setName("Icon");
	addResetButton(
		iconSetting,
		item.icon ? `Reset to "${item.icon}"` : "Reset icon",
		() => {
			config.onIconChange(item.id, undefined);
			rerender();
		},
		config.hasIconOverride
	);
	iconSetting.addButton((btn) => {
		btn.setButtonText(config.currentIcon ?? "No icon");
		if (config.testIdPrefix) {
			btn.buttonEl.setAttribute("data-testid", `${config.testIdPrefix}${formPrefix}-icon-btn-${item.id}`);
		}
		btn.onClick(() => {
			showIconPicker(
				app,
				(icon) => {
					if (icon === null) {
						config.onIconChange(item.id, undefined);
					} else {
						config.onIconChange(item.id, icon !== item.icon ? icon : undefined);
					}
					rerender();
				},
				config.allowNoIcon !== undefined ? { allowNoIcon: config.allowNoIcon } : undefined
			);
		});
	});

	const colorSetting = new Setting(form).setName("Color");
	const colorResetEl = addResetButton(
		colorSetting,
		"Reset to default color",
		() => {
			config.onColorChange(item.id, undefined);
			rerender();
		},
		config.hasColorOverride
	);
	colorSetting.addColorPicker((picker) => {
		picker.setValue(config.currentColor);
		picker.onChange((value) => {
			const defaultColor = item.color ?? "#ffffff";
			const resolved = value !== defaultColor ? value : undefined;
			config.onColorChange(item.id, resolved);
			colorResetEl.style.display = resolved ? "" : "none";
		});
	});
}
