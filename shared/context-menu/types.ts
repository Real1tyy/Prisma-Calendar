import type { App } from "obsidian";
import { z } from "zod";

/** Zod schema for persisted context menu state. Embed in plugin settings schemas. */
export const ContextMenuStateSchema = z.object({
	/** Ordered list of visible item IDs. When absent, all items shown in default order. */
	visibleItemIds: z.array(z.string()).optional().catch(undefined),
	/** Custom labels keyed by item ID. */
	renames: z.record(z.string(), z.string()).optional().catch(undefined),
	/** Custom icons keyed by item ID. */
	iconOverrides: z.record(z.string(), z.string()).optional().catch(undefined),
	/** Custom colors keyed by item ID. */
	colorOverrides: z.record(z.string(), z.string()).optional().catch(undefined),
	/** Whether the settings gear item is shown at the bottom of the menu. Default: true. */
	showSettingsButton: z.boolean().optional().catch(undefined),
});

/** Serializable snapshot of context menu state. Safe to persist in plugin settings. */
export type ContextMenuState = z.infer<typeof ContextMenuStateSchema>;

export interface ContextMenuItemDefinition {
	id: string;
	label: string;
	icon: string;
	color?: string;
	/** Items with the same section are grouped; separators are inserted between different sections. */
	section?: string;
	/** Callback executed when the menu item is clicked. */
	onAction: () => void;
}

export interface ContextMenuConfig {
	items: ContextMenuItemDefinition[];
	cssPrefix: string;
	/** Persisted state to restore. When provided, overrides visibility, order, labels, and icons. */
	initialState?: ContextMenuState;
	/** Fires on any state mutation (reorder, rename, hide, icon change). */
	onStateChange?: (state: ContextMenuState) => void;
	/** When true, enables the item manager modal and settings menu entry. */
	editable?: boolean;
	app: App;
}

export interface ContextMenuHandle {
	/**
	 * Shows the context menu at the given position or mouse event.
	 * @param filterFn Optional runtime filter — return false to hide an item for this invocation.
	 * @param titleOverrides Optional per-item title overrides for this invocation (e.g., "Mark as done" vs "Mark as undone").
	 */
	show(
		eOrPosition: MouseEvent | { x: number; y: number },
		filterFn?: (id: string) => boolean,
		titleOverrides?: Record<string, string>
	): void;
	/** Hides an item by ID. No-op if only one item visible. */
	hideItem(id: string): void;
	/** Restores a hidden item by ID. */
	restoreItem(id: string): void;
	/** Moves an item by ID up (-1) or down (+1). */
	moveItem(id: string, direction: -1 | 1): void;
	/** Opens the item manager modal. No-op if not editable. */
	showItemManager(): void;
	/** Returns a serializable snapshot of the current state. */
	getState(): ContextMenuState;
	/** Number of currently visible items. */
	readonly visibleCount: number;
	/** Cleans up injected styles and state. */
	destroy(): void;
}
