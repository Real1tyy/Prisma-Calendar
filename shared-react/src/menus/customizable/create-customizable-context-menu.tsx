import { Menu, type MenuItem as ObsidianMenuItem } from "obsidian";

import { openItemManagerModal } from "./item-manager-modal";
import { CustomizableMenuStore } from "./store";
import type {
	ContextMenuShowOptions,
	ContextMenuState,
	CustomizableContextMenuConfig,
	CustomizableContextMenuHandle,
	CustomizableContextMenuItem,
} from "./types";

type MenuItemInternals = ObsidianMenuItem & {
	dom?: HTMLElement;
	iconEl?: HTMLElement;
	titleEl?: HTMLElement;
};

function getMenuItemDom(item: ObsidianMenuItem): HTMLElement | undefined {
	return (item as MenuItemInternals).dom;
}

function getMenuItemIconEl(item: ObsidianMenuItem): HTMLElement | undefined {
	return (item as MenuItemInternals).iconEl;
}

function getMenuItemTitleEl(item: ObsidianMenuItem): HTMLElement | undefined {
	return (item as MenuItemInternals).titleEl;
}

/**
 * Customizable context menu — popup rendered by Obsidian's native `Menu` so it
 * inherits theme styling, hover/focus, keyboard navigation, and viewport-aware
 * positioning. The React surface is limited to the "Manage menu items" modal,
 * which is the only part that benefits from a component model. State (visible
 * items, ordering, renames, icon/colour/section overrides) lives in the
 * persistent {@link CustomizableMenuStore}.
 */
export function createCustomizableContextMenu(config: CustomizableContextMenuConfig): CustomizableContextMenuHandle {
	const { app, items, cssPrefix, currentState, defaults, onStateChange, editable = false } = config;

	const store = new CustomizableMenuStore({
		allItems: items,
		currentState,
		defaults,
		onStateChange,
	});

	let destroyed = false;

	const showItemManager = (): void => {
		if (destroyed || !editable) return;
		openItemManagerModal({ app, store, cssPrefix });
	};

	let openMenu: Menu | null = null;
	function hide(): void {
		openMenu?.hide();
		openMenu = null;
	}

	function show(eOrPosition: MouseEvent | { x: number; y: number }, options: ContextMenuShowOptions = {}): void {
		if (destroyed) return;
		hide();
		const { filter, titleOverrides, pinned = [] } = options;

		const menu = new Menu();
		openMenu = menu;
		const testIdPrefix = `${cssPrefix}context-menu-item-`;
		const snapshot = store.getSnapshot();
		let lastSection: string | undefined;

		for (const item of pinned) {
			menu.addItem((menuItem) => {
				menuItem.setTitle(item.label).onClick(() => item.onAction());
				if (item.icon) menuItem.setIcon(item.icon);
				getMenuItemDom(menuItem)?.setAttribute("data-testid", `${testIdPrefix}${item.id}`);
			});
		}
		// Forces a separator before the first configured item.
		if (pinned.length > 0) lastSection = "\u0000pinned";

		for (const item of snapshot.visibleItems) {
			if (filter && !filter(item.id)) continue;

			const section = store.getSection(item);
			if (lastSection !== undefined && section !== lastSection) {
				menu.addSeparator();
			}
			lastSection = section;

			const label = titleOverrides?.[item.id] ?? store.getLabel(item);
			const { icon, color, textColor, backgroundColor } = store.getAppearance(item);

			menu.addItem((menuItem) => {
				menuItem.setTitle(label).onClick(() => item.onAction());
				if (icon) menuItem.setIcon(icon);
				getMenuItemDom(menuItem)?.setAttribute("data-testid", `${testIdPrefix}${item.id}`);
				if (color) {
					getMenuItemIconEl(menuItem)?.style.setProperty("color", color);
				}
				if (textColor) {
					getMenuItemTitleEl(menuItem)?.style.setProperty("color", textColor);
				}
				if (backgroundColor) getMenuItemDom(menuItem)?.style.setProperty("background-color", backgroundColor);
			});
		}

		if (editable && snapshot.showSettingsButton) {
			menu.addSeparator();
			menu.addItem((menuItem) => {
				menuItem
					.setTitle("Manage menu items...")
					.setIcon("settings-2")
					.onClick(() => showItemManager());
				getMenuItemDom(menuItem)?.setAttribute("data-testid", `${testIdPrefix}manage`);
			});
		}

		if (eOrPosition instanceof MouseEvent) {
			menu.showAtMouseEvent(eOrPosition);
		} else {
			menu.showAtPosition(eOrPosition);
		}
	}

	return {
		show,
		hide,
		hideItem(id) {
			if (destroyed) return;
			store.hideItem(id);
		},
		restoreItem(id) {
			if (destroyed) return;
			store.restoreItem(id);
		},
		moveItem(id, direction) {
			if (destroyed) return;
			store.moveItem(id, direction);
		},
		showItemManager,
		getState(): ContextMenuState {
			return store.getState();
		},
		get visibleCount(): number {
			return store.visibleCount;
		},
		destroy() {
			if (destroyed) return;
			hide();
			destroyed = true;
		},
	};
}

export type { CustomizableContextMenuItem };
