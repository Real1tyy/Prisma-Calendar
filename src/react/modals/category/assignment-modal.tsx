import { cls, tid } from "@real1ty-obsidian-plugins";
import { ModalDescription, openReactModal, VirtualList } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { mapEventsToDisplayItems } from "../../../utils/format";

export interface AssignmentItem {
	name: string;
	displayName?: string;
	color: string;
	subtitle?: string;
	rightLabel?: string;
	tooltip?: string;
}

export interface AssignmentModalConfig {
	title: string;
	description: string;
	searchPlaceholder: string;
	createNewLabel: (name: string) => string;
	assignLabel: string;
	removeLabel: string;
	defaultColor: string;
	allowCreateNew?: boolean;
	colorRows?: boolean;
	searchFields?: (item: AssignmentItem) => string;
}

const ITEM_HEIGHT_ESTIMATE = 40;
const LIST_MAX_HEIGHT = 400;
const LIST_PADDING = 16;

interface CheckboxItemProps {
	item: AssignmentItem;
	checked: boolean;
	isNew: boolean;
	colorRows: boolean;
	highlighted: boolean;
	onToggle: (name: string) => void;
}

const CheckboxItem = memo(function CheckboxItem({
	item,
	checked,
	isNew,
	colorRows,
	highlighted,
	onToggle,
}: CheckboxItemProps) {
	const className = cls(
		"category-checkbox-item",
		checked ? "checked" : "",
		isNew ? "category-new-item" : "",
		colorRows ? "colorized-row" : "",
		highlighted ? "highlighted" : ""
	);

	const style = colorRows && item.color ? ({ "--category-color": item.color } as React.CSSProperties) : undefined;

	return (
		<div
			className={className}
			style={style}
			title={item.tooltip}
			onClick={() => onToggle(item.name)}
			data-testid={tid("assign-item")}
			data-assign-name={item.name}
		>
			<input
				type="checkbox"
				className={cls("category-checkbox")}
				checked={checked}
				onChange={() => onToggle(item.name)}
				onClick={(e) => e.stopPropagation()}
			/>
			<label className={cls("category-label")}>
				{!colorRows && (
					<span
						className={cls("category-color-dot")}
						style={{ "--category-color": item.color } as React.CSSProperties}
					/>
				)}
				<span className={cls("category-name")}>{item.displayName ?? item.name}</span>
				{item.subtitle && <span className={cls("category-item-subtitle")}>{item.subtitle}</span>}
				{item.rightLabel && <span className={cls("category-item-right-label")}>{item.rightLabel}</span>}
				{isNew && <span className={cls("category-new-badge")}>NEW</span>}
			</label>
		</div>
	);
});

interface AssignmentFormProps {
	items: AssignmentItem[];
	config: AssignmentModalConfig;
	preSelected: string[];
	onSubmit: (selected: string[]) => void;
	onCancel: () => void;
}

