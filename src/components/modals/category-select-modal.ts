import { cls } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CategoryInfo, CategoryTracker } from "../../core/category-tracker";

export class CategorySelectModal extends Modal {
	private onSelect: (category: string) => void;
	private categoryTracker: CategoryTracker;
	private dropdownButton!: HTMLButtonElement;
	private dropdownPanel!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private listContainer!: HTMLElement;
	private highlightButton: HTMLButtonElement | null = null;
	private selectedCategory: string | null = null;
	private allCategories: CategoryInfo[] = [];
	private dropdownContainer!: HTMLElement;
	private selectedCategoryDisplay!: HTMLElement;

	constructor(app: App, categoryTracker: CategoryTracker, onSelect: (category: string) => void) {
		super(app);
		this.categoryTracker = categoryTracker;
		this.onSelect = onSelect;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("category-select-modal"));

		contentEl.createEl("h2", { text: "Highlight events with category" });

		const formEl = contentEl.createDiv({ cls: cls("category-select-form") });

		const categorySection = formEl.createDiv({
			cls: cls("category-select-section"),
		});
		categorySection.createEl("label", { text: "Select category" });

		const inputWrapper = categorySection.createDiv(cls("category-input-wrapper"));

		this.dropdownContainer = inputWrapper.createDiv(cls("category-dropdown-container"));

		this.dropdownButton = this.dropdownContainer.createEl("button", {
			text: "Choose a category...",
			cls: cls("category-select-button"),
			type: "button",
		});

		this.dropdownPanel = this.dropdownContainer.createDiv(cls("category-dropdown-panel"));
		this.dropdownPanel.classList.add("prisma-hidden");

		this.searchInput = this.dropdownPanel.createEl("input", {
			type: "text",
			placeholder: "Search categories...",
			cls: cls("category-search-input"),
		});

		this.listContainer = this.dropdownPanel.createDiv(cls("category-list"));

		this.selectedCategoryDisplay = categorySection.createDiv(cls("category-selected-display"));
		this.selectedCategoryDisplay.classList.add("prisma-hidden");

		this.allCategories = this.categoryTracker.getCategoriesWithColors();

		this.setupEventHandlers();

		const infoEl = formEl.createDiv({ cls: cls("category-select-info") });
		infoEl.createEl("p", {
			text: "Select a category to temporarily highlight all events associated with it for 10 seconds.",
		});

		const buttonRow = formEl.createDiv({ cls: cls("category-select-buttons") });

		const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		this.highlightButton = buttonRow.createEl("button", {
			text: "Highlight",
			cls: "mod-cta",
		});
		this.highlightButton.disabled = true;

		this.highlightButton.addEventListener("click", () => this.handleHighlight());

		if (this.allCategories.length === 0) {
			this.dropdownButton.textContent = "No categories available";
			this.dropdownButton.disabled = true;
		}

		this.renderCategoryList("");
	}

	private setupEventHandlers(): void {
		this.dropdownButton.addEventListener("click", (e) => {
			e.stopPropagation();
			if (this.dropdownPanel.classList.contains("prisma-hidden")) {
				this.openDropdown();
			} else {
				this.closeDropdown();
			}
		});

		this.searchInput.addEventListener("input", () => {
			this.renderCategoryList(this.searchInput.value);
		});

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

		this.dropdownButton.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && this.selectedCategory) {
				e.preventDefault();
				this.handleHighlight();
			}
		});

		document.addEventListener("click", (e) => {
			if (!this.dropdownContainer.contains(e.target as Node)) {
				this.closeDropdown();
			}
		});

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
		const lowerFilter = filter.toLowerCase();
		const filteredCategories = this.allCategories.filter((cat) => cat.name.toLowerCase().includes(lowerFilter));

		if (filteredCategories.length === 0) {
			this.listContainer.createDiv({
				text: filter
					? "No matching categories"
					: this.allCategories.length === 0
						? "No categories yet"
						: "No categories yet",
				cls: cls("category-empty-message"),
			});
			return;
		}

		for (const categoryInfo of filteredCategories) {
			const item = this.listContainer.createDiv({
				cls: cls("category-list-item"),
			});

			const colorDot = item.createEl("span", {
				cls: cls("category-color-dot"),
			});
			colorDot.style.setProperty("--category-color", categoryInfo.color);

			item.createSpan({ text: categoryInfo.name });

			item.addEventListener("click", () => {
				this.selectCategory(categoryInfo.name, categoryInfo.color);
				this.closeDropdown();
			});
		}
	}

	private selectCategory(category: string, color: string): void {
		this.selectedCategory = category;

		this.selectedCategoryDisplay.empty();
		this.selectedCategoryDisplay.classList.remove("prisma-hidden");

		this.selectedCategoryDisplay.createEl("span", {
			text: "Selected:",
			cls: cls("category-selected-label"),
		});

		const categoryItem = this.selectedCategoryDisplay.createDiv(cls("category-selected-item"));

		const colorDot = categoryItem.createEl("span", {
			cls: cls("category-color-dot"),
		});
		colorDot.style.setProperty("--category-color", color);

		categoryItem.createSpan({
			text: category,
			cls: cls("category-selected-name"),
		});

		if (this.highlightButton) {
			this.highlightButton.disabled = false;
		}
	}

	private handleHighlight(): void {
		if (!this.selectedCategory) return;

		this.onSelect(this.selectedCategory);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
