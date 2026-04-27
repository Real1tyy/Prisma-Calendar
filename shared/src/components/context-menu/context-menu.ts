import { Menu, type MenuItem as ObsidianMenuItem } from "obsidian";

import { openItemManager } from "./item-manager";
import { injectContextMenuStyles } from "./styles";
import type { ContextMenuConfig, ContextMenuHandle, ContextMenuItemDefinition, ContextMenuState } from "./types";

const DEFAULT_SECTION = "";

/**
 * Obsidian's MenuItem exposes `dom` (the `<div>` row) and `iconEl` as
 * undocumented instance properties. The public typings don't declare them, so
 * every access needs a cast. Keep the cast contained to this one shape so the
 * rest of the file reads as plain code — if the typings ever grow the public
 * fields, only this type alias needs updating.
 */
type MenuItemInternals = ObsidianMenuItem & {
	dom?: HTMLElement;
	iconEl?: HTMLElement;
};

function getMenuItemDom(item: ObsidianMenuItem): HTMLElement | undefined {
	return (item as MenuItemInternals).dom;
}

function getMenuItemIconEl(item: ObsidianMenuItem): HTMLElement | undefined {
	return (item as MenuItemInternals).iconEl;
}

function resolveVisibleItems(config: ContextMenuConfig): {
	visibleItems: ContextMenuItemDefinition[];
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
	sectionOverrides: Map<string, string>;
	showSettingsButton: boolean;
} {
	const { items, initialState } = config;
	const renames = new Map(initialState?.renames ? Object.entries(initialState.renames) : []);
	const iconOverrides = new Map(initialState?.iconOverrides ? Object.entries(initialState.iconOverrides) : []);
	const colorOverrides = new Map(initialState?.colorOverrides ? Object.entries(initialState.colorOverrides) : []);
	const sectionOverrides = new Map(initialState?.sectionOverrides ? Object.entries(initialState.sectionOverrides) : []);

	const showSettingsButton = initialState?.showSettingsButton !== false;

	if (!initialState?.visibleItemIds) {
		return { visibleItems: items, renames, iconOverrides, colorOverrides, sectionOverrides, showSettingsButton };
	}

	const itemMap = new Map(items.map((i) => [i.id, i]));
	const visible = initialState.visibleItemIds
		.map((id) => itemMap.get(id))
		.filter((item): item is ContextMenuItemDefinition => item !== undefined);

	return {
		visibleItems: visible.length > 0 ? visible : items,
		renames,
		iconOverrides,
		colorOverrides,
		sectionOverrides,
		showSettingsButton,
	};
}

/** Groups visible items by their resolved section, preserving per-section order. */
function groupBySection(
	items: ContextMenuItemDefinition[],
	getSection: (item: ContextMenuItemDefinition) => string
): { section: string; items: ContextMenuItemDefinition[] }[] {
	const groups: { section: string; items: ContextMenuItemDefinition[] }[] = [];
	const sectionMap = new Map<string, ContextMenuItemDefinition[]>();

	for (const item of items) {
		const section = getSection(item);
		let group = sectionMap.get(section);
		if (!group) {
			group = [];
			sectionMap.set(section, group);
			groups.push({ section, items: group });
		}
		group.push(item);
	}

	return groups;
}

