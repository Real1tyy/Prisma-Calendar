import type { App } from "obsidian";
import { FuzzySuggestModal, getIconIds, setIcon, Setting } from "obsidian";

import { showModal } from "../component-renderer/modal";
import { createCssUtils } from "../core/css-utils";
import type { HeaderActionDefinition } from "./types";

export interface ActionManagerConfig {
	app: App;
	cssPrefix: string;
	allActions: HeaderActionDefinition[];
	getVisibleActions: () => HeaderActionDefinition[];
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
	showSettingsButton: boolean;
	onHide: (id: string) => void;
	onRestore: (id: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
	onRename: (id: string, label: string | undefined) => void;
	onIconChange: (id: string, icon: string | undefined) => void;
	onColorChange: (id: string, color: string | undefined) => void;
	onToggleSettingsButton: (visible: boolean) => void;
}

export function openActionManager(config: ActionManagerConfig): void {
	const { app, cssPrefix, allActions } = config;
	const css = createCssUtils(cssPrefix);

	let expandedActionId: string | null = null;

	showModal({
		app,
		cls: css.cls("action-manager-modal"),
		title: "Manage Header Actions",
		render: (modalEl) => {
			renderManagerList(modalEl);
		},
	});

	function getLabel(action: HeaderActionDefinition): string {
		return config.renames.get(action.id) ?? action.label;
	}

	function getIconName(action: HeaderActionDefinition): string {
		return config.iconOverrides.get(action.id) ?? action.icon;
	}

	function renderManagerList(root: HTMLElement): void {
		root.empty();

		const visibleActions = config.getVisibleActions();

		new Setting(root).setName("Show settings button").addToggle((toggle) => {
			toggle.setValue(config.showSettingsButton);
			toggle.onChange((value) => {
				config.showSettingsButton = value;
				config.onToggleSettingsButton(value);
			});
		});

		const list = root.createDiv(css.cls("action-manager-list"));

		const visibleIds = new Set(visibleActions.map((a) => a.id));
		const orderedActions = [...visibleActions, ...allActions.filter((a) => !visibleIds.has(a.id))];

		let draggedId: string | null = null;

		for (const action of orderedActions) {
			const isVisible = visibleIds.has(action.id);
			const idx = visibleActions.findIndex((a) => a.id === action.id);
			const isExpanded = expandedActionId === action.id;

			const row = list.createDiv(css.cls("action-manager-row"));
			if (!isVisible) css.addCls(row, "action-manager-row-hidden");

			if (isVisible) {
				row.setAttribute("draggable", "true");
				row.dataset.actionId = action.id;

				row.addEventListener("dragstart", (e) => {
					draggedId = action.id;
					css.addCls(row, "action-manager-row-dragging");
					if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
				});

				row.addEventListener("dragend", () => {
					draggedId = null;
					css.removeCls(row, "action-manager-row-dragging");
				});

				row.addEventListener("dragover", (e) => {
					e.preventDefault();
					if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
					css.addCls(row, "action-manager-row-dragover");
				});

				row.addEventListener("dragleave", () => {
					css.removeCls(row, "action-manager-row-dragover");
				});

				row.addEventListener("drop", (e) => {
					e.preventDefault();
					css.removeCls(row, "action-manager-row-dragover");
					if (!draggedId || draggedId === action.id) return;

					const currentVisible = config.getVisibleActions();
					const fromIdx = currentVisible.findIndex((a) => a.id === draggedId);
					const toIdx = currentVisible.findIndex((a) => a.id === action.id);
					if (fromIdx < 0 || toIdx < 0) return;

					if (fromIdx < toIdx) {
						for (let i = fromIdx; i < toIdx; i++) config.onMove(draggedId, 1);
					} else {
						for (let i = fromIdx; i > toIdx; i--) config.onMove(draggedId, -1);
					}

					renderManagerList(root);
				});
			}

			const dragHandle = row.createDiv(css.cls("action-manager-drag"));
			if (isVisible) {
				const gripIcon = dragHandle.createEl("span", { cls: css.cls("action-manager-grip") });
				setIcon(gripIcon, "grip-vertical");
			}

			const dragControls = row.createDiv(css.cls("action-manager-arrows"));

			if (isVisible && idx > 0) {
				const upBtn = dragControls.createEl("button", { cls: css.cls("action-manager-drag-btn") });
				setIcon(upBtn, "chevron-up");
				upBtn.addEventListener("click", () => {
					config.onMove(action.id, -1);
					renderManagerList(root);
				});
			}

			if (isVisible && idx < visibleActions.length - 1) {
				const downBtn = dragControls.createEl("button", { cls: css.cls("action-manager-drag-btn") });
				setIcon(downBtn, "chevron-down");
				downBtn.addEventListener("click", () => {
					config.onMove(action.id, 1);
					renderManagerList(root);
				});
			}

			const label = row.createDiv(css.cls("action-manager-label"));
			const iconSpan = label.createEl("span", { cls: css.cls("action-manager-icon") });
			setIcon(iconSpan, getIconName(action));
			const color = config.colorOverrides.get(action.id) ?? action.color;
			if (color && color !== "#000000") {
				iconSpan.style.setProperty("color", color);
			}
			label.createEl("span", { text: getLabel(action), cls: css.cls("action-manager-label-text") });

			if (config.renames.has(action.id)) {
				const originalBadge = label.createEl("span", {
					text: action.label,
					cls: css.cls("action-manager-label-original"),
				});
				originalBadge.setAttribute("title", "Original name");
			}

			const controls = row.createDiv(css.cls("action-manager-controls"));

			const editBtn = controls.createEl("button", { cls: css.cls("action-manager-btn") });
			setIcon(editBtn, isExpanded ? "chevron-up" : "pencil");
			editBtn.setAttribute("title", isExpanded ? "Collapse" : "Edit");
			editBtn.addEventListener("click", () => {
				expandedActionId = isExpanded ? null : action.id;
				renderManagerList(root);
			});

			const toggleBtn = controls.createEl("button", { cls: css.cls("action-manager-btn") });
			if (isVisible) {
				setIcon(toggleBtn, "eye");
				toggleBtn.setAttribute("title", "Hide");
				if (visibleActions.length <= 1) {
					toggleBtn.setAttribute("disabled", "true");
				}
				toggleBtn.addEventListener("click", () => {
					if (config.getVisibleActions().length > 1) {
						config.onHide(action.id);
						renderManagerList(root);
					}
				});
			} else {
				setIcon(toggleBtn, "eye-off");
				toggleBtn.setAttribute("title", "Show");
				toggleBtn.addEventListener("click", () => {
					config.onRestore(action.id);
					renderManagerList(root);
				});
			}

			if (isExpanded) {
				renderEditForm(row, action, root);
			}
		}
	}

	function renderEditForm(row: HTMLElement, action: HeaderActionDefinition, root: HTMLElement): void {
		const form = row.createDiv(css.cls("action-manager-edit-form"));

		const hasRenameOverride = config.renames.has(action.id);
		const hasIconOverride = config.iconOverrides.has(action.id);
		const hasColorOverride = config.colorOverrides.has(action.id);

		const nameSetting = new Setting(form).setName("Name");
		nameSetting.addText((text) => {
			text.setValue(getLabel(action));
			text.setPlaceholder(action.label);
			text.onChange((value) => {
				const trimmed = value.trim();
				const resolvedLabel = trimmed && trimmed !== action.label ? trimmed : undefined;
				config.onRename(action.id, resolvedLabel);
			});
		});
		if (hasRenameOverride) {
			nameSetting.addExtraButton((btn) => {
				btn.setIcon("rotate-ccw");
				btn.setTooltip(`Reset to "${action.label}"`);
				btn.onClick(() => {
					config.onRename(action.id, undefined);
					renderManagerList(root);
				});
			});
		}

		const iconSetting = new Setting(form).setName("Icon");
		iconSetting.addButton((btn) => {
			btn.setButtonText(getIconName(action));
			btn.onClick(() => {
				showIconPicker(app, (icon) => {
					const resolvedIcon = icon !== action.icon ? icon : undefined;
					config.onIconChange(action.id, resolvedIcon);
					renderManagerList(root);
				});
			});
		});
		if (hasIconOverride) {
			iconSetting.addExtraButton((btn) => {
				btn.setIcon("rotate-ccw");
				btn.setTooltip(`Reset to "${action.icon}"`);
				btn.onClick(() => {
					config.onIconChange(action.id, undefined);
					renderManagerList(root);
				});
			});
		}

		const currentColor = config.colorOverrides.get(action.id) ?? action.color ?? "#ffffff";
		const colorSetting = new Setting(form).setName("Color");
		colorSetting.addColorPicker((picker) => {
			picker.setValue(currentColor);
			picker.onChange((value) => {
				const defaultColor = action.color ?? "#ffffff";
				const resolved = value !== defaultColor ? value : undefined;
				config.onColorChange(action.id, resolved);
			});
		});
		if (hasColorOverride) {
			colorSetting.addExtraButton((btn) => {
				btn.setIcon("rotate-ccw");
				btn.setTooltip("Reset to default color");
				btn.onClick(() => {
					config.onColorChange(action.id, undefined);
					renderManagerList(root);
				});
			});
		}
	}
}

function showIconPicker(app: App, onDone: (icon: string) => void): void {
	class IconPickerModal extends FuzzySuggestModal<string> {
		getItems(): string[] {
			return getIconIds();
		}

		getItemText(item: string): string {
			return item;
		}

		onChooseItem(item: string): void {
			onDone(item);
		}
	}

	const modal = new IconPickerModal(app);
	modal.setPlaceholder("Choose an icon...");
	modal.open();
}
