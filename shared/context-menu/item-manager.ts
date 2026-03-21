import type { App } from "obsidian";
import { FuzzySuggestModal, getIconIds, setIcon, Setting } from "obsidian";

import { showModal } from "../component-renderer/modal";
import type { ModalContext } from "../component-renderer/types";
import { createCssUtils } from "../core/css-utils";
import type { ContextMenuItemDefinition } from "./types";

export interface ItemManagerConfig {
	app: App;
	cssPrefix: string;
	allItems: ContextMenuItemDefinition[];
	getVisibleItems: () => ContextMenuItemDefinition[];
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

export function openItemManager(config: ItemManagerConfig): void {
	const { app, cssPrefix, allItems } = config;
	const css = createCssUtils(cssPrefix);

	let expandedItemId: string | null = null;

	let modalCtx: ModalContext;

	showModal({
		app,
		cls: css.cls("item-manager-modal"),
		title: "Manage Context Menu Items",
		search: { cssPrefix, placeholder: "Search items..." },
		render: (contentEl, ctx) => {
			modalCtx = ctx as ModalContext;
			renderManagerList(contentEl);
		},
	});

	function getLabel(item: ContextMenuItemDefinition): string {
		return config.renames.get(item.id) ?? item.label;
	}

	function getIconName(item: ContextMenuItemDefinition): string {
		return config.iconOverrides.get(item.id) ?? item.icon;
	}

	function matchesSearch(item: ContextMenuItemDefinition): boolean {
		const query = modalCtx.searchQuery;
		if (!query) return true;
		return (
			getLabel(item).toLowerCase().includes(query) ||
			item.label.toLowerCase().includes(query) ||
			item.id.toLowerCase().includes(query)
		);
	}

	function renderManagerList(root: HTMLElement): void {
		root.empty();

		const isSearching = modalCtx.searchQuery.length > 0;
		const visibleItems = config.getVisibleItems();

		if (!isSearching) {
			new Setting(root).setName("Show settings button").addToggle((toggle) => {
				toggle.setValue(config.showSettingsButton);
				toggle.onChange((value) => {
					config.showSettingsButton = value;
					config.onToggleSettingsButton(value);
				});
			});
		}

		const list = root.createDiv(css.cls("item-manager-list"));

		const visibleIds = new Set(visibleItems.map((i) => i.id));
		const orderedItems = [...visibleItems, ...allItems.filter((i) => !visibleIds.has(i.id))];
		const filteredItems = orderedItems.filter((i) => matchesSearch(i));

		if (isSearching && filteredItems.length === 0) {
			list.createDiv({
				text: "No matching items",
				cls: css.cls("modal-search-empty"),
			});
			return;
		}

		let draggedId: string | null = null;

		for (const item of filteredItems) {
			const isVisible = visibleIds.has(item.id);
			const idx = visibleItems.findIndex((i) => i.id === item.id);
			const isExpanded = expandedItemId === item.id;

			const row = list.createDiv(css.cls("item-manager-row"));
			if (!isVisible) css.addCls(row, "item-manager-row-hidden");

			if (isVisible && !isSearching) {
				row.setAttribute("draggable", "true");
				row.dataset["itemId"] = item.id;

				row.addEventListener("dragstart", (e) => {
					draggedId = item.id;
					css.addCls(row, "item-manager-row-dragging");
					if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
				});

				row.addEventListener("dragend", () => {
					draggedId = null;
					css.removeCls(row, "item-manager-row-dragging");
				});

				row.addEventListener("dragover", (e) => {
					e.preventDefault();
					if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
					css.addCls(row, "item-manager-row-dragover");
				});

				row.addEventListener("dragleave", () => {
					css.removeCls(row, "item-manager-row-dragover");
				});

				row.addEventListener("drop", (e) => {
					e.preventDefault();
					css.removeCls(row, "item-manager-row-dragover");
					if (!draggedId || draggedId === item.id) return;

					const currentVisible = config.getVisibleItems();
					const fromIdx = currentVisible.findIndex((i) => i.id === draggedId);
					const toIdx = currentVisible.findIndex((i) => i.id === item.id);
					if (fromIdx < 0 || toIdx < 0) return;

					if (fromIdx < toIdx) {
						for (let i = fromIdx; i < toIdx; i++) config.onMove(draggedId, 1);
					} else {
						for (let i = fromIdx; i > toIdx; i--) config.onMove(draggedId, -1);
					}

					renderManagerList(root);
				});
			}

			if (!isSearching) {
				const dragHandle = row.createDiv(css.cls("item-manager-drag"));
				if (isVisible) {
					const gripIcon = dragHandle.createEl("span", { cls: css.cls("item-manager-grip") });
					setIcon(gripIcon, "grip-vertical");
				}

				const dragControls = row.createDiv(css.cls("item-manager-arrows"));

				if (isVisible && idx > 0) {
					const upBtn = dragControls.createEl("button", { cls: css.cls("item-manager-drag-btn") });
					setIcon(upBtn, "chevron-up");
					upBtn.addEventListener("click", () => {
						config.onMove(item.id, -1);
						renderManagerList(root);
					});
				}

				if (isVisible && idx < visibleItems.length - 1) {
					const downBtn = dragControls.createEl("button", { cls: css.cls("item-manager-drag-btn") });
					setIcon(downBtn, "chevron-down");
					downBtn.addEventListener("click", () => {
						config.onMove(item.id, 1);
						renderManagerList(root);
					});
				}
			}

			const label = row.createDiv(css.cls("item-manager-label"));
			const iconSpan = label.createEl("span", { cls: css.cls("item-manager-icon") });
			setIcon(iconSpan, getIconName(item));
			const color = config.colorOverrides.get(item.id) ?? item.color;
			if (color && color !== "#000000") {
				iconSpan.style.setProperty("color", color);
			}
			label.createEl("span", { text: getLabel(item), cls: css.cls("item-manager-label-text") });

			if (config.renames.has(item.id)) {
				const originalBadge = label.createEl("span", {
					text: item.label,
					cls: css.cls("item-manager-label-original"),
				});
				originalBadge.setAttribute("title", "Original name");
			}

			const controls = row.createDiv(css.cls("item-manager-controls"));

			const editBtn = controls.createEl("button", { cls: css.cls("item-manager-btn") });
			setIcon(editBtn, isExpanded ? "chevron-up" : "pencil");
			editBtn.setAttribute("title", isExpanded ? "Collapse" : "Edit");
			editBtn.addEventListener("click", () => {
				expandedItemId = isExpanded ? null : item.id;
				renderManagerList(root);
			});

			const toggleBtn = controls.createEl("button", { cls: css.cls("item-manager-btn") });
			if (isVisible) {
				setIcon(toggleBtn, "eye");
				toggleBtn.setAttribute("title", "Hide");
				if (visibleItems.length <= 1) {
					toggleBtn.setAttribute("disabled", "true");
				}
				toggleBtn.addEventListener("click", () => {
					if (config.getVisibleItems().length > 1) {
						config.onHide(item.id);
						renderManagerList(root);
					}
				});
			} else {
				setIcon(toggleBtn, "eye-off");
				toggleBtn.setAttribute("title", "Show");
				toggleBtn.addEventListener("click", () => {
					config.onRestore(item.id);
					renderManagerList(root);
				});
			}

			if (isExpanded) {
				renderEditForm(row, item, root);
			}
		}
	}

	function renderEditForm(row: HTMLElement, item: ContextMenuItemDefinition, root: HTMLElement): void {
		const form = row.createDiv(css.cls("item-manager-edit-form"));

		const hasRenameOverride = config.renames.has(item.id);
		const hasIconOverride = config.iconOverrides.has(item.id);
		const hasColorOverride = config.colorOverrides.has(item.id);

		const nameSetting = new Setting(form).setName("Name");
		nameSetting.addText((text) => {
			text.setValue(getLabel(item));
			text.setPlaceholder(item.label);
			text.onChange((value) => {
				const trimmed = value.trim();
				const resolvedLabel = trimmed && trimmed !== item.label ? trimmed : undefined;
				config.onRename(item.id, resolvedLabel);
			});
		});
		if (hasRenameOverride) {
			nameSetting.addExtraButton((btn) => {
				btn.setIcon("rotate-ccw");
				btn.setTooltip(`Reset to "${item.label}"`);
				btn.onClick(() => {
					config.onRename(item.id, undefined);
					renderManagerList(root);
				});
			});
		}

		const iconSetting = new Setting(form).setName("Icon");
		iconSetting.addButton((btn) => {
			btn.setButtonText(getIconName(item));
			btn.onClick(() => {
				showIconPicker(app, (icon) => {
					const resolvedIcon = icon !== item.icon ? icon : undefined;
					config.onIconChange(item.id, resolvedIcon);
					renderManagerList(root);
				});
			});
		});
		if (hasIconOverride) {
			iconSetting.addExtraButton((btn) => {
				btn.setIcon("rotate-ccw");
				btn.setTooltip(`Reset to "${item.icon}"`);
				btn.onClick(() => {
					config.onIconChange(item.id, undefined);
					renderManagerList(root);
				});
			});
		}

		const currentColor = config.colorOverrides.get(item.id) ?? item.color ?? "#ffffff";
		const colorSetting = new Setting(form).setName("Color");
		colorSetting.addColorPicker((picker) => {
			picker.setValue(currentColor);
			picker.onChange((value) => {
				const defaultColor = item.color ?? "#ffffff";
				const resolved = value !== defaultColor ? value : undefined;
				config.onColorChange(item.id, resolved);
			});
		});
		if (hasColorOverride) {
			colorSetting.addExtraButton((btn) => {
				btn.setIcon("rotate-ccw");
				btn.setTooltip("Reset to default color");
				btn.onClick(() => {
					config.onColorChange(item.id, undefined);
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
