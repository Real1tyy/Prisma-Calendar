import { addCls, removeCls, toggleCls } from "@real1ty-obsidian-plugins";
import { type App, Modal } from "obsidian";

import { createModalButtons } from "../../utils/dom-utils";

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

export class AssignmentModal extends Modal {
	private searchInput!: HTMLInputElement;
	private listContainer!: HTMLElement;
	private createNewContainer!: HTMLElement;
	private assignButton!: HTMLButtonElement;
	private states: CheckboxState[] = [];
	private highlightedIndex = -1;
	private onSubmit: (selected: string[]) => void;
	private allItems: AssignmentItem[];
	private config: AssignmentModalConfig;
	private preSelected: string[];

	constructor(
		app: App,
		items: AssignmentItem[],
		config: AssignmentModalConfig,
		preSelected: string[],
		onSubmit: (selected: string[]) => void
	) {
		super(app);
		this.allItems = items;
		this.config = config;
		this.preSelected = preSelected;
		this.onSubmit = onSubmit;
	}

	override onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: this.config.title });

		const description = contentEl.createEl("p", {
			text: this.config.description,
		});
		addCls(description, "setting-item-description");

		this.createSearchInput(contentEl);
		this.createList(contentEl);
		this.createButtons(contentEl);
		this.updateAssignButtonText();

		this.setupKeyboardHandlers();

		this.searchInput.focus();
	}

	private createSearchInput(container: HTMLElement): void {
		const searchContainer = container.createDiv();
		addCls(searchContainer, "category-search-container");

		this.searchInput = searchContainer.createEl("input", {
			type: "text",
			placeholder: this.config.searchPlaceholder,
		});
		addCls(this.searchInput, "category-search-input");

		this.searchInput.addEventListener("input", () => {
			this.clearHighlight();
			this.filterItems();
			this.updateCreateNewButton();
		});
	}

	private setupKeyboardHandlers(): void {
		this.scope.register([], "ArrowDown", (e) => {
			e.preventDefault();
			this.moveHighlight(1);
		});

		this.scope.register([], "ArrowUp", (e) => {
			e.preventDefault();
			this.moveHighlight(-1);
		});

		this.scope.register([], "Enter", (e) => {
			e.preventDefault();

			if (this.highlightedIndex >= 0) {
				const visibleItems = this.getVisibleItems();
				if (this.highlightedIndex < visibleItems.length) {
					visibleItems[this.highlightedIndex].click();
				}
				return;
			}

			const searchValue = this.searchInput.value.trim();

			if (searchValue) {
				const firstVisibleItem = this.getVisibleItems()[0];

				if (firstVisibleItem) {
					firstVisibleItem.click();
					this.searchInput.value = "";
					this.filterItems();
					this.updateCreateNewButton();
				}
			} else {
				this.submitSelection();
			}
		});
	}

	private getVisibleItems(): HTMLElement[] {
		return this.states.filter((s) => !s.element.classList.contains("prisma-hidden")).map((s) => s.element);
	}

	private moveHighlight(direction: number): void {
		const visibleItems = this.getVisibleItems();
		if (visibleItems.length === 0) return;

		if (this.highlightedIndex >= 0 && this.highlightedIndex < visibleItems.length) {
			removeCls(visibleItems[this.highlightedIndex], "highlighted");
		}

		if (this.highlightedIndex === -1) {
			this.highlightedIndex = direction === 1 ? 0 : visibleItems.length - 1;
		} else {
			this.highlightedIndex += direction;
			if (this.highlightedIndex < 0) this.highlightedIndex = visibleItems.length - 1;
			if (this.highlightedIndex >= visibleItems.length) this.highlightedIndex = 0;
		}

		addCls(visibleItems[this.highlightedIndex], "highlighted");
		visibleItems[this.highlightedIndex].scrollIntoView({ block: "nearest" });
	}

	private clearHighlight(): void {
		if (this.highlightedIndex >= 0) {
			const visibleItems = this.getVisibleItems();
			if (this.highlightedIndex < visibleItems.length) {
				removeCls(visibleItems[this.highlightedIndex], "highlighted");
			}
		}
		this.highlightedIndex = -1;
	}

	private createList(container: HTMLElement): void {
		this.createNewContainer = container.createDiv();
		addCls(this.createNewContainer, "category-create-new-container", "hidden");

		this.listContainer = container.createDiv();
		addCls(this.listContainer, "category-list-container");

		if (this.allItems.length === 0) {
			const emptyState = this.listContainer.createDiv();
			addCls(emptyState, "category-empty-state");
			emptyState.textContent = `No items found. Type to create a new one.`;
			return;
		}

		const sortedItems = this.sortItemsWithSelectedFirst();

		for (const item of sortedItems) {
			const itemEl = this.createCheckboxItem(item);
			this.listContainer.appendChild(itemEl);
		}
	}

	private sortItemsWithSelectedFirst(): AssignmentItem[] {
		const selected: AssignmentItem[] = [];
		const unselected: AssignmentItem[] = [];

		for (const item of this.allItems) {
			if (this.preSelected.includes(item.name)) {
				selected.push(item);
			} else {
				unselected.push(item);
			}
		}

		selected.sort((a, b) => a.name.localeCompare(b.name));
		unselected.sort((a, b) => a.name.localeCompare(b.name));

		return [...selected, ...unselected];
	}

	private createCheckboxItem(item: AssignmentItem, isNew = false): HTMLElement {
		const el = document.createElement("div");
		addCls(el, "category-checkbox-item");

		if (isNew) {
			addCls(el, "category-new-item");
		}

		const isPreSelected = this.preSelected.includes(item.name);

		const checkbox = el.createEl("input", {
			type: "checkbox",
		});
		addCls(checkbox, "category-checkbox");

		if (isPreSelected) {
			checkbox.checked = true;
			addCls(el, "checked");
		}

		const label = el.createEl("label");
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

		el.addEventListener("click", (e) => {
			if (e.target === checkbox) return;
			e.preventDefault();
			checkbox.checked = !checkbox.checked;
			this.updateCheckboxState(el, checkbox.checked);
		});

		checkbox.addEventListener("change", () => {
			this.updateCheckboxState(el, checkbox.checked);
		});

		this.states.push({
			item,
			checked: isPreSelected,
			element: el,
			isNew,
		});

		return el;
	}

	private updateCheckboxState(el: HTMLElement, checked: boolean): void {
		const state = this.states.find((s) => s.element === el);
		if (state) {
			state.checked = checked;
		}
		toggleCls(el, "checked", checked);
		this.updateAssignButtonText();
	}

	private updateAssignButtonText(): void {
		if (!this.assignButton) return;

		const selectedCount = this.states.filter((state) => state.checked).length;

		if (selectedCount === 0) {
			this.assignButton.textContent = this.config.removeLabel;
		} else {
			this.assignButton.textContent = this.config.assignLabel;
		}
	}

	private filterItems(): void {
		const searchTerm = this.searchInput.value.toLowerCase().trim();

		for (const state of this.states) {
			if (state.isNew) continue;

			const matches = state.item.name.toLowerCase().includes(searchTerm);
			if (matches) {
				removeCls(state.element, "hidden");
			} else {
				addCls(state.element, "hidden");
			}
		}
	}

	private updateCreateNewButton(): void {
		const searchTerm = this.searchInput.value.trim();

		if (!searchTerm) {
			addCls(this.createNewContainer, "hidden");
			return;
		}

		const exactMatch = this.allItems.some((item) => item.name.toLowerCase() === searchTerm.toLowerCase());

		if (exactMatch) {
			addCls(this.createNewContainer, "hidden");
			return;
		}

		removeCls(this.createNewContainer, "hidden");
		this.createNewContainer.empty();

		const createButton = this.createNewContainer.createEl("button", {
			text: this.config.createNewLabel(searchTerm),
		});
		addCls(createButton, "category-create-new-button");

		createButton.onclick = () => {
			this.createNewItem(searchTerm);
		};
	}

	private createNewItem(name: string): void {
		const existingNew = this.states.find((state) => state.isNew && state.item.name === name);

		if (existingNew) {
			existingNew.checked = true;
			const checkbox = existingNew.element.querySelector("input") as HTMLInputElement;
			if (checkbox) checkbox.checked = true;
			this.updateCheckboxState(existingNew.element, true);
			this.searchInput.value = "";
			this.filterItems();
			this.updateCreateNewButton();
			return;
		}

		const newItem: AssignmentItem = {
			name,
			color: this.config.defaultColor,
		};

		const itemEl = this.createCheckboxItem(newItem, true);
		this.listContainer.insertBefore(itemEl, this.listContainer.firstChild);

		const newState = this.states.find((s) => s.element === itemEl);
		if (newState) {
			newState.checked = true;
			const checkbox = itemEl.querySelector("input") as HTMLInputElement;
			if (checkbox) checkbox.checked = true;
			this.updateCheckboxState(itemEl, true);
		}

		this.searchInput.value = "";
		this.filterItems();
		this.updateCreateNewButton();
	}

	private createButtons(container: HTMLElement): void {
		const { submitButton } = createModalButtons(container, {
			submitText: this.config.removeLabel,
			onSubmit: () => this.submitSelection(),
			onCancel: () => this.close(),
		});
		this.assignButton = submitButton;
	}

	private submitSelection(): void {
		const selected = this.states.filter((state) => state.checked).map((state) => state.item.name);

		this.onSubmit(selected);
		this.close();
	}

	override onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

/** Opens a category assignment modal. Encapsulates config so callers don't repeat it. */
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
	new AssignmentModal(app, items, config, preSelected, onSubmit).open();
}
