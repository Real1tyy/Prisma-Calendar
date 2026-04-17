import type { App } from "obsidian";
import { setIcon, Setting } from "obsidian";

import { createCssUtils } from "../../utils/css-utils";
import { showModal } from "../component-renderer/modal";
import type { ModalContext } from "../component-renderer/types";
import { renderManagerRowContent } from "../primitives/manager-row";
import type { ContextMenuItemDefinition } from "./types";

export interface ItemManagerConfig {
	app: App;
	cssPrefix: string;
	allItems: ContextMenuItemDefinition[];
	getVisibleItems: () => ContextMenuItemDefinition[];
	getSection: (item: ContextMenuItemDefinition) => string;
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
	showSettingsButton: boolean;
	onHide: (id: string) => void;
	onRestore: (id: string) => void;
	onMove: (id: string, direction: -1 | 1) => void;
	onMoveToSection: (id: string, targetSection: string, insertBeforeId?: string) => void;
	onRename: (id: string, label: string | undefined) => void;
	onIconChange: (id: string, icon: string | undefined) => void;
	onColorChange: (id: string, color: string | undefined) => void;
	onToggleSettingsButton: (visible: boolean) => void;
}

interface SectionGroup {
	section: string;
	visible: ContextMenuItemDefinition[];
	hidden: ContextMenuItemDefinition[];
}

