import { useCallback, useMemo, useRef, useState } from "react";

import { setOrDelete } from "../../utils/string-record";
import {
	buildState,
	type BuildStateInput,
	getActiveChild,
	type GroupChildState,
	initialGroupChildState,
	moveItem,
	recalcActiveChildIndex,
	reorderList,
	resolveVisibleTabs,
} from "./reorder";
import type { TabbedContainerState, TabDefinition, TabEntry } from "./types";
import { isGroupTab } from "./types";

export interface UseTabbedContainerOptions {
	tabs: TabEntry[];
	initialState?: TabbedContainerState;
	onStateChange?: (state: TabbedContainerState) => void;
	onTabChange?: (tabId: string, index: number) => void;
}

export interface TabbedContainerStateAccess {
	allTabs: TabEntry[];
	visibleTabs: TabEntry[];
	currentIndex: number;
	activeId: string;
	activeTab: TabDefinition | null;
	renames: Record<string, string>;
	iconOverrides: Record<string, string>;
	colorOverrides: Record<string, string>;
	showSettingsButton: boolean;
	groupStates: Map<string, GroupChildState>;
	rendered: Set<string>;
	getLabel: (entry: TabEntry) => string;
	getIcon: (entry: TabEntry) => string | undefined;
	getColor: (entry: TabEntry) => string | undefined;
	getChildLabel: (groupId: string, child: TabDefinition) => string;
	getChildIcon: (groupId: string, child: TabDefinition) => string | undefined;
	getChildColor: (groupId: string, child: TabDefinition) => string | undefined;
}

export interface TabbedContainerActions {
	switchTo: (indexOrId: number | string) => void;
	next: () => void;
	previous: () => void;
	hideTab: (id: string) => void;
	restoreTab: (id: string) => void;
	moveTab: (id: string, direction: -1 | 1) => void;
	switchGroupChild: (groupId: string, childId: string) => void;
	hideGroupChild: (groupId: string, childId: string) => void;
	restoreGroupChild: (groupId: string, childId: string) => void;
	reorderGroupChildren: (groupId: string, fromId: string, toId: string) => void;
	moveGroupChild: (groupId: string, childId: string, direction: -1 | 1) => void;
	rename: (id: string, value: string | undefined) => void;
	setIcon: (id: string, value: string | undefined) => void;
	setColor: (id: string, value: string | undefined) => void;
	renameChild: (groupId: string, childId: string, value: string | undefined) => void;
	setChildIcon: (groupId: string, childId: string, value: string | undefined) => void;
	setChildColor: (groupId: string, childId: string, value: string | undefined) => void;
	reorderTabs: (fromId: string, toId: string) => void;
	setShowSettingsButton: (value: boolean) => void;
}

export interface UseTabbedContainerResult {
	state: TabbedContainerStateAccess;
	actions: TabbedContainerActions;
	getState: () => TabbedContainerState;
	getVisibleLabels: () => string[];
}

function preserveActiveChild(gs: GroupChildState, visibleChildren: TabDefinition[]): GroupChildState | null {
	if (visibleChildren === gs.visibleChildren) return null;
	const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
	return { ...gs, visibleChildren, activeChildIndex: recalcActiveChildIndex(visibleChildren, activeId) };
}

