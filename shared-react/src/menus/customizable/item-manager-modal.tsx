import type { App } from "obsidian";
import { memo, useCallback, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";

import { useScoped } from "../../contexts/theme-context";
import { useScopedStyles } from "../../hooks/styles/use-styles";
import { showReactIconPicker } from "../../modals/icon-picker-modal";
import { FilterInput } from "../../primitives/filters/filter-input";
import { showShelledModal } from "../../show-react-modal";
import { ManagerEditForm, type ManagerEditController } from "../../widgets/manager-list/manager-edit-form";
import { ManagerRow } from "../../widgets/manager-list/manager-row";
import { ManagerToolbar } from "../../widgets/manager-list/manager-toolbar";
import type { CustomizableMenuStore } from "./store";
import { buildCustomizableMenuStyles } from "./styles";
import type { CustomizableContextMenuItem } from "./types";

const ROW_PREFIX = "item-manager";
const DEFAULT_EDIT_COLOR = "#ffffff";

interface SectionGroup {
	section: string;
	visible: CustomizableContextMenuItem[];
	hidden: CustomizableContextMenuItem[];
}

function titleCase(s: string): string {
	if (!s) return "Ungrouped";
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function matchesQuery(item: CustomizableContextMenuItem, displayLabel: string, query: string): boolean {
	if (!query) return true;
	const q = query.toLowerCase();
	return (
		displayLabel.toLowerCase().includes(q) || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
	);
}

export interface ItemManagerContentProps {
	app: App;
	store: CustomizableMenuStore;
}

export const ItemManagerContent = memo(function ItemManagerContent({ app, store }: ItemManagerContentProps) {
	const { cls, cssPrefix } = useScopedStyles(ROW_PREFIX, buildCustomizableMenuStyles);

	const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);
	const [query, setQuery] = useState("");
	const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
	const [draggedId, setDraggedId] = useState<string | null>(null);

	const allItems = store.getAllItems();
	const visibleCount = snapshot.visibleItems.length;
	const isSearching = query.length > 0;

	const groups = useMemo<SectionGroup[]>(() => {
		const visibleIds = new Set(snapshot.visibleItems.map((i) => i.id));
		const hiddenItems = allItems.filter((i) => !visibleIds.has(i.id));

		const groupMap = new Map<string, SectionGroup>();
		const out: SectionGroup[] = [];

		const ensure = (section: string): SectionGroup => {
			let group = groupMap.get(section);
			if (!group) {
				group = { section, visible: [], hidden: [] };
				groupMap.set(section, group);
				out.push(group);
			}
			return group;
		};

		for (const item of snapshot.visibleItems) ensure(store.getSection(item)).visible.push(item);
		for (const item of hiddenItems) ensure(store.getSection(item)).hidden.push(item);

		return out;
	}, [snapshot, allItems, store]);

	const filteredFlat = useMemo(() => {
		const visibleIds = new Set(snapshot.visibleItems.map((i) => i.id));
		const ordered = [...snapshot.visibleItems, ...allItems.filter((i) => !visibleIds.has(i.id))];
		return ordered.filter((item) => matchesQuery(item, store.getLabel(item), query));
	}, [snapshot, allItems, store, query]);

	const pickIcon = useCallback(
		(itemId: string, callback: (icon: string) => void) => {
			showReactIconPicker(
				app,
				(icon) => {
					if (icon === null) store.setIcon(itemId, undefined);
					else callback(icon);
				},
				{ allowNoIcon: false }
			);
		},
		[app, store]
	);

	const handleRowDrop = useCallback(
		(targetId: string) => {
			if (!draggedId || draggedId === targetId) return;

			const draggedItem = allItems.find((i) => i.id === draggedId);
			const targetItem = allItems.find((i) => i.id === targetId);
			if (!draggedItem || !targetItem) return;

			const draggedSection = store.getSection(draggedItem);
			const targetSection = store.getSection(targetItem);

			if (draggedSection === targetSection) {
				const currentVisible = snapshot.visibleItems;
				const fromIdx = currentVisible.findIndex((i) => i.id === draggedId);
				const toIdx = currentVisible.findIndex((i) => i.id === targetId);
				if (fromIdx < 0 || toIdx < 0) return;
				const dir = fromIdx < toIdx ? 1 : -1;
				const steps = Math.abs(toIdx - fromIdx);
				for (let i = 0; i < steps; i++) store.moveItem(draggedId, dir);
			} else {
				store.moveItemToSection(draggedId, targetSection, targetId);
			}
		},
		[draggedId, allItems, store, snapshot]
	);

	const handleSectionDrop = useCallback(
		(targetSection: string) => {
			if (!draggedId) return;
			const draggedItem = allItems.find((i) => i.id === draggedId);
			if (!draggedItem) return;
			if (store.getSection(draggedItem) === targetSection) return;
			store.moveItemToSection(draggedId, targetSection);
		},
		[draggedId, allItems, store]
	);

	return (
		<div className={cls("modal")} data-testid={`${cssPrefix}${ROW_PREFIX}-modal`}>
			<div className={`${cssPrefix}modal-search`}>
				<FilterInput
					value={query}
					onChange={setQuery}
					placeholder="Search items..."
					className={`${cssPrefix}modal-search-input`}
				/>
			</div>

			{!isSearching && (
				<ManagerToolbar
					app={app}
					cssPrefix={cssPrefix}
					rowPrefix={ROW_PREFIX}
					toggleControl={
						<input
							type="checkbox"
							checked={snapshot.showSettingsButton}
							onChange={(e) => store.setShowSettingsButton(e.target.checked)}
							aria-label="Show settings button"
						/>
					}
					onReset={() => store.resetToDefaults()}
					confirmMessage="This restores the default menu items, order, sections, labels, icons, and colors. Custom changes will be lost."
				/>
			)}

			<div className={cls("list")}>
				{isSearching ? (
					<>
						{filteredFlat.map((item) => (
							<MenuItemRow
								key={item.id}
								item={item}
								isVisible={snapshot.visibleItems.some((v) => v.id === item.id)}
								visibleCount={visibleCount}
								expandedItemId={expandedItemId}
								setExpandedItemId={setExpandedItemId}
								store={store}
								pickIcon={pickIcon}
								draggable={false}
							/>
						))}
						{filteredFlat.length === 0 && <div className={cls("search-empty")}>No matching items</div>}
					</>
				) : (
					groups.map((group) => (
						<SectionBlock
							key={group.section}
							group={group}
							visibleCount={visibleCount}
							expandedItemId={expandedItemId}
							setExpandedItemId={setExpandedItemId}
							store={store}
							pickIcon={pickIcon}
							onRowDragStart={setDraggedId}
							onRowDragEnd={() => setDraggedId(null)}
							onRowDrop={handleRowDrop}
							onSectionDrop={handleSectionDrop}
						/>
					))
				)}
			</div>
		</div>
	);
});

interface SectionBlockProps {
	group: SectionGroup;
	visibleCount: number;
	expandedItemId: string | null;
	setExpandedItemId: (id: string | null) => void;
	store: CustomizableMenuStore;
	pickIcon: (itemId: string, cb: (icon: string) => void) => void;
	onRowDragStart: (id: string) => void;
	onRowDragEnd: () => void;
	onRowDrop: (targetId: string) => void;
	onSectionDrop: (section: string) => void;
}

function SectionBlock({
	group,
	visibleCount,
	expandedItemId,
	setExpandedItemId,
	store,
	pickIcon,
	onRowDragStart,
	onRowDragEnd,
	onRowDrop,
	onSectionDrop,
}: SectionBlockProps) {
	const { cls } = useScoped(ROW_PREFIX);

	const handleDragOver = useCallback((e: React.DragEvent) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	}, []);

	const handleDrop = useCallback(
		(e: React.DragEvent) => {
			if ((e.target as HTMLElement).closest("[data-row-id]")) return;
			e.preventDefault();
			onSectionDrop(group.section);
		},
		[group.section, onSectionDrop]
	);

	return (
		<div className={cls("section")} data-section={group.section} onDragOver={handleDragOver} onDrop={handleDrop}>
			<div className={cls("section-header")}>{titleCase(group.section)}</div>
			{group.visible.map((item, i) => (
				<MenuItemRow
					key={item.id}
					item={item}
					isVisible
					posInSection={i}
					sectionLength={group.visible.length}
					visibleCount={visibleCount}
					expandedItemId={expandedItemId}
					setExpandedItemId={setExpandedItemId}
					store={store}
					pickIcon={pickIcon}
					onRowDragStart={onRowDragStart}
					onRowDragEnd={onRowDragEnd}
					onRowDrop={onRowDrop}
				/>
			))}
			{group.hidden.map((item) => (
				<MenuItemRow
					key={item.id}
					item={item}
					isVisible={false}
					visibleCount={visibleCount}
					expandedItemId={expandedItemId}
					setExpandedItemId={setExpandedItemId}
					store={store}
					pickIcon={pickIcon}
					draggable={false}
				/>
			))}
		</div>
	);
}

