import type { App } from "obsidian";
import type { CSSProperties, DragEvent, ReactNode } from "react";
import { memo, useCallback, useMemo, useState } from "react";

import { type ManagerEditController, ManagerEditForm } from "../components/manager-edit-form";
import { ObsidianIcon } from "../components/obsidian-icon";
import { Toggle } from "../components/setting-controls";
import { SettingItem } from "../components/setting-item";
import { useExternalSnapshot } from "../hooks/use-external-snapshot";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { showReactIconPicker } from "../modals/icon-picker-modal";
import { showReactModal } from "../show-react-modal";
import { cx } from "../utils/cx";
import { DEFAULT_COLOR_SENTINEL, FALLBACK_EDIT_COLOR } from "./constants";
import type { PageHeaderSnapshot, PageHeaderStore } from "./store";
import { buildPageHeaderStyles } from "./styles";
import type { HeaderActionDefinition } from "./types";

const ROW_PREFIX = "action-manager";

interface ActionManagerProps {
	app: App;
	store: PageHeaderStore;
	cssPrefix: string;
}

interface RowModel {
	action: HeaderActionDefinition;
	isVisible: boolean;
	isExpanded: boolean;
	isDragging: boolean;
	isSearching: boolean;
	visibleIndex: number;
	visibleCount: number;
	displayLabel: string;
	displayIcon: string | undefined;
	displayColor: string | undefined;
	hasRenameOverride: boolean;
	hasIconOverride: boolean;
	hasColorOverride: boolean;
}

interface RowActions {
	toggleExpand: () => void;
	toggleVisibility: () => void;
	move: (direction: -1 | 1) => void;
	dragStart: () => void;
	dragEnd: () => void;
	drop: () => void;
	rename: (label: string | undefined) => void;
	changeIcon: (icon: string | undefined) => void;
	changeColor: (color: string | undefined) => void;
	pickIcon: (callback: (icon: string | null) => void) => void;
}

interface ActionRowProps {
	cssPrefix: string;
	model: RowModel;
	actions: RowActions;
}

