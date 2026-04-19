import { addCls, removeCls, showModal, toDisplayLink, toggleCls } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CalendarBundle } from "../../../core/calendar-bundle";
import { isTimedEvent } from "../../../types/calendar";
import { createModalButtons } from "../../../utils/dom-utils";
import { cleanupTitle } from "../../../utils/events/naming";

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
	pageSize?: number;
	allowCreateNew?: boolean;
	colorRows?: boolean;
	searchFields?: (item: AssignmentItem) => string;
}

interface CheckboxState {
	item: AssignmentItem;
	checked: boolean;
	element: HTMLElement;
	isNew?: boolean;
}

const DEFAULT_PAGE_SIZE = 50;

function renderAssignmentList(
	el: HTMLElement,
	allItems: AssignmentItem[],
	config: AssignmentModalConfig,
	preSelected: string[],
	onSubmit: (selected: string[]) => void,
	close: () => void,
	registerKeyboard?: (handlers: { onArrowDown: () => void; onArrowUp: () => void; onEnter: () => void }) => void
): void {
	const states: CheckboxState[] = [];
	let highlightedIndex = -1;
	// eslint-disable-next-line prefer-const
	let assignButton: HTMLButtonElement;
	// eslint-disable-next-line prefer-const
	let searchInput: HTMLInputElement;
	// eslint-disable-next-line prefer-const
	let listContainer: HTMLElement;
	// eslint-disable-next-line prefer-const
	let createNewContainer: HTMLElement;

	const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE;
	const allowCreateNew = config.allowCreateNew ?? true;
	const colorRows = config.colorRows ?? false;
	const renderedIndices = new Set<number>();
	let sortedItems: AssignmentItem[] = [];
	let loadMoreButton: HTMLElement | null = null;

	function getVisibleItems(): HTMLElement[] {
		return states.filter((s) => !s.element.classList.contains("prisma-hidden")).map((s) => s.element);
	}

	function moveHighlight(direction: number): void {
		const visibleItems = getVisibleItems();
		if (visibleItems.length === 0) return;

		if (highlightedIndex >= 0 && highlightedIndex < visibleItems.length) {
			removeCls(visibleItems[highlightedIndex], "highlighted");
		}

		if (highlightedIndex === -1) {
			highlightedIndex = direction === 1 ? 0 : visibleItems.length - 1;
		} else {
			highlightedIndex += direction;
			if (highlightedIndex < 0) highlightedIndex = visibleItems.length - 1;
			if (highlightedIndex >= visibleItems.length) highlightedIndex = 0;
		}

		addCls(visibleItems[highlightedIndex], "highlighted");
		visibleItems[highlightedIndex].scrollIntoView({ block: "nearest" });
	}

	function clearHighlight(): void {
		if (highlightedIndex >= 0) {
			const visibleItems = getVisibleItems();
			if (highlightedIndex < visibleItems.length) {
				removeCls(visibleItems[highlightedIndex], "highlighted");
			}
		}
		highlightedIndex = -1;
	}

	function updateCheckboxState(itemEl: HTMLElement, checked: boolean): void {
		const state = states.find((s) => s.element === itemEl);
		if (state) state.checked = checked;
		toggleCls(itemEl, "checked", checked);
		updateAssignButtonText();
	}

	function updateAssignButtonText(): void {
		if (!assignButton) return;
		const selectedCount = states.filter((state) => state.checked).length;
		assignButton.textContent = selectedCount === 0 ? config.removeLabel : config.assignLabel;
	}

	function getSearchableText(item: AssignmentItem): string {
		if (config.searchFields) return config.searchFields(item).toLowerCase();
		return item.name.toLowerCase();
	}

	function filterItems(): void {
		const searchTerm = searchInput.value.toLowerCase().trim();

		if (searchTerm) {
			renderMatchingItems(searchTerm);
		} else {
			// When search cleared, go back to paged view
			restorePagedView();
		}
	}

	function renderMatchingItems(searchTerm: string): void {
		let visibleCount = 0;
		for (const state of states) {
			if (state.isNew) continue;
			const matches = getSearchableText(state.item).includes(searchTerm);
			toggleCls(state.element, "hidden", !matches);
			if (matches) visibleCount++;
		}

		for (let i = 0; i < sortedItems.length && visibleCount < pageSize; i++) {
			if (renderedIndices.has(i)) continue;
			const item = sortedItems[i]!;
			if (getSearchableText(item).includes(searchTerm)) {
				renderedIndices.add(i);
				const itemEl = createCheckboxItem(item);
				listContainer.appendChild(itemEl);
				visibleCount++;
			}
		}

		updateLoadMoreButton();
	}

	function restorePagedView(): void {
		for (const state of states) {
			if (state.isNew) continue;
			removeCls(state.element, "hidden");
		}
		updateLoadMoreButton();
	}

	function renderNextPage(): void {
		let added = 0;
		for (let i = 0; i < sortedItems.length && added < pageSize; i++) {
			if (renderedIndices.has(i)) continue;
			renderedIndices.add(i);
			const itemEl = createCheckboxItem(sortedItems[i]!);
			listContainer.appendChild(itemEl);
			added++;
		}
		updateLoadMoreButton();
	}

	function updateLoadMoreButton(): void {
		if (!loadMoreButton) return;
		const remaining = sortedItems.length - renderedIndices.size;
		if (remaining > 0 && !searchInput.value.trim()) {
			loadMoreButton.textContent = `Load more (${remaining} remaining)`;
			removeCls(loadMoreButton, "hidden");
		} else {
			addCls(loadMoreButton, "hidden");
		}
	}

	function createCheckboxItem(item: AssignmentItem, isNew = false): HTMLElement {
		const itemEl = document.createElement("div");
		addCls(itemEl, "category-checkbox-item");
		itemEl.setAttribute("data-testid", "prisma-assign-item");
		itemEl.setAttribute("data-assign-name", item.name);
		if (isNew) addCls(itemEl, "category-new-item");

		if (colorRows && item.color) {
			itemEl.style.setProperty("--category-color", item.color);
			addCls(itemEl, "colorized-row");
		}

		const isPreSelected = preSelected.includes(item.name);

		const checkbox = itemEl.createEl("input", { type: "checkbox" });
		addCls(checkbox, "category-checkbox");
		if (isPreSelected) {
			checkbox.checked = true;
			addCls(itemEl, "checked");
		}

		const label = itemEl.createEl("label");
		addCls(label, "category-label");

		if (!colorRows) {
			const colorDot = label.createEl("span");
			addCls(colorDot, "category-color-dot");
			colorDot.style.setProperty("--category-color", item.color);
		}

		const nameSpan = label.createEl("span", { text: item.displayName ?? item.name });
		addCls(nameSpan, "category-name");
		if (item.tooltip) {
			itemEl.title = item.tooltip;
		}

		if (item.subtitle) {
			const subtitleSpan = label.createEl("span", { text: item.subtitle });
			addCls(subtitleSpan, "category-item-subtitle");
		}

		if (item.rightLabel) {
			const rightSpan = label.createEl("span", { text: item.rightLabel });
			addCls(rightSpan, "category-item-right-label");
		}

		if (isNew) {
			const newBadge = label.createEl("span", { text: "NEW" });
			addCls(newBadge, "category-new-badge");
		}

		itemEl.addEventListener("click", (e) => {
			if (e.target === checkbox) return;
			e.preventDefault();
			checkbox.checked = !checkbox.checked;
			updateCheckboxState(itemEl, checkbox.checked);
		});

		checkbox.addEventListener("change", () => updateCheckboxState(itemEl, checkbox.checked));

		states.push({ item, checked: isPreSelected, element: itemEl, isNew });
		return itemEl;
	}

	function createNewItem(name: string): void {
		const existingNew = states.find((state) => state.isNew && state.item.name === name);

		if (existingNew) {
			existingNew.checked = true;
			const checkbox = existingNew.element.querySelector("input") as HTMLInputElement;
			if (checkbox) checkbox.checked = true;
			updateCheckboxState(existingNew.element, true);
			searchInput.value = "";
			filterItems();
			updateCreateNewButton();
			return;
		}

		const newItem: AssignmentItem = { name, color: config.defaultColor };
		const itemEl = createCheckboxItem(newItem, true);
		listContainer.insertBefore(itemEl, listContainer.firstChild);

		const newState = states.find((s) => s.element === itemEl);
		if (newState) {
			newState.checked = true;
			const checkbox = itemEl.querySelector("input") as HTMLInputElement;
			if (checkbox) checkbox.checked = true;
			updateCheckboxState(itemEl, true);
		}

		searchInput.value = "";
		filterItems();
		updateCreateNewButton();
	}

	function submitSelection(): void {
		const selected = states.filter((state) => state.checked).map((state) => state.item.name);
		onSubmit(selected);
		close();
	}

	function sortItemsWithSelectedFirst(): AssignmentItem[] {
		const selected: AssignmentItem[] = [];
		const unselected: AssignmentItem[] = [];
		for (const item of allItems) {
			if (preSelected.includes(item.name)) {
				selected.push(item);
			} else {
				unselected.push(item);
			}
		}
		selected.sort((a, b) => a.name.localeCompare(b.name));
		unselected.sort((a, b) => a.name.localeCompare(b.name));
		return [...selected, ...unselected];
	}

	function updateCreateNewButton(): void {
		if (!allowCreateNew) {
			addCls(createNewContainer, "hidden");
			return;
		}

		const searchTerm = searchInput.value.trim();
		if (!searchTerm) {
			addCls(createNewContainer, "hidden");
			return;
		}

		const exactMatch = allItems.some((item) => item.name.toLowerCase() === searchTerm.toLowerCase());
		if (exactMatch) {
			addCls(createNewContainer, "hidden");
			return;
		}

		removeCls(createNewContainer, "hidden");
		createNewContainer.empty();

		const createButton = createNewContainer.createEl("button", { text: config.createNewLabel(searchTerm) });
		addCls(createButton, "category-create-new-button");
		createButton.setAttribute("data-testid", "prisma-assign-create-new");
		createButton.onclick = () => createNewItem(searchTerm);
	}

	el.createEl("h2", { text: config.title });

	const description = el.createEl("p", { text: config.description });
	addCls(description, "setting-item-description");

	const searchContainer = el.createDiv();
	addCls(searchContainer, "category-search-container");
	searchInput = searchContainer.createEl("input", { type: "text", placeholder: config.searchPlaceholder });
	addCls(searchInput, "category-search-input");
	searchInput.setAttribute("data-testid", "prisma-assign-search");

	searchInput.addEventListener("input", () => {
		clearHighlight();
		filterItems();
		updateCreateNewButton();
	});

	createNewContainer = el.createDiv();
	addCls(createNewContainer, "category-create-new-container", "hidden");

	listContainer = el.createDiv();
	addCls(listContainer, "category-list-container");

	if (allItems.length === 0) {
		const emptyState = listContainer.createDiv();
		addCls(emptyState, "category-empty-state");
		emptyState.textContent = "No items found. Type to create a new one.";
	} else {
		sortedItems = sortItemsWithSelectedFirst();
		renderNextPage();
	}

	loadMoreButton = el.createEl("button", { text: "Load more" });
	addCls(loadMoreButton, "category-load-more-button", "hidden");
	loadMoreButton.addEventListener("click", () => renderNextPage());
	updateLoadMoreButton();

	const { submitButton } = createModalButtons(el, {
		submitText: config.removeLabel,
		onSubmit: submitSelection,
		onCancel: close,
	});
	assignButton = submitButton;
	assignButton.setAttribute("data-testid", "prisma-assign-submit");
	updateAssignButtonText();

	registerKeyboard?.({
		onArrowDown: () => moveHighlight(1),
		onArrowUp: () => moveHighlight(-1),
		onEnter: () => {
			if (highlightedIndex >= 0) {
				const visibleItems = getVisibleItems();
				if (highlightedIndex < visibleItems.length) visibleItems[highlightedIndex].click();
				return;
			}

			const searchValue = searchInput.value.trim();
			if (searchValue) {
				const firstVisibleItem = getVisibleItems()[0];
				if (firstVisibleItem) {
					firstVisibleItem.click();
					searchInput.value = "";
					filterItems();
					updateCreateNewButton();
				}
			} else {
				submitSelection();
			}
		},
	});

	searchInput.focus();
}

