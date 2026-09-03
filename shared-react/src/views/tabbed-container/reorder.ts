import {
	CHILD_APPEARANCE_KEYS,
	loadAppearanceOverrides,
	writeAppearanceOverrides,
	type AppearanceOverrides,
} from "../../utils/appearance";
import { moveItem, reorderList } from "../../utils/list-reorder";
import { loadStringRecord, nonEmptyRecord } from "../../utils/string-record";
import {
	isGroupTab,
	type GroupStatePersisted,
	type GroupTabDefinition,
	type TabbedContainerState,
	type TabDefinition,
	type TabEntry,
} from "./types";

export { moveItem, reorderList };

export interface GroupChildState {
	visibleChildren: TabDefinition[];
	activeChildIndex: number;
	childRenames: Record<string, string>;
	childAppearance: AppearanceOverrides;
}

export function recalcActiveChildIndex(visibleChildren: TabDefinition[], previousActiveId: string | undefined): number {
	const idx = visibleChildren.findIndex((c) => c.id === previousActiveId);
	return idx >= 0 ? idx : 0;
}

export function initialGroupChildState(
	group: GroupTabDefinition,
	saved: GroupStatePersisted | undefined
): GroupChildState {
	let visibleChildren: TabDefinition[];
	if (saved?.visibleChildIds) {
		const childMap = new Map(group.children.map((c) => [c.id, c]));
		visibleChildren = saved.visibleChildIds.map((id) => childMap.get(id)).filter((c): c is TabDefinition => c != null);
		if (visibleChildren.length === 0) visibleChildren = [...group.children];
	} else {
		visibleChildren = [...group.children];
	}

	return {
		visibleChildren,
		activeChildIndex: 0,
		childRenames: loadStringRecord(saved?.childRenames),
		childAppearance: loadAppearanceOverrides(saved, CHILD_APPEARANCE_KEYS),
	};
}

export function getActiveChild(entry: TabEntry, groupStates: Map<string, GroupChildState>): TabDefinition {
	if (!isGroupTab(entry)) return entry;
	const gs = groupStates.get(entry.id);
	if (!gs || gs.visibleChildren.length === 0) return entry.children[0];
	return gs.visibleChildren[gs.activeChildIndex] ?? gs.visibleChildren[0];
}

export interface ResolvedInitialState {
	visibleTabs: TabEntry[];
	renames: Record<string, string>;
	appearance: AppearanceOverrides;
	showSettingsButton: boolean;
}

export function resolveVisibleTabs(
	tabs: TabEntry[],
	initialState: TabbedContainerState | undefined
): ResolvedInitialState {
	const overrides = {
		renames: loadStringRecord(initialState?.renames),
		appearance: loadAppearanceOverrides(initialState),
		showSettingsButton: initialState?.showSettingsButton !== false,
	};

	if (!initialState?.visibleTabIds) {
		return { visibleTabs: tabs, ...overrides };
	}

	const tabMap = new Map(tabs.map((t) => [t.id, t]));
	const visible: TabEntry[] = [];
	for (const id of initialState.visibleTabIds) {
		const tab = tabMap.get(id);
		if (tab) visible.push(tab);
	}

	return { visibleTabs: visible.length > 0 ? visible : tabs, ...overrides };
}

export interface BuildStateInput {
	allTabs: TabEntry[];
	visibleTabs: TabEntry[];
	renames: Record<string, string>;
	appearance: AppearanceOverrides;
	showSettingsButton: boolean;
	groupStates: Map<string, GroupChildState>;
}

export function buildState({
	allTabs,
	visibleTabs,
	renames,
	appearance,
	showSettingsButton,
	groupStates,
}: BuildStateInput): TabbedContainerState {
	const state: TabbedContainerState = {};
	const renamesOut = nonEmptyRecord(renames);
	if (renamesOut) state.renames = renamesOut;
	writeAppearanceOverrides(state, appearance);

	const defaultOrder = allTabs.map((t) => t.id);
	const currentOrder = visibleTabs.map((t) => t.id);
	if (visibleTabs.length !== allTabs.length || currentOrder.some((id, i) => id !== defaultOrder[i])) {
		state.visibleTabIds = currentOrder;
	}

	if (!showSettingsButton) state.showSettingsButton = false;

	const gs: Record<string, GroupStatePersisted> = {};
	let hasGroupState = false;
	for (const [groupId, childState] of groupStates) {
		const group = allTabs.find((t) => t.id === groupId);
		if (!group || !isGroupTab(group)) continue;
		const entry: GroupStatePersisted = {};
		let hasEntry = false;

		const defaultChildOrder = group.children.map((c) => c.id);
		const currentChildOrder = childState.visibleChildren.map((c) => c.id);
		if (
			childState.visibleChildren.length !== group.children.length ||
			currentChildOrder.some((id, i) => id !== defaultChildOrder[i])
		) {
			entry.visibleChildIds = currentChildOrder;
			hasEntry = true;
		}

		const childRenames = nonEmptyRecord(childState.childRenames);
		if (childRenames) {
			entry.childRenames = childRenames;
			hasEntry = true;
		}
		// Deliberately not short-circuiting: the overrides must be written even when
		// a reordered child list already set `hasEntry`.
		hasEntry = writeAppearanceOverrides(entry, childState.childAppearance, CHILD_APPEARANCE_KEYS) || hasEntry;

		if (hasEntry) {
			gs[groupId] = entry;
			hasGroupState = true;
		}
	}
	if (hasGroupState) state.groupState = gs;

	return state;
}