const ActionRow = memo(function ActionRow({ cssPrefix, model, actions }: ActionRowProps) {
	const [dragOver, setDragOver] = useState(false);
	const {
		action,
		isVisible,
		isExpanded,
		isDragging,
		isSearching,
		visibleIndex,
		visibleCount,
		displayLabel,
		displayIcon,
		displayColor,
		hasRenameOverride,
		hasIconOverride,
		hasColorOverride,
	} = model;

	const cls = (suffix: string) => `${cssPrefix}${ROW_PREFIX}-${suffix}`;
	const draggable = isVisible && !isSearching;
	const canMoveUp = isVisible && visibleIndex > 0;
	const canMoveDown = isVisible && visibleIndex < visibleCount - 1;

	const iconStyle: CSSProperties | undefined =
		displayColor && displayColor !== DEFAULT_COLOR_SENTINEL ? { color: displayColor } : undefined;

	const dragHandlers = draggable
		? {
				onDragStart: (e: DragEvent<HTMLDivElement>) => {
					actions.dragStart();
					e.dataTransfer.effectAllowed = "move";
				},
				onDragEnd: actions.dragEnd,
				onDragOver: (e: DragEvent<HTMLDivElement>) => {
					e.preventDefault();
					e.dataTransfer.dropEffect = "move";
					setDragOver(true);
				},
				onDragLeave: () => setDragOver(false),
				onDrop: (e: DragEvent<HTMLDivElement>) => {
					e.preventDefault();
					setDragOver(false);
					actions.drop();
				},
			}
		: {};

	return (
		<div
			className={cx(
				cls("row"),
				!isVisible && cls("row-hidden"),
				isDragging && cls("row-dragging"),
				dragOver && cls("row-dragover")
			)}
			data-testid={cls(`row-${action.id}`)}
			draggable={draggable}
			{...dragHandlers}
		>
			{!isSearching && (
				<>
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
								data-testid={cls(`up-${action.id}`)}
								onClick={() => actions.move(-1)}
							>
								<ObsidianIcon icon="chevron-up" />
							</button>
						)}
						{canMoveDown && (
							<button
								type="button"
								className={cls("drag-btn")}
								data-testid={cls(`down-${action.id}`)}
								onClick={() => actions.move(1)}
							>
								<ObsidianIcon icon="chevron-down" />
							</button>
						)}
					</div>
				</>
			)}

			<div className={cls("label")}>
				{displayIcon && (
					<span className={cls("icon")} style={iconStyle}>
						<ObsidianIcon icon={displayIcon} />
					</span>
				)}
				<span className={cls("label-text")}>{displayLabel}</span>
				{hasRenameOverride && (
					<span className={cls("label-original")} title="Original name">
						{action.label}
					</span>
				)}
			</div>

			<div className={cls("controls")}>
				<button
					type="button"
					className={cls("btn")}
					title={isExpanded ? "Collapse" : "Edit"}
					data-testid={cls(`edit-${action.id}`)}
					onClick={actions.toggleExpand}
				>
					<ObsidianIcon icon={isExpanded ? "chevron-up" : "pencil"} />
				</button>
				<button
					type="button"
					className={cls("btn")}
					title={isVisible ? "Hide" : "Show"}
					disabled={isVisible && visibleCount <= 1}
					data-testid={cls(`toggle-${action.id}`)}
					onClick={actions.toggleVisibility}
				>
					<ObsidianIcon icon={isVisible ? "eye" : "eye-off"} />
				</button>
			</div>

			{isExpanded && (
				<EditFormSlot
					action={action}
					displayLabel={displayLabel}
					displayIcon={displayIcon ?? action.icon ?? ""}
					displayColor={displayColor ?? FALLBACK_EDIT_COLOR}
					hasRenameOverride={hasRenameOverride}
					hasIconOverride={hasIconOverride}
					hasColorOverride={hasColorOverride}
					actions={actions}
				/>
			)}
		</div>
	);
});

interface EditFormSlotProps {
	action: HeaderActionDefinition;
	displayLabel: string;
	displayIcon: string;
	displayColor: string;
	hasRenameOverride: boolean;
	hasIconOverride: boolean;
	hasColorOverride: boolean;
	actions: Pick<RowActions, "rename" | "changeIcon" | "changeColor" | "pickIcon">;
}

function EditFormSlot({
	action,
	displayLabel,
	displayIcon,
	displayColor,
	hasRenameOverride,
	hasIconOverride,
	hasColorOverride,
	actions,
}: EditFormSlotProps): ReactNode {
	const item = useMemo(() => {
		const base = { id: action.id, label: action.label, icon: action.icon ?? "" };
		return action.color !== undefined ? { ...base, color: action.color } : base;
	}, [action.id, action.label, action.icon, action.color]);

	const controller: ManagerEditController = {
		item,
		values: { label: displayLabel, icon: displayIcon, color: displayColor },
		overrides: { label: hasRenameOverride, icon: hasIconOverride, color: hasColorOverride },
		actions: {
			rename: actions.rename,
			changeIcon: actions.changeIcon,
			changeColor: actions.changeColor,
			pickIcon: actions.pickIcon,
		},
	};

	return <ManagerEditForm controller={controller} formPrefix={ROW_PREFIX} />;
}

function matchesQuery(action: HeaderActionDefinition, snapshot: PageHeaderSnapshot, needle: string): boolean {
	const label = snapshot.renames[action.id] ?? action.label;
	return (
		label.toLowerCase().includes(needle) ||
		action.label.toLowerCase().includes(needle) ||
		action.id.toLowerCase().includes(needle)
	);
}

