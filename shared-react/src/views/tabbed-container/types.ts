import { CustomizableUIBaseStateSchema } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { ReactNode } from "react";
import { z } from "zod";

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

/**
 * Build a settings-side Zod field for `TabbedContainerState` whose parsed value
 * is non-undefined (defaults to `{}` — components apply their own internal
 * defaults for "no overrides yet"). Pairs with `usePersistedTabbedContainerState`
 * on the React side; same shape as `gridStateField`.
 *
 * Pass `defaults` to bake in plugin-specific preferences (e.g. a curated
 * `visibleTabIds` subset). When omitted, the empty object means "no
 * customizations" and the consumer can leave the tab list / labels alone.
 */
export function tabbedContainerField(defaults?: TabbedContainerState) {
	const seed: TabbedContainerState = defaults ?? {};
	return TabbedContainerStateSchema.default(seed).catch(seed);
}

/** Shape of a single group's persisted child state — inferred from the Zod schema. */
export type GroupStatePersisted = NonNullable<TabbedContainerState["groupState"]>[string];

export interface TabDefinition {
	id: string;
	label: string;
	/** Optional icon rendered before the tab label. Use any Obsidian icon ID (e.g. "calendar", "gantt-chart"). */
	icon?: string;
	/** Optional default color for the tab icon. */
	color?: string;
	/** React content rendered inside the tab panel when active. May be a node or a thunk for lazy evaluation. */
	content: ReactNode | (() => ReactNode);
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

export interface TabbedContainerProps {
	tabs: TabEntry[];
	cssPrefix: string;
	/** When true, panels are mounted only after the first activation. Default: true. */
	lazy?: boolean;
	/** Persisted state to restore. Overrides tab order, visibility, and labels. */
	initialState?: TabbedContainerState;
	onTabChange?: (tabId: string, index: number) => void;
	/** Fires on any state mutation (tab switch, hide, reorder, rename). */
	onStateChange?: (state: TabbedContainerState) => void;
	/** When true, renders the manage button + right-click menus (hide, rename, reorder). Requires `app`. */
	editable?: boolean;
	/** When true, hovering over a group tab opens its dropdown; moving away closes it. Default: false. */
	hoverDropdown?: boolean;
	/** Required when `editable: true`. */
	app?: App;
	/** When provided, the tab bar is portaled into this element instead of rendering inline. */
	tabBarContainer?: HTMLElement | null;
	/** When provided alongside `tabBarContainer`, the tab bar is inserted before this sibling. */
	tabBarInsertBefore?: Element | null;
	/** Imperative escape hatch for keyboard commands and external orchestration. */
	handleRef?: { current: TabbedContainerHandle | null };
}

/** Imperative handle exposed for command registration and external orchestration. */
export interface TabbedContainerHandle {
	switchTo(indexOrId: number | string): void;
	next(): void;
	previous(): void;
	hideTab(id: string): void;
	restoreTab(id: string): void;
	moveTab(id: string, direction: -1 | 1): void;
	showTabManager(): void;
	getState(): TabbedContainerState;
	getVisibleLabels(): string[];
	readonly activeIndex: number;
	readonly activeId: string;
	readonly tabCount: number;
}
