import type { App } from "obsidian";
import { memo, useCallback, useMemo, useState } from "react";

import { useExternalSnapshot } from "../hooks/reactive/use-external-snapshot";
import { useInjectedStyles } from "../hooks/styles/use-styles";
import { showReactIconPicker } from "../modals/icon-picker-modal";
import { Toggle } from "../primitives/controls";
import { showShelledModal } from "../show-react-modal";
import { ManagerEditForm, type ManagerEditController } from "../widgets/manager-list/manager-edit-form";
import { ManagerRow } from "../widgets/manager-list/manager-row";
import { ManagerToolbar } from "../widgets/manager-list/manager-toolbar";
import type { PageHeaderSnapshot, PageHeaderStore } from "./store";
import { buildPageHeaderStyles } from "./styles";
import type { HeaderActionDefinition } from "./types";

const ROW_PREFIX = "action-manager";

export interface ActionManagerProps {
	app: App;
	store: PageHeaderStore;
	cssPrefix: string;
}

interface ActionRowEditFormProps {
	action: HeaderActionDefinition;
	store: PageHeaderStore;
	pickIcon: (callback: (icon: string | null) => void) => void;
}

function ActionRowEditForm({ action, store, pickIcon }: ActionRowEditFormProps) {
	const controller: ManagerEditController = {
		item: { id: action.id, label: action.label, appearance: action },
		label: store.getLabel(action),
		appearance: store.getAppearance(action),
		overridden: { label: action.id in store.getValue().renames, appearance: store.getOverridden(action.id) },
		actions: {
			rename: (label) => store.setRename(action.id, label),
			setAppearance: (axis, value) => store.setAppearanceOverride(action.id, axis, value),
			pickIcon,
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

export const ActionManagerContent = memo(function ActionManagerContent({ app, store, cssPrefix }: ActionManagerProps) {
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
				<ManagerToolbar
					app={app}
					cssPrefix={cssPrefix}
					rowPrefix={ROW_PREFIX}
					toggleControl={
						<Toggle value={snapshot.showSettingsButton} onChange={(value) => store.setShowSettingsButton(value)} />
					}
					onReset={() => store.resetToDefaults()}
					confirmMessage="This restores the default header actions, order, labels, icons, and colors. Custom changes will be lost."
				/>
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

						return (
							<ManagerRow
								key={action.id}
								item={action}
								appearance={store.getAppearance(action)}
								rowPrefix={ROW_PREFIX}
								isVisible={isVisible}
								isExpanded={isExpanded}
								visibleCount={visibleCount}
								displayLabel={store.getLabel(action)}
								hasRename={action.id in snapshot.renames}
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
								{isExpanded && <ActionRowEditForm action={action} store={store} pickIcon={pickIcon} />}
							</ManagerRow>
						);
					})}
				</div>
			)}
		</div>
	);
});

export function openPageHeaderActionManager(app: App, store: PageHeaderStore, cssPrefix: string): void {
	showShelledModal(app, {
		cssPrefix,
		name: "action-manager",
		title: "Manage Header Actions",
		render: () => <ActionManagerContent app={app} store={store} cssPrefix={cssPrefix} />,
	});
}
