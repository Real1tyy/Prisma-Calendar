import { injectStyleSheet } from "@real1ty/obsidian-plugins";
import { Menu, type MenuItem as ObsidianMenuItem } from "obsidian";

import { openItemManagerModal } from "./item-manager-modal";
import { CustomizableMenuStore } from "./store";
import { buildMenuChromeStyles } from "./styles";
import type {
	ContextMenuState,
	CustomizableContextMenuConfig,
	CustomizableContextMenuHandle,
	CustomizableContextMenuItem,
} from "./types";

type MenuItemInternals = ObsidianMenuItem & {
	dom?: HTMLElement;
	iconEl?: HTMLElement;
};

type MenuInternals = Menu & {
	dom?: HTMLElement;
};

function getMenuItemDom(item: ObsidianMenuItem): HTMLElement | undefined {
	return (item as MenuItemInternals).dom;
}

function getMenuItemIconEl(item: ObsidianMenuItem): HTMLElement | undefined {
	return (item as MenuItemInternals).iconEl;
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

	function show(
		eOrPosition: MouseEvent | { x: number; y: number },
		filterFn?: (id: string) => boolean,
		titleOverrides?: Record<string, string>
	): void {
		if (destroyed) return;

		const menu = new Menu();
		const testIdPrefix = `${cssPrefix}context-menu-item-`;
		const snapshot = store.getSnapshot();
		let lastSection: string | undefined;

		for (const item of snapshot.visibleItems) {
			if (filterFn && !filterFn(item.id)) continue;

			const section = store.getSection(item);
			if (lastSection !== undefined && section !== lastSection) {
				menu.addSeparator();
			}
			lastSection = section;

			const label = titleOverrides?.[item.id] ?? store.getLabel(item);
			const icon = store.getIcon(item);
			const color = store.getColor(item);

			menu.addItem((menuItem) => {
				menuItem.setTitle(label).onClick(() => item.onAction());
				if (icon) menuItem.setIcon(icon);
				getMenuItemDom(menuItem)?.setAttribute("data-testid", `${testIdPrefix}${item.id}`);
				if (color) {
					getMenuItemIconEl(menuItem)?.style.setProperty("color", color);
				}
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

		// Duck-typed, not `instanceof MouseEvent`: events from a pop-out window
		// are instances of that window's MouseEvent, not this realm's.
		if ("clientX" in eOrPosition) {
			menu.showAtMouseEvent(eOrPosition);
		} else {
			menu.showAtPosition(eOrPosition);
		}

		// After show — the menu DOM has joined its final document (main window
		// or pop-out) only once attached.
		const menuDom = (menu as MenuInternals).dom;
		if (menuDom) {
			menuDom.classList.add(`${cssPrefix}menu`);
			injectStyleSheet(`${cssPrefix}menu-chrome-styles`, buildMenuChromeStyles(cssPrefix), menuDom.ownerDocument);
		}
	}

	return {
		show,
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
			destroyed = true;
		},
	};
}

export type { CustomizableContextMenuItem };
