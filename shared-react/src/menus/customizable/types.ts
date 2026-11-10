import { CustomizableUIBaseStateSchema } from "@real1ty/obsidian-plugins";
import type { App } from "obsidian";
import { z } from "zod";

/** Zod schema for persisted context menu state. Embed in plugin settings schemas. */
export const ContextMenuStateSchema = CustomizableUIBaseStateSchema.extend({
	/** Ordered list of visible item IDs. When absent, all items shown in default order. */
	visibleItemIds: z.array(z.string()).optional().catch(undefined),
	/** Section reassignments keyed by item ID. Only stores overrides — items keep their default section unless moved. */
	sectionOverrides: z.record(z.string(), z.string()).optional().catch(undefined),
});

/** Serializable snapshot of context menu state. Safe to persist in plugin settings. */
export type ContextMenuState = z.infer<typeof ContextMenuStateSchema>;

export interface CustomizableContextMenuItem {
	id: string;
	label: string;
	icon?: string;
	/** Optional default color for the item icon. */
	color?: string;
	/** Optional default color for the item label text. */
	textColor?: string;
	/** Optional default background color for the menu item. */
	backgroundColor?: string;
	/** Items with the same section are grouped; separators are inserted between different sections. */
	section?: string;
	/** Callback executed when the menu item is clicked. */
	onAction: () => void;
}

export interface CustomizableContextMenuConfig {
	items: CustomizableContextMenuItem[];
	cssPrefix: string;
	/** Persisted user customizations (from settings). When omitted, the menu starts from `defaults`. */
	currentState?: ContextMenuState;
	/** Factory defaults applied by the item manager's Reset button and used as the initial state when `currentState` is omitted. */
	defaults?: ContextMenuState;
	/** Fires on any state mutation (reorder, rename, hide, icon change). */
	onStateChange?: (state: ContextMenuState) => void;
	/** When true, enables the item manager modal and settings menu entry. */
	editable?: boolean;
	app: App;
}

/** An item fixed at the top of one invocation — outside the user's customization. */
export interface PinnedContextMenuItem {
	id: string;
	label: string;
	icon?: string;
	onAction: () => void;
}

export interface ContextMenuShowOptions {
	/** Return false to hide a configured item for this invocation. */
	filter?: (id: string) => boolean;
	/** Per-item titles for this invocation (e.g., "Mark as done" vs "Mark as undone"). */
	titleOverrides?: Record<string, string>;
	/** Rendered first, then a separator, ahead of the configured items. */
	pinned?: readonly PinnedContextMenuItem[];
}

export interface CustomizableContextMenuHandle {
	/** Shows the context menu at the given position or mouse event. */
	show(eOrPosition: MouseEvent | { x: number; y: number }, options?: ContextMenuShowOptions): void;
	/** Closes the menu this handle last opened, if it is still open. */
	hide(): void;
	/** Hides an item by ID. No-op if only one item visible. */
	hideItem(id: string): void;
	/** Restores a hidden item by ID. */
	restoreItem(id: string): void;
	/** Moves an item by ID up (-1) or down (+1) within its section. */
	moveItem(id: string, direction: -1 | 1): void;
	/** Opens the item manager modal. No-op if not editable. */
	showItemManager(): void;
	/** Returns a serializable snapshot of the current state. */
	getState(): ContextMenuState;
	/** Number of currently visible items. */
	readonly visibleCount: number;
	/** Cleans up the React root, injected styles, and listeners. */
	destroy(): void;
}