export function showAssignmentModal(
	app: App,
	items: AssignmentItem[],
	config: AssignmentModalConfig,
	preSelected: string[],
	onSubmit: (selected: string[]) => void
): void {
	showModal({
		app,
		cls: "prisma-assignment-modal",
		render: (el, ctx) => {
			renderAssignmentList(el, items, config, preSelected, onSubmit, ctx.close, (handlers) => {
				if (ctx.type === "modal") {
					ctx.scope.register([], "ArrowDown", (e) => {
						e.preventDefault();
						handlers.onArrowDown();
					});
					ctx.scope.register([], "ArrowUp", (e) => {
						e.preventDefault();
						handlers.onArrowUp();
					});
					ctx.scope.register([], "Enter", (e) => {
						e.preventDefault();
						handlers.onEnter();
					});
				}
			});
		},
	});
}

export function openCategoryAssignModal(
	app: App,
	categories: { name: string; color: string }[],
	defaultColor: string,
	preSelected: string[],
	onSubmit: (selected: string[]) => void
): void {
	const items: AssignmentItem[] = categories.map((c) => ({ name: c.name, color: c.color }));
	const config: AssignmentModalConfig = {
		title: "Assign categories",
		description: "Select categories to assign to all selected events. This will replace any existing categories.",
		searchPlaceholder: "Search or create new category...",
		createNewLabel: (n) => `Create new category: "${n}"`,
		assignLabel: "Assign categories",
		removeLabel: "Remove categories",
		defaultColor,
	};
	showAssignmentModal(app, items, config, preSelected, onSubmit);
}

export function openPrerequisiteAssignModal(
	app: App,
	bundle: CalendarBundle,
	preSelected: string[],
	onSubmit: (selected: string[]) => void
): void {
	const allEvents = bundle.eventStore.getAllEvents();
	const defaultColor = bundle.settingsStore.currentSettings.defaultNodeColor;

	const items: AssignmentItem[] = allEvents.map((event) => {
		const title = cleanupTitle(event.title);
		const wikiLink = toDisplayLink(event.ref.filePath);
		const color = event.color ?? defaultColor;
		const startDate = new Date(event.start);
		const date = startDate.toLocaleDateString([], { month: "short", day: "numeric" });
		const rightLabel = isTimedEvent(event)
			? `${date} ${startDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}`
			: `${date} · all-day`;

		return { name: wikiLink, displayName: title, color, rightLabel, tooltip: event.ref.filePath };
	});

	showAssignmentModal(
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
			pageSize: 20,
			allowCreateNew: false,
			colorRows: true,
			searchFields: (item) => `${item.displayName ?? ""} ${item.rightLabel ?? ""}`,
		},
		preSelected,
		onSubmit
	);
}
