import type { App } from "obsidian";
import { memo, useCallback, useMemo, useState } from "react";

import { type ManagerEditController, ManagerEditForm } from "../components/manager-edit-form";
import { ManagerRow } from "../components/manager-row";
import { Toggle } from "../components/setting-controls";
import { SettingItem } from "../components/setting-item";
import { useExternalSnapshot } from "../hooks/use-external-snapshot";
import { useInjectedStyles } from "../hooks/use-injected-styles";
import { showReactIconPicker } from "../modals/icon-picker-modal";
import { showReactModal } from "../show-react-modal";
import { DEFAULT_COLOR_SENTINEL } from "./constants";
import type { PageHeaderSnapshot, PageHeaderStore } from "./store";
import { buildPageHeaderStyles } from "./styles";
import type { HeaderActionDefinition } from "./types";

const ROW_PREFIX = "action-manager";

interface ActionManagerProps {
	app: App;
	store: PageHeaderStore;
	cssPrefix: string;
}

interface ActionRowEditFormProps {
	action: HeaderActionDefinition;
	displayLabel: string;
	displayIcon: string;
	displayColor: string;
	hasRenameOverride: boolean;
	hasIconOverride: boolean;
	hasColorOverride: boolean;
	rename: (label: string | undefined) => void;
	changeIcon: (icon: string | undefined) => void;
	changeColor: (color: string | undefined) => void;
	pickIcon: (callback: (icon: string | null) => void) => void;
}

function ActionRowEditForm({
	action,
	displayLabel,
	displayIcon,
	displayColor,
	hasRenameOverride,
	hasIconOverride,
	hasColorOverride,
	rename,
	changeIcon,
	changeColor,
	pickIcon,
}: ActionRowEditFormProps) {
	const item = useMemo(() => {
		const base = { id: action.id, label: action.label, icon: action.icon ?? "" };
		return action.color !== undefined ? { ...base, color: action.color } : base;
	}, [action.id, action.label, action.icon, action.color]);

	const controller: ManagerEditController = {
		item,
		values: { label: displayLabel, icon: displayIcon, color: displayColor },
		overrides: { label: hasRenameOverride, icon: hasIconOverride, color: hasColorOverride },
		actions: { rename, changeIcon, changeColor, pickIcon },
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
				<div className={`${cssPrefix}${ROW_PREFIX}-list`}>
					{filtered.map((action) => {
						const isVisible = visibleIds.has(action.id);
						const visibleIndex = snapshot.visibleActions.findIndex((a) => a.id === action.id);
						const isExpanded = expandedId === action.id;
						const draggable = isVisible && !isSearching;
						const displayLabel = snapshot.renames[action.id] ?? action.label;
						const displayIcon = snapshot.iconOverrides[action.id] ?? action.icon;
						const displayColor = snapshot.colorOverrides[action.id] ?? action.color;
						const hasRenameOverride = action.id in snapshot.renames;
						const hasIconOverride = action.id in snapshot.iconOverrides;
						const hasColorOverride = action.id in snapshot.colorOverrides;

						const item = {
							id: action.id,
							label: action.label,
							icon: action.icon ?? "",
							...(action.color !== undefined ? { color: action.color } : {}),
						};
						const effectiveColor = displayColor && displayColor !== DEFAULT_COLOR_SENTINEL ? displayColor : undefined;

						return (
							<ManagerRow
								key={action.id}
								item={item}
								rowPrefix={ROW_PREFIX}
								isVisible={isVisible}
								isExpanded={isExpanded}
								visibleCount={visibleCount}
								displayLabel={displayLabel}
								displayIcon={displayIcon}
								{...(effectiveColor !== undefined ? { displayColor: effectiveColor } : {})}
								hasRename={hasRenameOverride}
								draggable={draggable}
								isDragging={draggedId === action.id}
								{...(draggable && visibleIndex > 0 ? { onMoveUp: () => store.moveAction(action.id, -1) } : {})}
								{...(draggable && visibleIndex < visibleCount - 1
									? { onMoveDown: () => store.moveAction(action.id, 1) }
									: {})}
								onDragStart={() => setDraggedId(action.id)}
								onDragEnd={() => setDraggedId(null)}
								onDrop={() => {
									if (!draggedId || draggedId === action.id) return;
									store.reorderActions(draggedId, action.id);
								}}
								onEdit={() => setExpandedId(isExpanded ? null : action.id)}
								onToggleVisibility={() => (isVisible ? store.hideAction(action.id) : store.restoreAction(action.id))}
							>
								{isExpanded && (
									<ActionRowEditForm
										action={action}
										displayLabel={displayLabel}
										displayIcon={displayIcon}
										displayColor={displayColor}
										hasRenameOverride={hasRenameOverride}
										hasIconOverride={hasIconOverride}
										hasColorOverride={hasColorOverride}
										rename={(label) => store.setRename(action.id, label)}
										changeIcon={(icon) => store.setIconOverride(action.id, icon)}
										changeColor={(color) => store.setColorOverride(action.id, color)}
										pickIcon={pickIcon}
									/>
								)}
							</ManagerRow>
						);
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
		cssPrefix,
		testIdPrefix: cssPrefix,
		cls: `${cssPrefix}action-manager-modal`,
		render: () => <ActionManagerContent app={app} store={store} cssPrefix={cssPrefix} />,
	});
}
