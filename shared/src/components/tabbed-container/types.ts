import type { App } from "obsidian";
import { z } from "zod";

import { CustomizableUIBaseStateSchema } from "../../core/customizable-ui-state";

const optionalStringRecord = z.record(z.string(), z.string()).optional().catch(undefined);

/** Zod schema for persisted tab container state. Reuse in plugin settings schemas. */
export const TabbedContainerStateSchema = CustomizableUIBaseStateSchema.extend({
	/** Ordered list of visible tab IDs. Controls both visibility and order. When absent, all tabs shown in default order. */
	visibleTabIds: z.array(z.string()).optional().catch(undefined),
	/** Per-group child state: visibility order, renames, and icon/color overrides. */
	groupState: z
		.record(
			z.string(),
			z.object({
				visibleChildIds: z.array(z.string()).optional().catch(undefined),
				childRenames: optionalStringRecord,
				childIconOverrides: optionalStringRecord,
				childColorOverrides: optionalStringRecord,
			})
		)
		.optional()
		.catch(undefined),
});

/** Serializable snapshot of tab container state. Safe to persist in plugin settings. */
export type TabbedContainerState = z.infer<typeof TabbedContainerStateSchema>;

/** Shape of a single group's persisted child state — inferred from the Zod schema. */
export type GroupStatePersisted = NonNullable<TabbedContainerState["groupState"]>[string];

export interface TabDefinition {
	id: string;
	label: string;
	/** Optional icon rendered before the tab label. Use any Obsidian icon ID (e.g. "calendar", "gantt-chart"). */
	icon?: string;
	/** Optional default color for the tab icon. */
	color?: string;
	render: (container: HTMLElement) => void | Promise<void>;
	cleanup?: () => void;
	/** Key handlers dispatched when this tab is active and the container was last interacted with. Keys are `KeyboardEvent.key` values (e.g. "ArrowLeft"). */
	keyHandlers?: Record<string, (e: KeyboardEvent) => void>;
}

export interface GroupTabDefinition {
	id: string;
	label: string;
	/** Optional icon rendered before the group tab label. */
	icon?: string;
	/** Optional default color for the group tab icon. */
	color?: string;
	children: TabDefinition[];
}

export type TabEntry = TabDefinition | GroupTabDefinition;

export function isGroupTab(entry: TabEntry): entry is GroupTabDefinition {
	return "children" in entry && Array.isArray(entry.children);
}

export interface GroupChildState {
	allChildren: TabDefinition[];
	visibleChildren: TabDefinition[];
	activeChildIndex: number;
	childRenames: Map<string, string>;
	childIconOverrides: Map<string, string>;
	childColorOverrides: Map<string, string>;
}

export interface TabbedContainerConfig {
	tabs: TabEntry[];
	cssPrefix: string;
	lazy?: boolean;
	/** Persisted state to restore. When provided, overrides tab order, visibility, and labels. */
	initialState?: TabbedContainerState;
	onTabChange?: (tabId: string, index: number) => void;
	/** Fires on any state mutation (tab switch, hide, reorder, rename). */
	onStateChange?: (state: TabbedContainerState) => void;
	/** When true, enables right-click context menu on tabs (hide, rename) and a "+" button to restore hidden tabs. Requires `app`. */
	editable?: boolean;
	/** When true, hovering over a group tab button opens its dropdown; moving the mouse away closes it. Default: false. */
	hoverDropdown?: boolean;
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
	/** Returns display labels for all visible tabs in their current order. */
	getVisibleLabels(): string[];
	readonly activeIndex: number;
	readonly activeId: string;
	readonly tabCount: number;
	destroy(): void;
}