export function AssignmentForm({ items, config, preSelected, onSubmit, onCancel }: AssignmentFormProps) {
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set(preSelected));
	const [newItems, setNewItems] = useState<AssignmentItem[]>([]);
	const [highlightedIndex, setHighlightedIndex] = useState(-1);
	const searchRef = useRef<HTMLInputElement>(null);

	const allowCreateNew = config.allowCreateNew ?? true;
	const colorRows = config.colorRows ?? false;

	const sortedItems = useMemo(() => {
		const sel: AssignmentItem[] = [];
		const unsel: AssignmentItem[] = [];
		for (const item of items) {
			if (preSelected.includes(item.name)) sel.push(item);
			else unsel.push(item);
		}
		sel.sort((a, b) => a.name.localeCompare(b.name));
		unsel.sort((a, b) => a.name.localeCompare(b.name));
		return [...sel, ...unsel];
	}, [items, preSelected]);

	const allItems = useMemo(() => [...newItems, ...sortedItems], [newItems, sortedItems]);

	const getSearchableText = useCallback(
		(item: AssignmentItem) => (config.searchFields ? config.searchFields(item).toLowerCase() : item.name.toLowerCase()),
		[config]
	);

	const filteredItems = useMemo(() => {
		const lower = search.toLowerCase().trim();
		if (!lower) return allItems;
		return allItems.filter((item) => getSearchableText(item).includes(lower));
	}, [allItems, search, getSearchableText]);

	const showCreateNew = useMemo(() => {
		if (!allowCreateNew || !search.trim()) return false;
		return !allItems.some((item) => item.name.toLowerCase() === search.trim().toLowerCase());
	}, [allowCreateNew, search, allItems]);

	const handleToggle = useCallback((name: string) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(name)) next.delete(name);
			else next.add(name);
			return next;
		});
	}, []);

	const handleCreateNew = useCallback(() => {
		const name = search.trim();
		if (!name) return;
		const existing = newItems.find((i) => i.name === name);
		if (!existing) {
			setNewItems((prev) => [...prev, { name, color: config.defaultColor }]);
		}
		setSelected((prev) => new Set(prev).add(name));
		setSearch("");
	}, [search, newItems, config.defaultColor]);

	const handleSubmit = useCallback(() => {
		onSubmit(Array.from(selected));
	}, [selected, onSubmit]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setHighlightedIndex((prev) => (prev + 1 >= filteredItems.length ? 0 : prev + 1));
			} else if (e.key === "ArrowUp") {
				e.preventDefault();
				setHighlightedIndex((prev) => (prev <= 0 ? filteredItems.length - 1 : prev - 1));
			} else if (e.key === "Enter") {
				e.preventDefault();
				if (highlightedIndex >= 0 && highlightedIndex < filteredItems.length) {
					handleToggle(filteredItems[highlightedIndex].name);
				} else if (search.trim()) {
					const firstItem = filteredItems[0];
					if (firstItem) {
						handleToggle(firstItem.name);
						setSearch("");
					}
				} else {
					handleSubmit();
				}
			}
		},
		[filteredItems, highlightedIndex, search, handleToggle, handleSubmit]
	);

	const listHeight = useMemo(
		() => Math.min(LIST_MAX_HEIGHT, filteredItems.length * ITEM_HEIGHT_ESTIMATE + LIST_PADDING),
		[filteredItems.length]
	);

	const buttonText = selected.size === 0 ? config.removeLabel : config.assignLabel;

	return (
		<div data-testid={tid("assignment-form")} onKeyDown={handleKeyDown}>
			<h2>{config.title}</h2>
			<ModalDescription>{config.description}</ModalDescription>

			<div className={cls("category-search-container")}>
				<input
					ref={searchRef}
					type="text"
					placeholder={config.searchPlaceholder}
					className={cls("category-search-input")}
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setHighlightedIndex(-1);
					}}
					autoFocus
					data-testid={tid("assign-search")}
				/>
			</div>

			{showCreateNew && (
				<div className={cls("category-create-new-container")}>
					<button
						type="button"
						className={cls("category-create-new-button")}
						onClick={handleCreateNew}
						data-testid={tid("assign-create-new")}
					>
						{config.createNewLabel(search.trim())}
					</button>
				</div>
			)}

			{allItems.length === 0 ? (
				<div className={cls("category-list-container")}>
					<div className={cls("category-empty-state")}>No items found. Type to create a new one.</div>
				</div>
			) : (
				<VirtualList
					items={filteredItems}
					estimateSize={ITEM_HEIGHT_ESTIMATE}
					getKey={(item) => item.name}
					className={cls("category-list-container")}
					style={{ height: listHeight }}
					renderItem={(item, i) => (
						<CheckboxItem
							item={item}
							checked={selected.has(item.name)}
							isNew={newItems.some((n) => n.name === item.name)}
							colorRows={colorRows}
							highlighted={i === highlightedIndex}
							onToggle={handleToggle}
						/>
					)}
				/>
			)}

			<div className="modal-button-container">
				<button type="button" onClick={onCancel} data-testid={tid("form-cancel")}>
					Cancel
				</button>
				<button type="button" className="mod-cta" onClick={handleSubmit} data-testid={tid("assign-submit")}>
					{buttonText}
				</button>
			</div>
		</div>
	);
}

export function openAssignmentModal(
	app: App,
	items: AssignmentItem[],
	config: AssignmentModalConfig,
	preSelected: string[]
): Promise<string[] | null> {
	return openReactModal<string[]>({
		app,
		cls: cls("assignment-modal"),
		testId: tid("modal-assignment"),
		render: (submit, cancel) => (
			<AssignmentForm items={items} config={config} preSelected={preSelected} onSubmit={submit} onCancel={cancel} />
		),
	});
}

export function openCategoryAssignModal(
	app: App,
	categories: { name: string; color: string }[],
	defaultColor: string,
	preSelected: string[]
): Promise<string[] | null> {
	const items: AssignmentItem[] = categories.map((c) => ({ name: c.name, color: c.color }));
	return openAssignmentModal(
		app,
		items,
		{
			title: "Assign categories",
			description: "Select categories to assign to all selected events. This will replace any existing categories.",
			searchPlaceholder: "Search or create new category...",
			createNewLabel: (n) => `Create new category: "${n}"`,
			assignLabel: "Assign categories",
			removeLabel: "Remove categories",
			defaultColor,
		},
		preSelected
	);
}

export function openPrerequisiteAssignModal(
	app: App,
	bundle: CalendarBundle,
	preSelected: string[]
): Promise<string[] | null> {
	const allEvents = bundle.eventStore.getAllEvents();
	const defaultColor = bundle.settingsStore.currentSettings.defaultNodeColor;
	const items = mapEventsToDisplayItems(allEvents, defaultColor);

	return openAssignmentModal(
		app,
		items,
		{
			title: "Assign prerequisites",
			description: "Select events that must complete before this event.",
			searchPlaceholder: "Search events...",
			createNewLabel: (n) => `Add: "${n}"`,
			assignLabel: "Assign prerequisites",
			removeLabel: "Remove prerequisites",
			defaultColor,
			allowCreateNew: false,
			colorRows: true,
			searchFields: (item) => `${item.displayName ?? ""} ${item.rightLabel ?? ""}`,
		},
		preSelected
	);
}