interface MenuItemRowProps {
	item: CustomizableContextMenuItem;
	isVisible: boolean;
	posInSection?: number;
	sectionLength?: number;
	visibleCount: number;
	expandedItemId: string | null;
	setExpandedItemId: (id: string | null) => void;
	store: CustomizableMenuStore;
	pickIcon: (itemId: string, cb: (icon: string) => void) => void;
	draggable?: boolean;
	onRowDragStart?: (id: string) => void;
	onRowDragEnd?: () => void;
	onRowDrop?: (targetId: string) => void;
}

function MenuItemRow({
	item,
	isVisible,
	posInSection = 0,
	sectionLength = 1,
	visibleCount,
	expandedItemId,
	setExpandedItemId,
	store,
	pickIcon,
	draggable = true,
	onRowDragStart,
	onRowDragEnd,
	onRowDrop,
}: MenuItemRowProps) {
	const isExpanded = expandedItemId === item.id;
	const displayLabel = store.getLabel(item);
	const displayIcon = store.getIcon(item);
	const displayColor = store.getColor(item);
	const isDraggable = draggable && isVisible;
	const hasRename = displayLabel !== item.label;
	const hasIcon = displayIcon !== item.icon;
	const hasColor = displayColor !== item.color;

	const editForm: ReactNode = isExpanded ? (
		<ManagerEditForm
			controller={
				{
					item: {
						id: item.id,
						label: item.label,
						icon: item.icon ?? "",
						...(item.color !== undefined ? { color: item.color } : {}),
					},
					values: {
						label: displayLabel,
						icon: displayIcon ?? "",
						color: displayColor ?? DEFAULT_EDIT_COLOR,
					},
					overrides: { label: hasRename, icon: hasIcon, color: hasColor },
					actions: {
						rename: (label) => store.setRename(item.id, label),
						changeIcon: (icon) => store.setIcon(item.id, icon),
						changeColor: (color) => store.setColor(item.id, color),
						pickIcon: (cb: (icon: string | null) => void) => pickIcon(item.id, (icon) => cb(icon)),
					},
				} satisfies ManagerEditController
			}
			formPrefix={ROW_PREFIX}
		/>
	) : null;

	const effectiveColor = displayColor && displayColor !== "#000000" ? displayColor : undefined;

	return (
		<ManagerRow
			item={{
				id: item.id,
				label: item.label,
				icon: displayIcon ?? "",
				...(item.color !== undefined ? { color: item.color } : {}),
			}}
			rowPrefix={ROW_PREFIX}
			displayLabel={displayLabel}
			displayIcon={displayIcon ?? ""}
			{...(effectiveColor !== undefined ? { displayColor: effectiveColor } : {})}
			hasRename={hasRename}
			isVisible={isVisible}
			isExpanded={isExpanded}
			visibleCount={visibleCount}
			draggable={isDraggable}
			{...(isDraggable && posInSection > 0 ? { onMoveUp: () => store.moveItem(item.id, -1) } : {})}
			{...(isDraggable && posInSection < sectionLength - 1 ? { onMoveDown: () => store.moveItem(item.id, 1) } : {})}
			{...(onRowDragStart ? { onDragStart: () => onRowDragStart(item.id) } : {})}
			{...(onRowDragEnd ? { onDragEnd: onRowDragEnd } : {})}
			{...(onRowDrop ? { onDrop: () => onRowDrop(item.id) } : {})}
			onEdit={() => setExpandedItemId(isExpanded ? null : item.id)}
			onToggleVisibility={() => (isVisible ? store.hideItem(item.id) : store.restoreItem(item.id))}
		>
			{editForm}
		</ManagerRow>
	);
}

export interface OpenItemManagerOptions {
	app: App;
	store: CustomizableMenuStore;
	cssPrefix: string;
}

export function openItemManagerModal({ app, store, cssPrefix }: OpenItemManagerOptions): void {
	showShelledModal(app, {
		cssPrefix,
		name: "item-manager",
		title: "Manage Context Menu Items",
		render: () => <ItemManagerContent app={app} store={store} />,
	});
}