function titleCase(s: string): string {
	if (!s) return "Ungrouped";
	return s.charAt(0).toUpperCase() + s.slice(1);
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
			contentEl.setAttribute("data-testid", `${cssPrefix}item-manager-modal`);
			renderManagerList(contentEl);
		},
	});

	function matchesSearch(item: ContextMenuItemDefinition): boolean {
		const query = modalCtx.searchQuery;
		if (!query) return true;
		const displayLabel = config.renames.get(item.id) ?? item.label;
		return (
			displayLabel.toLowerCase().includes(query) ||
			item.label.toLowerCase().includes(query) ||
			item.id.toLowerCase().includes(query)
		);
	}

	function buildSectionGroups(): SectionGroup[] {
		const visibleItems = config.getVisibleItems();
		const visibleIds = new Set(visibleItems.map((i) => i.id));
		const hiddenItems = allItems.filter((i) => !visibleIds.has(i.id));

		const groupMap = new Map<string, SectionGroup>();
		const groups: SectionGroup[] = [];

		for (const item of visibleItems) {
			const section = config.getSection(item);
			let group = groupMap.get(section);
			if (!group) {
				group = { section, visible: [], hidden: [] };
				groupMap.set(section, group);
				groups.push(group);
			}
			group.visible.push(item);
		}

		for (const item of hiddenItems) {
			const section = config.getSection(item);
			let group = groupMap.get(section);
			if (!group) {
				group = { section, visible: [], hidden: [] };
				groupMap.set(section, group);
				groups.push(group);
			}
			group.hidden.push(item);
		}

		return groups;
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

		if (isSearching) {
			renderFlatFilteredList(list, visibleItems);
			return;
		}

		const groups = buildSectionGroups();
		let draggedId: string | null = null;

		for (const group of groups) {
			const allGroupItems = [...group.visible, ...group.hidden];
			const filteredItems = allGroupItems.filter((i) => matchesSearch(i));
			if (filteredItems.length === 0) continue;

			const sectionEl = list.createDiv(css.cls("item-manager-section"));
			sectionEl.dataset["section"] = group.section;

			sectionEl.createDiv({
				text: titleCase(group.section),
				cls: css.cls("item-manager-section-header"),
			});

			// Make section a drop target for cross-section moves
			sectionEl.addEventListener("dragover", (e) => {
				e.preventDefault();
				if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
			});

			sectionEl.addEventListener("drop", (e) => {
				if (!draggedId) return;
				const targetRow = (e.target as HTMLElement).closest(`[data-item-id]`) as HTMLElement | null;
				if (targetRow) return; // Handled by row-level drop
				e.preventDefault();

				const draggedItem = allItems.find((i) => i.id === draggedId);
				if (!draggedItem) return;
				const draggedSection = config.getSection(draggedItem);
				if (draggedSection === group.section) return;

				config.onMoveToSection(draggedId, group.section);
				renderManagerList(root);
			});

			for (const item of filteredItems) {
				const isVisible = group.visible.includes(item);
				const sectionItems = group.visible;
				const posInSection = sectionItems.indexOf(item);
				const isExpanded = expandedItemId === item.id;

				const row = sectionEl.createDiv(css.cls("item-manager-row"));
				row.setAttribute("data-testid", `${cssPrefix}item-manager-row-${item.id}`);
				if (!isVisible) css.addCls(row, "item-manager-row-hidden");

				if (isVisible) {
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
						e.stopPropagation();
						if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
						css.addCls(row, "item-manager-row-dragover");
					});

					row.addEventListener("dragleave", () => {
						css.removeCls(row, "item-manager-row-dragover");
					});

					row.addEventListener("drop", (e) => {
						e.preventDefault();
						e.stopPropagation();
						css.removeCls(row, "item-manager-row-dragover");
						if (!draggedId || draggedId === item.id) return;

						const draggedItem = allItems.find((i) => i.id === draggedId);
						if (!draggedItem) return;
						const draggedSection = config.getSection(draggedItem);
						const targetSection = config.getSection(item);

						if (draggedSection === targetSection) {
							// Same section — reorder via moves
							const currentVisible = config.getVisibleItems();
							const fromIdx = currentVisible.findIndex((i) => i.id === draggedId);
							const toIdx = currentVisible.findIndex((i) => i.id === item.id);
							if (fromIdx < 0 || toIdx < 0) return;

							if (fromIdx < toIdx) {
								for (let i = fromIdx; i < toIdx; i++) config.onMove(draggedId, 1);
							} else {
								for (let i = fromIdx; i > toIdx; i--) config.onMove(draggedId, -1);
							}
						} else {
							// Cross-section — move to target section, before this item
							config.onMoveToSection(draggedId, targetSection, item.id);
						}

						renderManagerList(root);
					});
				}

				const dragHandle = row.createDiv(css.cls("item-manager-drag"));
				if (isVisible) {
					const gripIcon = dragHandle.createEl("span", { cls: css.cls("item-manager-grip") });
					setIcon(gripIcon, "grip-vertical");
				}

				const dragControls = row.createDiv(css.cls("item-manager-arrows"));

				if (isVisible && posInSection > 0) {
					const upBtn = dragControls.createEl("button", { cls: css.cls("item-manager-drag-btn") });
					setIcon(upBtn, "chevron-up");
					upBtn.addEventListener("click", () => {
						config.onMove(item.id, -1);
						renderManagerList(root);
					});
				}

				if (isVisible && posInSection < sectionItems.length - 1) {
					const downBtn = dragControls.createEl("button", { cls: css.cls("item-manager-drag-btn") });
					setIcon(downBtn, "chevron-down");
					downBtn.addEventListener("click", () => {
						config.onMove(item.id, 1);
						renderManagerList(root);
					});
				}

				renderItemContent(row, item, isVisible, isExpanded, visibleItems, root);
			}
		}
	}

	function renderFlatFilteredList(list: HTMLElement, visibleItems: ContextMenuItemDefinition[]): void {
		const visibleIds = new Set(visibleItems.map((i) => i.id));
		const orderedItems = [...visibleItems, ...allItems.filter((i) => !visibleIds.has(i.id))];
		const filteredItems = orderedItems.filter((i) => matchesSearch(i));

		if (filteredItems.length === 0) {
			list.createDiv({
				text: "No matching items",
				cls: css.cls("modal-search-empty"),
			});
			return;
		}

		for (const item of filteredItems) {
			const isVisible = visibleIds.has(item.id);
			const isExpanded = expandedItemId === item.id;

			const row = list.createDiv(css.cls("item-manager-row"));
			row.setAttribute("data-testid", `${cssPrefix}item-manager-row-${item.id}`);
			if (!isVisible) css.addCls(row, "item-manager-row-hidden");

			renderItemContent(row, item, isVisible, isExpanded, visibleItems, list.parentElement!);
		}
	}

	function renderItemContent(
		row: HTMLElement,
		item: ContextMenuItemDefinition,
		isVisible: boolean,
		isExpanded: boolean,
		visibleItems: ContextMenuItemDefinition[],
		root: HTMLElement
	): void {
		renderManagerRowContent(row, {
			app,
			css,
			rowPrefix: "item-manager",
			testIdPrefix: cssPrefix,
			item,
			isVisible,
			isExpanded,
			visibleCount: visibleItems.length,
			renames: config.renames,
			iconOverrides: config.iconOverrides,
			colorOverrides: config.colorOverrides,
			onToggleExpand: () => {
				expandedItemId = isExpanded ? null : item.id;
				renderManagerList(root);
			},
			onHide: () => {
				if (config.getVisibleItems().length > 1) {
					config.onHide(item.id);
					renderManagerList(root);
				}
			},
			onRestore: () => {
				config.onRestore(item.id);
				renderManagerList(root);
			},
			onRename: config.onRename,
			onIconChange: config.onIconChange,
			onColorChange: config.onColorChange,
			rerender: () => renderManagerList(root),
		});
	}
}
