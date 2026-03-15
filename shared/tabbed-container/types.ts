import type { App } from "obsidian";
import { z } from "zod";

/** Zod schema for persisted tab container state. Reuse in plugin settings schemas. */
export const TabbedContainerStateSchema = z.object({
	activeTabId: z.string().catch(""),
	/** Ordered list of visible tab IDs. Controls both visibility and order. When absent, all tabs shown in default order. */
	visibleTabIds: z.array(z.string()).optional().catch(undefined),
	/** Custom labels keyed by tab ID. */
	renames: z.record(z.string(), z.string()).optional().catch(undefined),
});

/** Serializable snapshot of tab container state. Safe to persist in plugin settings. */
export type TabbedContainerState = z.infer<typeof TabbedContainerStateSchema>;

export interface TabDefinition {
	id: string;
	label: string;
	render: (container: HTMLElement) => void | Promise<void>;
	cleanup?: () => void;
}

export interface TabbedContainerConfig {
	tabs: TabDefinition[];
	cssPrefix: string;
	initialTab?: number;
	lazy?: boolean;
	/** Persisted state to restore. When provided, overrides `initialTab`, tab order, visibility, and labels. */
	initialState?: TabbedContainerState;
	onTabChange?: (tabId: string, index: number) => void;
	/** Fires on any state mutation (tab switch, hide, reorder, rename). */
	onStateChange?: (state: TabbedContainerState) => void;
	/** When true, enables right-click context menu on tabs (hide, rename) and a "+" button to restore hidden tabs. Requires `app`. */
	editable?: boolean;
	/** Required when `editable: true`. */
	app?: App;
	/**
	 * When provided, the tab bar buttons are rendered into this element
	 * instead of inside the main container. The content panels are still
	 * placed inside the main container passed to `createTabbedContainer`.
	 */
	tabBarContainer?: HTMLElement;
	/**
	 * When provided alongside `tabBarContainer`, the tab bar is inserted
	 * before this sibling element instead of being appended at the end.
	 */
	tabBarInsertBefore?: Element;
}

export interface TabbedContainerHandle {
	switchTo(indexOrId: number | string): void;
	next(): void;
	previous(): void;
	/** Hides a tab by ID. No-op if only one tab visible. */
	hideTab(id: string): void;
	/** Restores a hidden tab by ID. */
	restoreTab(id: string): void;
	/** Moves a tab by ID left (-1) or right (+1). */
	moveTab(id: string, direction: -1 | 1): void;
	/** Opens the tab manager modal. No-op if not editable. */
	showTabManager(): void;
	/** Returns a serializable snapshot of the current tab state. */
	getState(): TabbedContainerState;
	readonly activeIndex: number;
	readonly activeId: string;
	readonly tabCount: number;
	destroy(): void;
}