const ActionManagerContent = memo(function ActionManagerContent({ app, store, cssPrefix }: ActionManagerProps) {
	useInjectedStyles(`${cssPrefix}page-header-styles`, buildPageHeaderStyles(cssPrefix));
	const snapshot = useExternalSnapshot(store);
	const [query, setQuery] = useState("");
	const [expandedId, setExpandedId] = useState<string | null>(null);
	const [draggedId, setDraggedId] = useState<string | null>(null);

	const trimmed = query.trim().toLowerCase();
	const isSearching = trimmed.length > 0;

	const allActions = store.getAllActions();
	const visibleIds = useMemo(() => new Set(snapshot.visibleActions.map((a) => a.id)), [snapshot.visibleActions]);

	const orderedActions = useMemo(() => {
		const hidden = allActions.filter((a) => !visibleIds.has(a.id));
		return [...snapshot.visibleActions, ...hidden];
	}, [snapshot.visibleActions, allActions, visibleIds]);

	const filtered = useMemo(() => {
		if (!isSearching) return orderedActions;
		return orderedActions.filter((a) => matchesQuery(a, snapshot, trimmed));
	}, [orderedActions, snapshot, trimmed, isSearching]);

	const pickIcon = useCallback(
		(callback: (icon: string | null) => void) => {
			showReactIconPicker(app, callback, { allowNoIcon: false });
		},
		[app]
	);

	const visibleCount = snapshot.visibleActions.length;

	return (
		<div className={`${cssPrefix}action-manager-modal`} data-testid={`${cssPrefix}action-manager-modal`}>
			<div className={`${cssPrefix}action-manager-search`}>
				<input
					type="text"
					className={`${cssPrefix}action-manager-search-input`}
					placeholder="Search actions..."
					value={query}
					onChange={(e) => setQuery(e.target.value)}
				/>
			</div>

			{!isSearching && (
				<SettingItem name="Show settings button">
					<Toggle value={snapshot.showSettingsButton} onChange={(value) => store.setShowSettingsButton(value)} />
				</SettingItem>
			)}

			{isSearching && filtered.length === 0 ? (
				<div className={`${cssPrefix}action-manager-empty`}>No matching actions</div>
			) : (
				<div className={`${cssPrefix}action-manager-list`}>
					{filtered.map((action) => {
						const isVisible = visibleIds.has(action.id);
						const visibleIndex = snapshot.visibleActions.findIndex((a) => a.id === action.id);
						const isExpanded = expandedId === action.id;

						const model: RowModel = {
							action,
							isVisible,
							isExpanded,
							isDragging: draggedId === action.id,
							isSearching,
							visibleIndex,
							visibleCount,
							displayLabel: snapshot.renames[action.id] ?? action.label,
							displayIcon: snapshot.iconOverrides[action.id] ?? action.icon,
							displayColor: snapshot.colorOverrides[action.id] ?? action.color,
							hasRenameOverride: action.id in snapshot.renames,
							hasIconOverride: action.id in snapshot.iconOverrides,
							hasColorOverride: action.id in snapshot.colorOverrides,
						};

						const rowActions: RowActions = {
							toggleExpand: () => setExpandedId(isExpanded ? null : action.id),
							toggleVisibility: () => (isVisible ? store.hideAction(action.id) : store.restoreAction(action.id)),
							move: (direction) => store.moveAction(action.id, direction),
							dragStart: () => setDraggedId(action.id),
							dragEnd: () => setDraggedId(null),
							drop: () => {
								if (!draggedId || draggedId === action.id) return;
								store.reorderActions(draggedId, action.id);
							},
							rename: (label) => store.setRename(action.id, label),
							changeIcon: (icon) => store.setIconOverride(action.id, icon),
							changeColor: (color) => store.setColorOverride(action.id, color),
							pickIcon,
						};

						return <ActionRow key={action.id} cssPrefix={cssPrefix} model={model} actions={rowActions} />;
					})}
				</div>
			)}
		</div>
	);
});

export function openPageHeaderActionManager(app: App, store: PageHeaderStore, cssPrefix: string): void {
	showReactModal({
		app,
		title: "Manage Header Actions",
		cls: `${cssPrefix}action-manager-modal`,
		render: () => <ActionManagerContent app={app} store={store} cssPrefix={cssPrefix} />,
	});
}