export function useTabbedContainer({
	tabs,
	initialState,
	onStateChange,
	onTabChange,
}: UseTabbedContainerOptions): UseTabbedContainerResult {
	const initial = useMemo(() => resolveVisibleTabs(tabs, initialState), [tabs, initialState]);

	const [visibleTabs, setVisibleTabs] = useState<TabEntry[]>(initial.visibleTabs);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [renames, setRenames] = useState<Record<string, string>>(initial.renames);
	const [iconOverrides, setIconOverrides] = useState<Record<string, string>>(initial.iconOverrides);
	const [colorOverrides, setColorOverrides] = useState<Record<string, string>>(initial.colorOverrides);
	const [showSettingsButton, setShowSettingsButton] = useState(initial.showSettingsButton);

	const [groupStates, setGroupStates] = useState<Map<string, GroupChildState>>(() => {
		const map = new Map<string, GroupChildState>();
		const saved = initialState?.groupState;
		for (const entry of tabs) {
			if (!isGroupTab(entry)) continue;
			map.set(entry.id, initialGroupChildState(entry, saved?.[entry.id]));
		}
		return map;
	});

	const renderedRef = useRef<Set<string>>(new Set());

	const onStateChangeRef = useRef(onStateChange);
	onStateChangeRef.current = onStateChange;
	const onTabChangeRef = useRef(onTabChange);
	onTabChangeRef.current = onTabChange;

	const allTabs = tabs;

	const getLabel = useCallback((entry: TabEntry): string => renames[entry.id] ?? entry.label, [renames]);
	const getIcon = useCallback(
		(entry: TabEntry): string | undefined => iconOverrides[entry.id] ?? entry.icon,
		[iconOverrides]
	);
	const getColor = useCallback(
		(entry: TabEntry): string | undefined => colorOverrides[entry.id] ?? entry.color,
		[colorOverrides]
	);

	const getChildLabel = useCallback(
		(groupId: string, child: TabDefinition): string => groupStates.get(groupId)?.childRenames[child.id] ?? child.label,
		[groupStates]
	);
	const getChildIcon = useCallback(
		(groupId: string, child: TabDefinition): string | undefined =>
			groupStates.get(groupId)?.childIconOverrides[child.id] ?? child.icon,
		[groupStates]
	);
	const getChildColor = useCallback(
		(groupId: string, child: TabDefinition): string | undefined =>
			groupStates.get(groupId)?.childColorOverrides[child.id] ?? child.color,
		[groupStates]
	);

	type EmitOverrides = Partial<Omit<BuildStateInput, "allTabs">>;
	const emit = useCallback(
		(overrides: EmitOverrides = {}): void => {
			onStateChangeRef.current?.(
				buildState({
					allTabs,
					visibleTabs,
					renames,
					iconOverrides,
					colorOverrides,
					showSettingsButton,
					groupStates,
					...overrides,
				})
			);
		},
		[allTabs, visibleTabs, renames, iconOverrides, colorOverrides, showSettingsButton, groupStates]
	);

	const activeEntry: TabEntry | undefined = visibleTabs[currentIndex];
	const activeTab: TabDefinition | null = useMemo(
		() => (activeEntry ? getActiveChild(activeEntry, groupStates) : null),
		[activeEntry, groupStates]
	);
	const activeId = activeTab?.id ?? "";

	if (activeTab) renderedRef.current.add(activeTab.id);

	const commitVisibleTabs = useCallback(
		(updated: TabEntry[]): void => {
			const activeId = visibleTabs[currentIndex]?.id;
			const idx = updated.findIndex((t) => t.id === activeId);
			setVisibleTabs(updated);
			setCurrentIndex(idx >= 0 ? idx : 0);
			emit({ visibleTabs: updated });
		},
		[visibleTabs, currentIndex, emit]
	);

	const switchToIndex = useCallback(
		(index: number): void => {
			if (index < 0 || index >= visibleTabs.length || index === currentIndex) return;
			setCurrentIndex(index);
			const entry = visibleTabs[index];
			const tab = getActiveChild(entry, groupStates);
			renderedRef.current.add(tab.id);
			onTabChangeRef.current?.(entry.id, index);
			emit();
		},
		[visibleTabs, currentIndex, groupStates, emit]
	);

	const switchTo = useCallback(
		(indexOrId: number | string): void => {
			const index = typeof indexOrId === "number" ? indexOrId : visibleTabs.findIndex((t) => t.id === indexOrId);
			switchToIndex(index);
		},
		[visibleTabs, switchToIndex]
	);

	const next = useCallback((): void => {
		if (visibleTabs.length === 0) return;
		switchToIndex((currentIndex + 1) % visibleTabs.length);
	}, [visibleTabs.length, currentIndex, switchToIndex]);

	const previous = useCallback((): void => {
		if (visibleTabs.length === 0) return;
		switchToIndex((currentIndex - 1 + visibleTabs.length) % visibleTabs.length);
	}, [visibleTabs.length, currentIndex, switchToIndex]);

	const hideTab = useCallback(
		(id: string): void => {
			if (visibleTabs.length <= 1) return;
			const wasActive = visibleTabs[currentIndex]?.id === id;
			const updated = visibleTabs.filter((t) => t.id !== id);
			if (wasActive) {
				setVisibleTabs(updated);
				setCurrentIndex(Math.min(currentIndex, updated.length - 1));
				emit({ visibleTabs: updated });
			} else {
				commitVisibleTabs(updated);
			}
		},
		[visibleTabs, currentIndex, emit, commitVisibleTabs]
	);

	const restoreTab = useCallback(
		(id: string): void => {
			const tab = allTabs.find((t) => t.id === id);
			if (!tab || visibleTabs.find((t) => t.id === id)) return;
			commitVisibleTabs([...visibleTabs, tab]);
		},
		[allTabs, visibleTabs, commitVisibleTabs]
	);

	const moveTab = useCallback(
		(id: string, direction: -1 | 1): void => {
			const updated = moveItem(visibleTabs, id, direction);
			if (updated !== visibleTabs) commitVisibleTabs(updated);
		},
		[visibleTabs, commitVisibleTabs]
	);

	const reorderTabs = useCallback(
		(fromId: string, toId: string): void => {
			const updated = reorderList(visibleTabs, fromId, toId);
			if (updated !== visibleTabs) commitVisibleTabs(updated);
		},
		[visibleTabs, commitVisibleTabs]
	);

	const updateGroupState = useCallback(
		(groupId: string, transform: (gs: GroupChildState) => GroupChildState | null): void => {
			const current = groupStates.get(groupId);
			if (!current) return;
			const next = transform(current);
			if (!next) return;
			const updated = new Map(groupStates);
			updated.set(groupId, next);
			setGroupStates(updated);
			emit({ groupStates: updated });
		},
		[groupStates, emit]
	);

	const switchGroupChild = useCallback(
		(groupId: string, childId: string): void => {
			updateGroupState(groupId, (gs) => {
				const idx = gs.visibleChildren.findIndex((c) => c.id === childId);
				if (idx < 0) return null;
				return { ...gs, activeChildIndex: idx };
			});
			const groupIdx = visibleTabs.findIndex((t) => t.id === groupId);
			if (groupIdx >= 0 && groupIdx !== currentIndex) {
				setCurrentIndex(groupIdx);
				onTabChangeRef.current?.(groupId, groupIdx);
			}
		},
		[updateGroupState, visibleTabs, currentIndex]
	);

	const hideGroupChild = useCallback(
		(groupId: string, childId: string): void => {
			updateGroupState(groupId, (gs) => {
				if (gs.visibleChildren.length <= 1) return null;
				const activeId = gs.visibleChildren[gs.activeChildIndex]?.id;
				const visibleChildren = gs.visibleChildren.filter((c) => c.id !== childId);
				const activeChildIndex =
					activeId === childId
						? Math.min(gs.activeChildIndex, visibleChildren.length - 1)
						: recalcActiveChildIndex(visibleChildren, activeId);
				return { ...gs, visibleChildren, activeChildIndex };
			});
		},
		[updateGroupState]
	);

	const restoreGroupChild = useCallback(
		(groupId: string, childId: string): void => {
			const group = allTabs.find((t) => t.id === groupId);
			if (!group || !isGroupTab(group)) return;
			const child = group.children.find((c) => c.id === childId);
			if (!child) return;
			updateGroupState(groupId, (gs) => {
				if (gs.visibleChildren.find((c) => c.id === childId)) return null;
				return { ...gs, visibleChildren: [...gs.visibleChildren, child] };
			});
		},
		[allTabs, updateGroupState]
	);

	const reorderGroupChildren = useCallback(
		(groupId: string, fromId: string, toId: string): void => {
			updateGroupState(groupId, (gs) => preserveActiveChild(gs, reorderList(gs.visibleChildren, fromId, toId)));
		},
		[updateGroupState]
	);

	const moveGroupChild = useCallback(
		(groupId: string, childId: string, direction: -1 | 1): void => {
			updateGroupState(groupId, (gs) => preserveActiveChild(gs, moveItem(gs.visibleChildren, childId, direction)));
		},
		[updateGroupState]
	);

	const rename = useCallback(
		(id: string, value: string | undefined): void => {
			const updated = setOrDelete(renames, id, value);
			setRenames(updated);
			emit({ renames: updated });
		},
		[renames, emit]
	);

	const setIcon = useCallback(
		(id: string, value: string | undefined): void => {
			const updated = setOrDelete(iconOverrides, id, value);
			setIconOverrides(updated);
			emit({ iconOverrides: updated });
		},
		[iconOverrides, emit]
	);

	const setColor = useCallback(
		(id: string, value: string | undefined): void => {
			const updated = setOrDelete(colorOverrides, id, value);
			setColorOverrides(updated);
			emit({ colorOverrides: updated });
		},
		[colorOverrides, emit]
	);

	const renameChild = useCallback(
		(groupId: string, childId: string, value: string | undefined): void => {
			updateGroupState(groupId, (gs) => ({ ...gs, childRenames: setOrDelete(gs.childRenames, childId, value) }));
		},
		[updateGroupState]
	);

	const setChildIcon = useCallback(
		(groupId: string, childId: string, value: string | undefined): void => {
			updateGroupState(groupId, (gs) => ({
				...gs,
				childIconOverrides: setOrDelete(gs.childIconOverrides, childId, value),
			}));
		},
		[updateGroupState]
	);

	const setChildColor = useCallback(
		(groupId: string, childId: string, value: string | undefined): void => {
			updateGroupState(groupId, (gs) => ({
				...gs,
				childColorOverrides: setOrDelete(gs.childColorOverrides, childId, value),
			}));
		},
		[updateGroupState]
	);

	const setShowSettingsButtonAction = useCallback(
		(value: boolean): void => {
			setShowSettingsButton(value);
			emit({ showSettingsButton: value });
		},
		[emit]
	);

	const getState = useCallback(
		() =>
			buildState({
				allTabs,
				visibleTabs,
				renames,
				iconOverrides,
				colorOverrides,
				showSettingsButton,
				groupStates,
			}),
		[allTabs, visibleTabs, renames, iconOverrides, colorOverrides, showSettingsButton, groupStates]
	);

	const getVisibleLabels = useCallback((): string[] => visibleTabs.map(getLabel), [visibleTabs, getLabel]);

	const state: TabbedContainerStateAccess = {
		allTabs,
		visibleTabs,
		currentIndex,
		activeId,
		activeTab,
		renames,
		iconOverrides,
		colorOverrides,
		showSettingsButton,
		groupStates,
		rendered: renderedRef.current,
		getLabel,
		getIcon,
		getColor,
		getChildLabel,
		getChildIcon,
		getChildColor,
	};

	const actions: TabbedContainerActions = {
		switchTo,
		next,
		previous,
		hideTab,
		restoreTab,
		moveTab,
		switchGroupChild,
		hideGroupChild,
		restoreGroupChild,
		reorderGroupChildren,
		moveGroupChild,
		rename,
		setIcon,
		setColor,
		renameChild,
		setChildIcon,
		setChildColor,
		reorderTabs,
		setShowSettingsButton: setShowSettingsButtonAction,
	};

	return { state, actions, getState, getVisibleLabels };
}