export function createContextMenu(config: ContextMenuConfig): ContextMenuHandle {
	injectContextMenuStyles(config.cssPrefix);
	const { app, onStateChange, editable } = config;
	const allItems = config.items;

	const resolved = resolveVisibleItems(config);
	let visibleItems = [...resolved.visibleItems];
	const renames = resolved.renames;
	const iconOverrides = resolved.iconOverrides;
	const colorOverrides = resolved.colorOverrides;
	const sectionOverrides = resolved.sectionOverrides;
	let showSettingsButton = resolved.showSettingsButton;

	let destroyed = false;

	function getLabel(item: ContextMenuItemDefinition): string {
		return renames.get(item.id) ?? item.label;
	}

	function getIcon(item: ContextMenuItemDefinition): string {
		return iconOverrides.get(item.id) ?? item.icon;
	}

	function getColor(item: ContextMenuItemDefinition): string | undefined {
		return colorOverrides.get(item.id) ?? item.color;
	}

	function getSection(item: ContextMenuItemDefinition): string {
		return sectionOverrides.get(item.id) ?? item.section ?? DEFAULT_SECTION;
	}

	const defaultOrder = allItems.map((i) => i.id);

	function buildState(): ContextMenuState {
		const state: ContextMenuState = {};

		if (renames.size > 0) state.renames = Object.fromEntries(renames);
		if (iconOverrides.size > 0) state.iconOverrides = Object.fromEntries(iconOverrides);
		if (colorOverrides.size > 0) state.colorOverrides = Object.fromEntries(colorOverrides);
		if (sectionOverrides.size > 0) state.sectionOverrides = Object.fromEntries(sectionOverrides);

		const currentOrder = visibleItems.map((i) => i.id);
		if (currentOrder.length !== defaultOrder.length || currentOrder.some((id, i) => id !== defaultOrder[i])) {
			state.visibleItemIds = currentOrder;
		}

		if (!showSettingsButton) state.showSettingsButton = false;

		return state;
	}

	function emitStateChange(): void {
		onStateChange?.(buildState());
	}

	function hideItem(id: string): void {
		if (visibleItems.length <= 1) return;
		if (!visibleItems.some((i) => i.id === id)) return;
		visibleItems = visibleItems.filter((i) => i.id !== id);
		emitStateChange();
	}

	function restoreItem(id: string): void {
		const item = allItems.find((i) => i.id === id);
		if (!item || visibleItems.some((i) => i.id === id)) return;

		// Insert at the end of the item's section
		const section = getSection(item);
		const groups = groupBySection(visibleItems, getSection);
		const sectionGroup = groups.find((g) => g.section === section);

		if (sectionGroup) {
			const lastItemInSection = sectionGroup.items[sectionGroup.items.length - 1];
			const insertIdx = visibleItems.indexOf(lastItemInSection) + 1;
			visibleItems = [...visibleItems.slice(0, insertIdx), item, ...visibleItems.slice(insertIdx)];
		} else {
			visibleItems = [...visibleItems, item];
		}

		emitStateChange();
	}

	function moveItem(id: string, direction: -1 | 1): void {
		const idx = visibleItems.findIndex((i) => i.id === id);
		if (idx < 0) return;

		const item = visibleItems[idx];
		const section = getSection(item);

		// Find section boundaries in the flat array
		const sectionItems = visibleItems.filter((i) => getSection(i) === section);
		const posInSection = sectionItems.indexOf(item);

		const newPosInSection = posInSection + direction;
		if (newPosInSection < 0 || newPosInSection >= sectionItems.length) return;

		// Swap with the adjacent item within the section
		const swapTarget = sectionItems[newPosInSection];
		const swapIdx = visibleItems.indexOf(swapTarget);

		const updated = [...visibleItems];
		[updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
		visibleItems = updated;

		emitStateChange();
	}

	function moveItemToSection(id: string, targetSection: string, insertBeforeId?: string): void {
		const itemIdx = visibleItems.findIndex((i) => i.id === id);
		if (itemIdx < 0) return;

		const item = visibleItems[itemIdx];
		const currentSection = getSection(item);
		if (currentSection === targetSection && !insertBeforeId) return;

		// Update section override
		const defaultSection = item.section ?? DEFAULT_SECTION;
		if (targetSection !== defaultSection) {
			sectionOverrides.set(id, targetSection);
		} else {
			sectionOverrides.delete(id);
		}

		// Remove from current position
		const withoutItem = visibleItems.filter((i) => i.id !== id);

		if (insertBeforeId) {
			const insertIdx = withoutItem.findIndex((i) => i.id === insertBeforeId);
			if (insertIdx >= 0) {
				visibleItems = [...withoutItem.slice(0, insertIdx), item, ...withoutItem.slice(insertIdx)];
			} else {
				visibleItems = [...withoutItem, item];
			}
		} else {
			// Append at end of target section
			const groups = groupBySection(withoutItem, getSection);
			const targetGroup = groups.find((g) => g.section === targetSection);
			if (targetGroup) {
				const lastItem = targetGroup.items[targetGroup.items.length - 1];
				const insertIdx = withoutItem.indexOf(lastItem) + 1;
				visibleItems = [...withoutItem.slice(0, insertIdx), item, ...withoutItem.slice(insertIdx)];
			} else {
				visibleItems = [...withoutItem, item];
			}
		}

		emitStateChange();
	}

	function showItemManager(): void {
		if (!editable) return;

		openItemManager({
			app,
			cssPrefix: config.cssPrefix,
			allItems,
			getVisibleItems: () => visibleItems,
			getSection,
			renames,
			iconOverrides,
			colorOverrides,
			showSettingsButton,
			onHide: hideItem,
			onRestore: restoreItem,
			onMove: moveItem,
			onMoveToSection: moveItemToSection,
			onRename: (id, label) => {
				if (label) {
					const item = allItems.find((i) => i.id === id);
					if (item && label !== item.label) {
						renames.set(id, label);
					} else {
						renames.delete(id);
					}
				} else {
					renames.delete(id);
				}
				emitStateChange();
			},
			onIconChange: (id, icon) => {
				if (icon) {
					const item = allItems.find((i) => i.id === id);
					if (item && icon !== item.icon) {
						iconOverrides.set(id, icon);
					} else {
						iconOverrides.delete(id);
					}
				} else {
					iconOverrides.delete(id);
				}
				emitStateChange();
			},
			onColorChange: (id, color) => {
				if (color) {
					colorOverrides.set(id, color);
				} else {
					colorOverrides.delete(id);
				}
				emitStateChange();
			},
			onToggleSettingsButton: (visible) => {
				showSettingsButton = visible;
				emitStateChange();
			},
		});
	}

	function show(
		eOrPosition: MouseEvent | { x: number; y: number },
		filterFn?: (id: string) => boolean,
		titleOverrides?: Record<string, string>
	): void {
		if (destroyed) return;

		const menu = new Menu();
		let lastSection: string | undefined;
		const testIdPrefix = `${config.cssPrefix}context-menu-item-`;

		for (const item of visibleItems) {
			if (filterFn && !filterFn(item.id)) continue;

			const section = getSection(item);
			if (lastSection !== undefined && section !== lastSection) {
				menu.addSeparator();
			}
			lastSection = section;

			const label = titleOverrides?.[item.id] ?? getLabel(item);
			const icon = getIcon(item);
			const color = getColor(item);

			menu.addItem((menuItem) => {
				menuItem
					.setTitle(label)
					.setIcon(icon)
					.onClick(() => item.onAction());
				// Stable testid per item id — E2E specs click entries by id rather
				// than by label (which drifts with localization and renames).
				getMenuItemDom(menuItem)?.setAttribute("data-testid", `${testIdPrefix}${item.id}`);
				if (color) {
					getMenuItemIconEl(menuItem)?.style.setProperty("color", color);
				}
			});
		}

		if (editable && showSettingsButton) {
			menu.addSeparator();
			menu.addItem((menuItem) => {
				menuItem
					.setTitle("Manage menu items...")
					.setIcon("settings-2")
					.onClick(() => showItemManager());
				getMenuItemDom(menuItem)?.setAttribute("data-testid", `${testIdPrefix}__manage`);
			});
		}

		if (eOrPosition instanceof MouseEvent) {
			menu.showAtMouseEvent(eOrPosition);
		} else {
			menu.showAtPosition(eOrPosition);
		}
	}

	const handle: ContextMenuHandle = {
		show(
			eOrPosition: MouseEvent | { x: number; y: number },
			filterFn?: (id: string) => boolean,
			titleOverrides?: Record<string, string>
		): void {
			if (destroyed) return;
			show(eOrPosition, filterFn, titleOverrides);
		},

		hideItem(id: string): void {
			if (destroyed) return;
			hideItem(id);
		},

		restoreItem(id: string): void {
			if (destroyed) return;
			restoreItem(id);
		},

		moveItem(id: string, direction: -1 | 1): void {
			if (destroyed) return;
			moveItem(id, direction);
		},

		showItemManager(): void {
			if (destroyed) return;
			showItemManager();
		},

		getState(): ContextMenuState {
			return buildState();
		},

		get visibleCount(): number {
			return visibleItems.length;
		},

		destroy(): void {
			destroyed = true;
		},
	};

	return handle;
}
