import type { ReactNode } from "react";
import { memo, useCallback, useState } from "react";
import { createPortal } from "react-dom";

import { ManagerEditForm } from "../../components/manager-edit-form";
import { ObsidianIcon } from "../../components/obsidian-icon";
import { Toggle } from "../../components/setting-controls";
import { SettingItem } from "../../components/setting-item";
import { useApp } from "../../contexts/app-context";
import { showReactIconPicker } from "../../modals/icon-picker-modal";
import { cx } from "../../utils/cx";
import type { GroupTabDefinition, TabDefinition, TabEntry } from "./types";
import { isGroupTab } from "./types";
import { useModalPortal } from "./use-modal-portal";
import type { TabbedContainerActions, TabbedContainerStateAccess } from "./use-tabbed-container";

const ROW_PREFIX = "tab-manager";

interface DragState {
	id: string | null;
	scope: "tab" | string;
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
	return createPortal(<TabManagerContent cssPrefix={cssPrefix} state={state} actions={actions} />, contentEl);
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

	const visibleIds = new Set(state.visibleTabs.map((t) => t.id));
	const orderedTabs = [...state.visibleTabs, ...state.allTabs.filter((t) => !visibleIds.has(t.id))];

	const handleTabDrop = useCallback(
		(targetId: string) => {
			if (!drag.id || drag.scope !== "tab" || drag.id === targetId) return;
			actions.reorderTabs(drag.id, targetId);
		},
		[drag, actions]
	);

	const handleChildDrop = useCallback(
		(groupId: string, targetId: string) => {
			if (!drag.id || drag.scope !== groupId || drag.id === targetId) return;
			actions.reorderGroupChildren(groupId, drag.id, targetId);
		},
		[drag, actions]
	);

	return (
		<div data-testid={`${cssPrefix}tab-manager-content`}>
			<SettingItem name="Show settings button">
				<Toggle value={state.showSettingsButton} onChange={actions.setShowSettingsButton} />
			</SettingItem>

			<div className={`${cssPrefix}tab-manager-list`}>
				{orderedTabs.map((tab, idx) => {
					const isVisible = visibleIds.has(tab.id);
					const isExpanded = expandedId === tab.id;
					const isGroupExpanded = isGroupTab(tab) && expandedGroups.has(tab.id);

					return (
						<TabManagerRow
							key={tab.id}
							cssPrefix={cssPrefix}
							state={state}
							actions={actions}
							tab={tab}
							isVisible={isVisible}
							isExpanded={isExpanded}
							isGroupExpanded={isGroupExpanded}
							visibleIndex={idx}
							visibleCount={state.visibleTabs.length}
							onToggleExpand={() => setExpandedId(isExpanded ? null : tab.id)}
							onToggleGroup={() => toggleGroup(tab.id)}
							drag={drag}
							setDrag={setDrag}
							onDrop={handleTabDrop}
							onChildDrop={handleChildDrop}
							childExpandedId={expandedId}
							setChildExpandedId={setExpandedId}
						/>
					);
				})}
			</div>
		</div>
	);
});

interface EditableRowProps {
	cssPrefix: string;
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
	onMove: (direction: -1 | 1) => void;
	onToggleVisibility: () => void;
	onToggleExpand: () => void;
	onDragStart: () => void;
	onDragEnd: () => void;
	onDrop: () => void;
	onRename: (value: string | undefined) => void;
	onIconChange: (value: string | undefined) => void;
	onColorChange: (value: string | undefined) => void;
}

