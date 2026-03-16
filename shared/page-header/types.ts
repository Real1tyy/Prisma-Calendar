import type { App, ItemView, WorkspaceLeaf } from "obsidian";
import { z } from "zod";

/** Zod schema for persisted page header state. Embed in plugin settings schemas. */
export const PageHeaderStateSchema = z.object({
	/** Ordered list of visible action IDs. When absent, all actions shown in default order. */
	visibleActionIds: z.array(z.string()).optional().catch(undefined),
	/** Custom labels keyed by action ID. */
	renames: z.record(z.string(), z.string()).optional().catch(undefined),
	/** Custom icons keyed by action ID. */
	iconOverrides: z.record(z.string(), z.string()).optional().catch(undefined),
	/** Custom colors keyed by action ID. */
	colorOverrides: z.record(z.string(), z.string()).optional().catch(undefined),
	/** Whether the settings gear button is shown in the header. Default: true. */
	showSettingsButton: z.boolean().optional().catch(undefined),
});

/** Serializable snapshot of page header state. Safe to persist in plugin settings. */
export type PageHeaderState = z.infer<typeof PageHeaderStateSchema>;

export interface HeaderActionDefinition {
	id: string;
	label: string;
	icon: string;
	color?: string;
	/** Callback executed when the header button is clicked. */
	onAction: (view: ItemView) => void;
}

export type PageHeaderMode = "override" | "append";

export interface PageHeaderConfig {
	actions: HeaderActionDefinition[];
	cssPrefix: string;
	/** Persisted state to restore. When provided, overrides visibility, order, labels, and icons. */
	initialState?: PageHeaderState;
	/** Fires on any state mutation (reorder, rename, hide, icon change). */
	onStateChange?: (state: PageHeaderState) => void;
	/** When true, enables the action manager modal. */
	editable?: boolean;
	app: App;
	/**
	 * Controls how plugin actions interact with existing view-actions buttons.
	 * - `"override"` (default): Hides all existing buttons and shows only plugin actions.
	 *   Original buttons are restored on destroy/remove.
	 * - `"append"`: Keeps existing buttons visible and appends plugin actions alongside them.
	 */
	mode?: PageHeaderMode;
}

export interface PageHeaderHandle {
	/** Applies header buttons to a leaf. Saves and hides existing buttons, renders configured ones. */
	apply(leaf: WorkspaceLeaf): void;
	/** Removes header buttons from a leaf. Restores the original buttons. */
	remove(leaf: WorkspaceLeaf): void;
	/** Re-renders buttons on all currently applied leaves. */
	refresh(): void;
	/** Hides an action by ID. No-op if only one action visible. */
	hideAction(id: string): void;
	/** Restores a hidden action by ID. */
	restoreAction(id: string): void;
	/** Moves an action by ID up (-1) or down (+1). */
	moveAction(id: string, direction: -1 | 1): void;
	/** Opens the action manager modal. No-op if not editable. */
	showActionManager(): void;
	/** Returns a serializable snapshot of the current state. */
	getState(): PageHeaderState;
	/** Number of currently visible actions. */
	readonly visibleCount: number;
	/** Removes buttons from all applied leaves, restores originals, and cleans up. */
	destroy(): void;
}
