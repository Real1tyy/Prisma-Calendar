import { cls } from "@real1ty-obsidian-plugins/utils";
import type { CategoryTracker } from "../core/category-tracker";

export class CategoryInput {
	private categoryInput!: HTMLInputElement;
	private dropdownPanel!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private listContainer!: HTMLElement;
	private categoryTracker: CategoryTracker;
	private container: HTMLElement;

	constructor(categoryTracker: CategoryTracker) {
		this.categoryTracker = categoryTracker;
		this.container = document.createElement("div");
	}

	render(parent: HTMLElement): void {
		const categoryContainer = parent.createDiv(`setting-item ${cls("category-field")}`);
		const labelContainer = categoryContainer.createDiv("setting-item-name");
		labelContainer.createEl("div", { text: "Categories" });
		labelContainer.createEl("div", {
			text: "Comma-separated for multiple",
			cls: "setting-item-description",
		});

		const inputWrapper = categoryContainer.createDiv(cls("category-input-wrapper"));

		// Text input for typing or editing categories (comma-separated)
		this.categoryInput = inputWrapper.createEl("input", {
			type: "text",
			placeholder: "e.g., Work, Meeting, Important",
			cls: "setting-item-control",
		});

		const dropdownContainer = inputWrapper.createDiv(cls("category-dropdown-container"));

		const addButton = dropdownContainer.createEl("button", {
			text: "+ add",
			cls: cls("category-add-button"),
			type: "button",
		});

		this.dropdownPanel = dropdownContainer.createDiv(cls("category-dropdown-panel"));
		this.dropdownPanel.classList.add("prisma-hidden");

		this.searchInput = this.dropdownPanel.createEl("input", {
			type: "text",
			placeholder: "Search categories...",
			cls: cls("category-search-input"),
		});

		this.listContainer = this.dropdownPanel.createDiv(cls("category-list"));

		this.setupEventHandlers(addButton, dropdownContainer);
		this.container = categoryContainer;
	}

	private setupEventHandlers(addButton: HTMLElement, dropdownContainer: HTMLElement): void {
		// Toggle dropdown on button click
		addButton.addEventListener("click", (e) => {
			e.stopPropagation();
			if (this.dropdownPanel.classList.contains("prisma-hidden")) {
				this.openDropdown();
			} else {
				this.closeDropdown();
			}
		});

		// Filter list on search input
		this.searchInput.addEventListener("input", () => {
			this.renderCategoryList(this.searchInput.value);
		});

		// Handle keyboard navigation in search
		this.searchInput.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				this.closeDropdown();
			} else if (e.key === "Enter") {
				e.preventDefault();
				const firstItem = this.listContainer.querySelector(`.${cls("category-list-item")}`) as HTMLElement;
				if (firstItem) {
					firstItem.click();
				}
			}
		});

		// Close dropdown when clicking outside
		document.addEventListener("click", (e) => {
			if (!dropdownContainer.contains(e.target as Node)) {
				this.closeDropdown();
			}
		});

		// Prevent dropdown from closing when clicking inside it
		this.dropdownPanel.addEventListener("click", (e) => {
			e.stopPropagation();
		});
	}

	private openDropdown(): void {
		this.dropdownPanel.classList.remove("prisma-hidden");
		this.renderCategoryList("");
		this.searchInput.focus();
	}

	private closeDropdown(): void {
		this.dropdownPanel.classList.add("prisma-hidden");
		this.searchInput.value = "";
	}

	private renderCategoryList(filter: string): void {
		this.listContainer.empty();
		const allCategories = this.categoryTracker.getCategories();
		const lowerFilter = filter.toLowerCase();
		const filteredCategories = allCategories.filter((cat) => cat.toLowerCase().includes(lowerFilter));

		if (filteredCategories.length === 0) {
			this.listContainer.createDiv({
				text: filter ? "No matching categories" : "No categories yet",
				cls: cls("category-empty-message"),
			});
			return;
		}

		for (const category of filteredCategories) {
			const item = this.listContainer.createDiv({
				text: category,
				cls: cls("category-list-item"),
			});
			item.addEventListener("click", () => {
				this.addCategoryToInput(category);
				this.closeDropdown();
			});
		}
	}

	private addCategoryToInput(category: string): void {
		const currentValue = this.categoryInput.value.trim();
		if (currentValue) {
			// Append to existing categories if not already present
			const existingCategories = currentValue.split(",").map((c) => c.trim());
			if (!existingCategories.includes(category)) {
				this.categoryInput.value = `${currentValue}, ${category}`;
			}
		} else {
			this.categoryInput.value = category;
		}
	}

	getValue(): string {
		return this.categoryInput.value.trim();
	}

	setValue(value: unknown): void {
		if (Array.isArray(value)) {
			// Multiple categories stored as array
			this.categoryInput.value = value.filter((c) => typeof c === "string" && c.trim()).join(", ");
		} else if (typeof value === "string" && value.trim()) {
			// Single category stored as string
			this.categoryInput.value = value.trim();
		}
	}

	getContainer(): HTMLElement {
		return this.container;
	}
}