const EditableRow = memo(function EditableRow({
	cssPrefix,
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
	onMove,
	onToggleVisibility,
	onToggleExpand,
	onDragStart,
	onDragEnd,
	onDrop,
	onRename,
	onIconChange,
	onColorChange,
}: EditableRowProps) {
	const app = useApp();
	const cls = (suffix: string) => `${cssPrefix}${ROW_PREFIX}-${suffix}`;
	const hasRename = displayLabel !== originalLabel;
	const canMoveUp = isVisible && visibleIndex > 0;
	const canMoveDown = isVisible && visibleIndex < visibleCount - 1;

	const dragHandlers = isVisible
		? {
				draggable: true,
				onDragStart: (e: React.DragEvent) => {
					onDragStart();
					e.dataTransfer.effectAllowed = "move";
				},
				onDragEnd,
				onDragOver: (e: React.DragEvent) => {
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
				},
				onDrop: (e: React.DragEvent) => {
					e.preventDefault();
					onDrop();
				},
			}
		: {};

	const pickIcon = useCallback(
		(cb: (icon: string) => void) => {
			showReactIconPicker(app, (picked) => {
				if (picked !== null) cb(picked);
			});
		},
		[app]
	);

	return (
		<div
			className={cx(cls("row"), !isVisible && cls("row-hidden"), isDragging && cls("row-dragging"))}
			{...dragHandlers}
			data-tab-id={id}
			data-testid={cls(`row-${id}`)}
		>
			{leadingSlot}

			<div className={cls("drag")}>
				{isVisible && (
					<span className={cls("grip")}>
						<ObsidianIcon icon="grip-vertical" />
					</span>
				)}
			</div>

			<div className={cls("arrows")}>
				{canMoveUp && (
					<button
						type="button"
						className={cls("drag-btn")}
						onClick={() => onMove(-1)}
						data-testid={cls(`up-${id}`)}
						aria-label="Move up"
					>
						<ObsidianIcon icon="chevron-up" />
					</button>
				)}
				{canMoveDown && (
					<button
						type="button"
						className={cls("drag-btn")}
						onClick={() => onMove(1)}
						data-testid={cls(`down-${id}`)}
						aria-label="Move down"
					>
						<ObsidianIcon icon="chevron-down" />
					</button>
				)}
			</div>

			<div className={cls("label")}>
				{displayIcon && (
					<span className={cls("icon")} style={displayColor ? { color: displayColor } : undefined}>
						<ObsidianIcon icon={displayIcon} />
					</span>
				)}
				<span className={cls("label-text")}>{displayLabel}</span>
				{hasRename && (
					<span className={cls("label-original")} title="Original name">
						{originalLabel}
					</span>
				)}
			</div>

			<div className={cls("controls")}>
				<button
					type="button"
					className={cls("btn")}
					onClick={onToggleExpand}
					title={isExpanded ? "Collapse" : "Edit"}
					data-testid={cls(`edit-${id}`)}
				>
					<ObsidianIcon icon={isExpanded ? "chevron-up" : "pencil"} />
				</button>
				<button
					type="button"
					className={cls("btn")}
					disabled={isVisible && visibleCount <= 1}
					onClick={onToggleVisibility}
					title={isVisible ? "Hide" : "Show"}
					data-testid={cls(`toggle-${id}`)}
				>
					<ObsidianIcon icon={isVisible ? "eye" : "eye-off"} />
				</button>
			</div>

			{isExpanded && (
				<ManagerEditForm
					item={{
						id,
						label: originalLabel,
						icon: displayIcon ?? "",
						...(displayColor !== undefined ? { color: displayColor } : {}),
					}}
					currentLabel={displayLabel}
					currentIcon={displayIcon ?? ""}
					currentColor={displayColor ?? "#ffffff"}
					hasRenameOverride={hasRename}
					hasIconOverride={hasIconOverride}
					hasColorOverride={hasColorOverride}
					onRename={(_id, value) => onRename(value)}
					onIconChange={(_id, value) => onIconChange(value)}
					onColorChange={(_id, value) => onColorChange(value)}
					onPickIcon={pickIcon}
					cssPrefix={cssPrefix}
					formPrefix={ROW_PREFIX}
				/>
			)}
		</div>
	);
});

interface TabManagerRowProps {
	cssPrefix: string;
	state: TabbedContainerStateAccess;
	actions: TabbedContainerActions;
	tab: TabEntry;
	isVisible: boolean;
	isExpanded: boolean;
	isGroupExpanded: boolean;
	visibleIndex: number;
	visibleCount: number;
	onToggleExpand: () => void;
	onToggleGroup: () => void;
	drag: DragState;
	setDrag: (d: DragState) => void;
	onDrop: (targetId: string) => void;
	onChildDrop: (groupId: string, targetId: string) => void;
	childExpandedId: string | null;
	setChildExpandedId: (id: string | null) => void;
}

const TabManagerRow = memo(function TabManagerRow({
	cssPrefix,
	state,
	actions,
	tab,
	isVisible,
	isExpanded,
	isGroupExpanded,
	visibleIndex,
	visibleCount,
	onToggleExpand,
	onToggleGroup,
	drag,
	setDrag,
	onDrop,
	onChildDrop,
	childExpandedId,
	setChildExpandedId,
}: TabManagerRowProps) {
	const isGroup = isGroupTab(tab);

	const leadingSlot = isGroup ? (
		<button
			type="button"
			className={`${cssPrefix}${ROW_PREFIX}-group-toggle`}
			onClick={onToggleGroup}
			aria-label={isGroupExpanded ? "Collapse group" : "Expand group"}
			data-testid={`${cssPrefix}${ROW_PREFIX}-group-toggle-${tab.id}`}
		>
			<ObsidianIcon icon={isGroupExpanded ? "chevron-down" : "chevron-right"} />
		</button>
	) : undefined;

	return (
		<>
			<EditableRow
				cssPrefix={cssPrefix}
				id={tab.id}
				originalLabel={tab.label}
				displayLabel={state.getLabel(tab)}
				displayIcon={state.getIcon(tab)}
				displayColor={state.getColor(tab)}
				hasIconOverride={state.iconOverrides[tab.id] !== undefined}
				hasColorOverride={state.colorOverrides[tab.id] !== undefined}
				isVisible={isVisible}
				visibleIndex={visibleIndex}
				visibleCount={visibleCount}
				isDragging={drag.id === tab.id && drag.scope === "tab"}
				isExpanded={isExpanded}
				leadingSlot={leadingSlot}
				onMove={(d) => actions.moveTab(tab.id, d)}
				onToggleVisibility={() => (isVisible ? actions.hideTab(tab.id) : actions.restoreTab(tab.id))}
				onToggleExpand={onToggleExpand}
				onDragStart={() => setDrag({ id: tab.id, scope: "tab" })}
				onDragEnd={() => setDrag({ id: null, scope: "tab" })}
				onDrop={() => onDrop(tab.id)}
				onRename={(v) => actions.rename(tab.id, v)}
				onIconChange={(v) => actions.setIcon(tab.id, v)}
				onColorChange={(v) => actions.setColor(tab.id, v)}
			/>

			{isGroup && isGroupExpanded && (
				<GroupChildrenList
					cssPrefix={cssPrefix}
					state={state}
					actions={actions}
					group={tab}
					drag={drag}
					setDrag={setDrag}
					onChildDrop={onChildDrop}
					childExpandedId={childExpandedId}
					setChildExpandedId={setChildExpandedId}
				/>
			)}
		</>
	);
});

