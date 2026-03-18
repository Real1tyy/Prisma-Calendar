import { addCls, removeCls, showModal, toggleCls } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { createModalButtons } from "../../../utils/dom-utils";

export interface AssignmentItem {
	name: string;
	color: string;
	subtitle?: string;
}

export interface AssignmentModalConfig {
	title: string;
	description: string;
	searchPlaceholder: string;
	createNewLabel: (name: string) => string;
	assignLabel: string;
	removeLabel: string;
	defaultColor: string;
}

interface CheckboxState {
	item: AssignmentItem;
	checked: boolean;
	element: HTMLElement;
	isNew?: boolean;
}

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

	function filterItems(): void {
		const searchTerm = searchInput.value.toLowerCase().trim();
		for (const state of states) {
			if (state.isNew) continue;
			if (state.item.name.toLowerCase().includes(searchTerm)) {
				removeCls(state.element, "hidden");
			} else {
				addCls(state.element, "hidden");
			}
		}
	}

	function updateCreateNewButton(): void {
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
		createButton.onclick = () => createNewItem(searchTerm);
	}

	function createCheckboxItem(item: AssignmentItem, isNew = false): HTMLElement {
		const itemEl = document.createElement("div");
		addCls(itemEl, "category-checkbox-item");
		if (isNew) addCls(itemEl, "category-new-item");

		const isPreSelected = preSelected.includes(item.name);

		const checkbox = itemEl.createEl("input", { type: "checkbox" });
		addCls(checkbox, "category-checkbox");
		if (isPreSelected) {
			checkbox.checked = true;
			addCls(itemEl, "checked");
		}

		const label = itemEl.createEl("label");
		addCls(label, "category-label");

		const colorDot = label.createEl("span");
		addCls(colorDot, "category-color-dot");
		colorDot.style.setProperty("--category-color", item.color);

		const nameSpan = label.createEl("span", { text: item.name });
		addCls(nameSpan, "category-name");

		if (item.subtitle) {
			const subtitleSpan = label.createEl("span", { text: item.subtitle });
			addCls(subtitleSpan, "category-item-subtitle");
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

	el.createEl("h2", { text: config.title });

	const description = el.createEl("p", { text: config.description });
	addCls(description, "setting-item-description");

	const searchContainer = el.createDiv();
	addCls(searchContainer, "category-search-container");
	searchInput = searchContainer.createEl("input", { type: "text", placeholder: config.searchPlaceholder });
	addCls(searchInput, "category-search-input");

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
		for (const item of sortItemsWithSelectedFirst()) {
			listContainer.appendChild(createCheckboxItem(item));
		}
	}

	const { submitButton } = createModalButtons(el, {
		submitText: config.removeLabel,
		onSubmit: submitSelection,
		onCancel: close,
	});
	assignButton = submitButton;
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
