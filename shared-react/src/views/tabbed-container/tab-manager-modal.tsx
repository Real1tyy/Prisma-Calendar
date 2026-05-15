import type { Dispatch, ReactNode, SetStateAction } from "react";
import { createContext, memo, useCallback, useContext, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import type { ManagerEditController } from "../../components/manager-edit-form";
import { ManagerEditForm } from "../../components/manager-edit-form";
import { ManagerRow } from "../../components/manager-row";
import { ObsidianIcon } from "../../components/obsidian-icon";
import { Toggle } from "../../components/setting-controls";
import { SettingItem } from "../../components/setting-item";
import { useApp } from "../../contexts/app-context";
import { SharedReactThemeProvider } from "../../contexts/theme-context";
import { showReactIconPicker } from "../../modals/icon-picker-modal";
import type { GroupTabDefinition, TabDefinition, TabEntry } from "./types";
import { isGroupTab } from "./types";
import { useModalPortal } from "./use-modal-portal";
import type { TabbedContainerActions, TabbedContainerStateAccess } from "./use-tabbed-container";

const ROW_PREFIX = "tab-manager";

interface DragState {
	id: string | null;
	scope: "tab" | string;
}

interface TabManagerContextValue {
	cssPrefix: string;
	state: TabbedContainerStateAccess;
	actions: TabbedContainerActions;
	expandedId: string | null;
	setExpandedId: Dispatch<SetStateAction<string | null>>;
	expandedGroups: Set<string>;
	toggleGroup: (id: string) => void;
	drag: DragState;
	setDrag: Dispatch<SetStateAction<DragState>>;
	onTabDrop: (targetId: string) => void;
	onChildDrop: (groupId: string, targetId: string) => void;
}

const TabManagerContext = createContext<TabManagerContextValue | null>(null);

function useTabManagerContext(): TabManagerContextValue {
	const value = useContext(TabManagerContext);
	if (!value) throw new Error("useTabManagerContext must be used inside TabManagerContext.Provider");
	return value;
}

export interface TabManagerModalProps {
	cssPrefix: string;
	open: boolean;
	onClose: () => void;
	state: TabbedContainerStateAccess;
	actions: TabbedContainerActions;
}

export const TabManagerModal = memo(function TabManagerModal({
	cssPrefix,
	open,
	onClose,
	state,
	actions,
}: TabManagerModalProps) {
	const app = useApp();
	const { contentEl } = useModalPortal({
		app,
		open,
		title: "Manage Tabs",
		cls: `${cssPrefix}tab-manager-modal`,
		testId: `${cssPrefix}tab-manager-modal`,
		onClose,
	});

	if (!contentEl) return null;
	return createPortal(
		<SharedReactThemeProvider cssPrefix={cssPrefix} testIdPrefix={cssPrefix}>
			<TabManagerContent cssPrefix={cssPrefix} state={state} actions={actions} />
		</SharedReactThemeProvider>,
		contentEl
	);
});

export interface TabManagerContentProps {
	cssPrefix: string;
	state: TabbedContainerStateAccess;
	actions: TabbedContainerActions;
}

export const TabManagerContent = memo(function TabManagerContent({
	cssPrefix,
	state,
	actions,
}: TabManagerContentProps) {
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
	const [drag, setDrag] = useState<DragState>({ id: null, scope: "tab" });

	const toggleGroup = useCallback((id: string) => {
		setExpandedGroups((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}, []);

	const onTabDrop = useCallback(
		(targetId: string) => {
			if (!drag.id || drag.scope !== "tab" || drag.id === targetId) return;
			actions.reorderTabs(drag.id, targetId);
		},
		[drag, actions]
	);

	const onChildDrop = useCallback(
		(groupId: string, targetId: string) => {
			if (!drag.id || drag.scope !== groupId || drag.id === targetId) return;
			actions.reorderGroupChildren(groupId, drag.id, targetId);
		},
		[drag, actions]
	);

	const contextValue = useMemo<TabManagerContextValue>(
		() => ({
			cssPrefix,
			state,
			actions,
			expandedId,
			setExpandedId,
			expandedGroups,
			toggleGroup,
			drag,
			setDrag,
			onTabDrop,
			onChildDrop,
		}),
		[cssPrefix, state, actions, expandedId, expandedGroups, toggleGroup, drag, onTabDrop, onChildDrop]
	);

	const visibleIds = useMemo(() => new Set(state.visibleTabs.map((t) => t.id)), [state.visibleTabs]);
	const orderedTabs = useMemo(
		() => [...state.visibleTabs, ...state.allTabs.filter((t) => !visibleIds.has(t.id))],
		[state.visibleTabs, state.allTabs, visibleIds]
	);

	return (
		<TabManagerContext value={contextValue}>
			<div data-testid={`${cssPrefix}tab-manager-content`}>
				<SettingItem name="Show settings button">
					<Toggle value={state.showSettingsButton} onChange={actions.setShowSettingsButton} />
				</SettingItem>

				<div className={`${cssPrefix}${ROW_PREFIX}-list`}>
					{orderedTabs.map((tab, index) => (
						<TabManagerRow
							key={tab.id}
							tab={tab}
							index={index}
							isVisible={visibleIds.has(tab.id)}
							visibleCount={state.visibleTabs.length}
						/>
					))}
				</div>
			</div>
		</TabManagerContext>
	);
});

interface EditableRowModel {
	id: string;
	originalLabel: string;
	displayLabel: string;
	displayIcon: string | undefined;
	displayColor: string | undefined;
	hasIconOverride: boolean;
	hasColorOverride: boolean;
	isVisible: boolean;
	visibleIndex: number;
	visibleCount: number;
	isDragging: boolean;
	isExpanded: boolean;
	leadingSlot?: ReactNode;
}

interface EditableRowActions {
	move: (direction: -1 | 1) => void;
	toggleVisibility: () => void;
	toggleExpand: () => void;
	dragStart: () => void;
	dragEnd: () => void;
	drop: () => void;
	rename: (value: string | undefined) => void;
	changeIcon: (value: string | undefined) => void;
	changeColor: (value: string | undefined) => void;
}

interface EditableRowProps {
	row: EditableRowModel;
	actions: EditableRowActions;
}

const EditableRow = memo(function EditableRow({ row, actions }: EditableRowProps) {
	const app = useApp();

	const {
		id,
		originalLabel,
		displayLabel,
		displayIcon,
		displayColor,
		hasIconOverride,
		hasColorOverride,
		isVisible,
		visibleIndex,
		visibleCount,
		isDragging,
		isExpanded,
		leadingSlot,
	} = row;

	const hasRename = displayLabel !== originalLabel;
	const canMoveUp = isVisible && visibleIndex > 0;
	const canMoveDown = isVisible && visibleIndex < visibleCount - 1;

	const pickIcon = useCallback(
		(cb: (icon: string | null) => void) => {
			// Forward the picker's null (user clicked "No icon") through to the
			// caller so it can clear the override — dropping null here was the
			// reason "No icon" silently did nothing.
			showReactIconPicker(app, (picked) => cb(picked));
		},
		[app]
	);

	const editController: ManagerEditController = {
		item: {
			id,
			label: originalLabel,
			icon: displayIcon ?? "",
			...(displayColor !== undefined ? { color: displayColor } : {}),
		},
		values: {
			label: displayLabel,
			icon: displayIcon ?? "",
			color: displayColor ?? "#ffffff",
		},
		overrides: {
			label: hasRename,
			icon: hasIconOverride,
			color: hasColorOverride,
		},
		actions: { rename: actions.rename, changeIcon: actions.changeIcon, changeColor: actions.changeColor, pickIcon },
	};

	const item = {
		id,
		label: originalLabel,
		icon: displayIcon ?? "",
		...(displayColor !== undefined ? { color: displayColor } : {}),
	};

	return (
		<ManagerRow
			item={item}
			chip={leadingSlot}
			rowPrefix={ROW_PREFIX}
			displayLabel={displayLabel}
			displayIcon={displayIcon ?? ""}
			{...(displayColor !== undefined ? { displayColor } : {})}
			hasRename={hasRename}
			isVisible={isVisible}
			isExpanded={isExpanded}
			visibleCount={visibleCount}
			isDragging={isDragging}
			draggable={isVisible}
			{...(canMoveUp ? { onMoveUp: () => actions.move(-1) } : {})}
			{...(canMoveDown ? { onMoveDown: () => actions.move(1) } : {})}
			onDragStart={actions.dragStart}
			onDragEnd={actions.dragEnd}
			onDrop={actions.drop}
			onEdit={actions.toggleExpand}
			onToggleVisibility={actions.toggleVisibility}
		>
			{isExpanded && <ManagerEditForm controller={editController} formPrefix={ROW_PREFIX} />}
		</ManagerRow>
	);
});

interface TabManagerRowProps {
	tab: TabEntry;
	index: number;
	isVisible: boolean;
	visibleCount: number;
}

const TabManagerRow = memo(function TabManagerRow({ tab, index, isVisible, visibleCount }: TabManagerRowProps) {
	const {
		cssPrefix,
		state,
		actions,
		expandedId,
		setExpandedId,
		expandedGroups,
		toggleGroup,
		drag,
		setDrag,
		onTabDrop,
	} = useTabManagerContext();

	const isGroup = isGroupTab(tab);
	const isExpanded = expandedId === tab.id;
	const isGroupExpanded = isGroup && expandedGroups.has(tab.id);

	const leadingSlot = useMemo<ReactNode>(
		() =>
			isGroup ? (
				<button
					type="button"
					className={`${cssPrefix}${ROW_PREFIX}-group-toggle`}
					onClick={() => toggleGroup(tab.id)}
					aria-label={isGroupExpanded ? "Collapse group" : "Expand group"}
					data-testid={`${cssPrefix}${ROW_PREFIX}-group-toggle-${tab.id}`}
				>
					<ObsidianIcon icon={isGroupExpanded ? "chevron-down" : "chevron-right"} />
				</button>
			) : undefined,
		[isGroup, isGroupExpanded, cssPrefix, toggleGroup, tab.id]
	);

	const row = useMemo<EditableRowModel>(
		() => ({
			id: tab.id,
			originalLabel: tab.label,
			displayLabel: state.getLabel(tab),
			displayIcon: state.getIcon(tab),
			displayColor: state.getColor(tab),
			hasIconOverride: tab.id in state.iconOverrides,
			hasColorOverride: tab.id in state.colorOverrides,
			isVisible,
			visibleIndex: index,
			visibleCount,
			isDragging: drag.id === tab.id && drag.scope === "tab",
			isExpanded,
			leadingSlot,
		}),
		[tab, state, isVisible, index, visibleCount, drag, isExpanded, leadingSlot]
	);

	const rowActions = useMemo<EditableRowActions>(
		() => ({
			move: (direction) => actions.moveTab(tab.id, direction),
			toggleVisibility: () => (isVisible ? actions.hideTab(tab.id) : actions.restoreTab(tab.id)),
			toggleExpand: () => setExpandedId(isExpanded ? null : tab.id),
			dragStart: () => setDrag({ id: tab.id, scope: "tab" }),
			dragEnd: () => setDrag({ id: null, scope: "tab" }),
			drop: () => onTabDrop(tab.id),
			rename: (value) => actions.rename(tab.id, value),
			changeIcon: (value) => actions.setIcon(tab.id, value),
			changeColor: (value) => actions.setColor(tab.id, value),
		}),
		[actions, tab.id, isVisible, isExpanded, setExpandedId, setDrag, onTabDrop]
	);

	return (
		<>
			<EditableRow row={row} actions={rowActions} />
			{isGroup && isGroupExpanded && <GroupChildrenList group={tab} />}
		</>
	);
});

interface GroupChildrenListProps {
	group: GroupTabDefinition;
}

const GroupChildrenList = memo(function GroupChildrenList({ group }: GroupChildrenListProps) {
	const { cssPrefix, state } = useTabManagerContext();
	const gs = state.groupStates.get(group.id);
	if (!gs) return null;

	const visibleChildIds = new Set(gs.visibleChildren.map((c) => c.id));
	const orderedChildren = [...gs.visibleChildren, ...group.children.filter((c) => !visibleChildIds.has(c.id))];

	return (
		<div className={`${cssPrefix}${ROW_PREFIX}-children`}>
			{orderedChildren.map((child, idx) => (
				<GroupChildRow
					key={child.id}
					group={group}
					child={child}
					index={idx}
					isVisible={visibleChildIds.has(child.id)}
					visibleCount={gs.visibleChildren.length}
				/>
			))}
		</div>
	);
});

interface GroupChildRowProps {
	group: GroupTabDefinition;
	child: TabDefinition;
	index: number;
	isVisible: boolean;
	visibleCount: number;
}

const GroupChildRow = memo(function GroupChildRow({
	group,
	child,
	index,
	isVisible,
	visibleCount,
}: GroupChildRowProps) {
	const { state, actions, drag, setDrag, expandedId, setExpandedId, onChildDrop } = useTabManagerContext();

	const expandedKey = `${group.id}:${child.id}`;
	const isExpanded = expandedId === expandedKey;
	const gs = state.groupStates.get(group.id);

	const row = useMemo<EditableRowModel>(
		() => ({
			id: child.id,
			originalLabel: child.label,
			displayLabel: state.getChildLabel(group.id, child),
			displayIcon: state.getChildIcon(group.id, child),
			displayColor: state.getChildColor(group.id, child),
			hasIconOverride: gs?.childIconOverrides[child.id] !== undefined,
			hasColorOverride: gs?.childColorOverrides[child.id] !== undefined,
			isVisible,
			visibleIndex: index,
			visibleCount,
			isDragging: drag.id === child.id && drag.scope === group.id,
			isExpanded,
		}),
		[child, group.id, state, gs, isVisible, index, visibleCount, drag, isExpanded]
	);

	const rowActions = useMemo<EditableRowActions>(
		() => ({
			move: (direction) => actions.moveGroupChild(group.id, child.id, direction),
			toggleVisibility: () =>
				isVisible ? actions.hideGroupChild(group.id, child.id) : actions.restoreGroupChild(group.id, child.id),
			toggleExpand: () => setExpandedId(isExpanded ? null : expandedKey),
			dragStart: () => setDrag({ id: child.id, scope: group.id }),
			dragEnd: () => setDrag({ id: null, scope: group.id }),
			drop: () => onChildDrop(group.id, child.id),
			rename: (value) => actions.renameChild(group.id, child.id, value),
			changeIcon: (value) => actions.setChildIcon(group.id, child.id, value),
			changeColor: (value) => actions.setChildColor(group.id, child.id, value),
		}),
		[actions, group.id, child.id, isVisible, isExpanded, expandedKey, setExpandedId, setDrag, onChildDrop]
	);

	return <EditableRow row={row} actions={rowActions} />;
});