interface GroupChildrenListProps {
	cssPrefix: string;
	state: TabbedContainerStateAccess;
	actions: TabbedContainerActions;
	group: GroupTabDefinition;
	drag: DragState;
	setDrag: (d: DragState) => void;
	onChildDrop: (groupId: string, targetId: string) => void;
	childExpandedId: string | null;
	setChildExpandedId: (id: string | null) => void;
}

const GroupChildrenList = memo(function GroupChildrenList({
	cssPrefix,
	state,
	actions,
	group,
	drag,
	setDrag,
	onChildDrop,
	childExpandedId,
	setChildExpandedId,
}: GroupChildrenListProps) {
	const gs = state.groupStates.get(group.id);
	if (!gs) return null;
	const visibleChildIds = new Set(gs.visibleChildren.map((c) => c.id));
	const orderedChildren = [...gs.visibleChildren, ...group.children.filter((c) => !visibleChildIds.has(c.id))];

	return (
		<div className={`${cssPrefix}${ROW_PREFIX}-children`}>
			{orderedChildren.map((child, idx) => (
				<GroupChildRow
					key={child.id}
					cssPrefix={cssPrefix}
					state={state}
					actions={actions}
					group={group}
					child={child}
					childIndex={idx}
					childVisible={visibleChildIds.has(child.id)}
					visibleCount={gs.visibleChildren.length}
					drag={drag}
					setDrag={setDrag}
					onChildDrop={onChildDrop}
					expandedKey={`${group.id}:${child.id}`}
					childExpandedId={childExpandedId}
					setChildExpandedId={setChildExpandedId}
				/>
			))}
		</div>
	);
});

interface GroupChildRowProps {
	cssPrefix: string;
	state: TabbedContainerStateAccess;
	actions: TabbedContainerActions;
	group: GroupTabDefinition;
	child: TabDefinition;
	childIndex: number;
	childVisible: boolean;
	visibleCount: number;
	drag: DragState;
	setDrag: (d: DragState) => void;
	onChildDrop: (groupId: string, targetId: string) => void;
	expandedKey: string;
	childExpandedId: string | null;
	setChildExpandedId: (id: string | null) => void;
}

const GroupChildRow = memo(function GroupChildRow({
	cssPrefix,
	state,
	actions,
	group,
	child,
	childIndex,
	childVisible,
	visibleCount,
	drag,
	setDrag,
	onChildDrop,
	expandedKey,
	childExpandedId,
	setChildExpandedId,
}: GroupChildRowProps) {
	const isExpanded = childExpandedId === expandedKey;
	const gs = state.groupStates.get(group.id);

	return (
		<EditableRow
			cssPrefix={cssPrefix}
			id={child.id}
			originalLabel={child.label}
			displayLabel={state.getChildLabel(group.id, child)}
			displayIcon={state.getChildIcon(group.id, child)}
			displayColor={state.getChildColor(group.id, child)}
			hasIconOverride={gs?.childIconOverrides[child.id] !== undefined}
			hasColorOverride={gs?.childColorOverrides[child.id] !== undefined}
			isVisible={childVisible}
			visibleIndex={childIndex}
			visibleCount={visibleCount}
			isDragging={drag.id === child.id && drag.scope === group.id}
			isExpanded={isExpanded}
			onMove={(d) => actions.moveGroupChild(group.id, child.id, d)}
			onToggleVisibility={() =>
				childVisible ? actions.hideGroupChild(group.id, child.id) : actions.restoreGroupChild(group.id, child.id)
			}
			onToggleExpand={() => setChildExpandedId(isExpanded ? null : expandedKey)}
			onDragStart={() => setDrag({ id: child.id, scope: group.id })}
			onDragEnd={() => setDrag({ id: null, scope: group.id })}
			onDrop={() => onChildDrop(group.id, child.id)}
			onRename={(v) => actions.renameChild(group.id, child.id, v)}
			onIconChange={(v) => actions.setChildIcon(group.id, child.id, v)}
			onColorChange={(v) => actions.setChildColor(group.id, child.id, v)}
		/>
	);
});
