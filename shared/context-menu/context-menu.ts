import { Menu } from "obsidian";

import { openItemManager } from "./item-manager";
import { injectContextMenuStyles } from "./styles";
import type { ContextMenuConfig, ContextMenuHandle, ContextMenuItemDefinition, ContextMenuState } from "./types";

function resolveVisibleItems(config: ContextMenuConfig): {
	visibleItems: ContextMenuItemDefinition[];
	renames: Map<string, string>;
	iconOverrides: Map<string, string>;
	colorOverrides: Map<string, string>;
	showSettingsButton: boolean;
} {
	const { items, initialState } = config;
	const renames = new Map(initialState?.renames ? Object.entries(initialState.renames) : []);
	const iconOverrides = new Map(initialState?.iconOverrides ? Object.entries(initialState.iconOverrides) : []);
	const colorOverrides = new Map(initialState?.colorOverrides ? Object.entries(initialState.colorOverrides) : []);

	const showSettingsButton = initialState?.showSettingsButton !== false;

	if (!initialState?.visibleItemIds) {
		return { visibleItems: items, renames, iconOverrides, colorOverrides, showSettingsButton };
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
		showSettingsButton,
	};
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

	const defaultOrder = allItems.map((i) => i.id);

	function buildState(): ContextMenuState {
		const state: ContextMenuState = {};

		if (renames.size > 0) state.renames = Object.fromEntries(renames);
		if (iconOverrides.size > 0) state.iconOverrides = Object.fromEntries(iconOverrides);
		if (colorOverrides.size > 0) state.colorOverrides = Object.fromEntries(colorOverrides);

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
		visibleItems = [...visibleItems, item];
		emitStateChange();
	}

	function moveItem(id: string, direction: -1 | 1): void {
		const idx = visibleItems.findIndex((i) => i.id === id);
		const newIdx = idx + direction;
		if (idx < 0 || newIdx < 0 || newIdx >= visibleItems.length) return;

		const updated = [...visibleItems];
		[updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
		visibleItems = updated;

		emitStateChange();
	}

	function showItemManager(): void {
		if (!editable) return;

		openItemManager({
			app,
			cssPrefix: config.cssPrefix,
			allItems,
			getVisibleItems: () => visibleItems,
			renames,
			iconOverrides,
			colorOverrides,
			showSettingsButton,
			onHide: hideItem,
			onRestore: restoreItem,
			onMove: moveItem,
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

		for (const item of visibleItems) {
			if (filterFn && !filterFn(item.id)) continue;

			if (item.section !== undefined && lastSection !== undefined && item.section !== lastSection) {
				menu.addSeparator();
			}
			lastSection = item.section;

			const label = titleOverrides?.[item.id] ?? getLabel(item);
			const icon = getIcon(item);
			const color = getColor(item);

			menu.addItem((menuItem) => {
				menuItem
					.setTitle(label)
					.setIcon(icon)
					.onClick(() => item.onAction());
				if (color) {
					const iconEl = (menuItem as unknown as { iconEl?: HTMLElement }).iconEl;
					if (iconEl) iconEl.style.setProperty("color", color);
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
