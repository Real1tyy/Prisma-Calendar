import { addCls, cls, removeCls, toggleCls } from "@real1ty-obsidian-plugins/utils";
import { type App, Modal } from "obsidian";
import type { CategoryInfo } from "../../core/category-tracker";

interface CategoryCheckboxState {
	category: CategoryInfo;
	checked: boolean;
	element: HTMLElement;
	isNew?: boolean;
}

export class CategoryAssignModal extends Modal {
	private searchInput: HTMLInputElement;
	private categoryListContainer: HTMLElement;
	private createNewContainer: HTMLElement;
	private assignButton: HTMLButtonElement;
	private categoryStates: CategoryCheckboxState[] = [];
	private onSubmit: (selectedCategories: string[]) => void;
	private allCategories: CategoryInfo[];
	private defaultColor: string;
	private preSelectedCategories: string[];

	constructor(
		app: App,
		categories: CategoryInfo[],
		defaultColor: string,
		preSelectedCategories: string[],
		onSubmit: (selectedCategories: string[]) => void
	) {
		super(app);
		this.allCategories = categories;
		this.defaultColor = defaultColor;
		this.preSelectedCategories = preSelectedCategories;
		this.onSubmit = onSubmit;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: "Assign categories" });

		const description = contentEl.createEl("p", {
			text: "Select categories to assign to all selected events. This will replace any existing categories.",
		});
		addCls(description, "setting-item-description");

		this.createSearchInput(contentEl);
		this.createCategoryList(contentEl);
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
			placeholder: "Search or create new category...",
		});
		addCls(this.searchInput, "category-search-input");

		this.searchInput.addEventListener("input", () => {
			this.filterCategories();
			this.updateCreateNewButton();
		});
	}

	private setupKeyboardHandlers(): void {
		this.scope.register([], "Enter", (e) => {
			e.preventDefault();

			const searchValue = this.searchInput.value.trim();

			if (searchValue) {
				const firstVisibleItem = Array.from(this.categoryListContainer.children).find(
					(child) => !child.classList.contains("prisma-hidden")
				) as HTMLElement;

				if (firstVisibleItem) {
					firstVisibleItem.click();
					this.searchInput.value = "";
					this.filterCategories();
					this.updateCreateNewButton();
				}
			} else {
				this.submitCategories();
			}
		});
	}

	private createCategoryList(container: HTMLElement): void {
		this.createNewContainer = container.createDiv();
		addCls(this.createNewContainer, "category-create-new-container", "hidden");

		this.categoryListContainer = container.createDiv();
		addCls(this.categoryListContainer, "category-list-container");

		if (this.allCategories.length === 0) {
			const emptyState = this.categoryListContainer.createDiv();
			addCls(emptyState, "category-empty-state");
			emptyState.textContent = "No categories found. Type to create a new category.";
			return;
		}

		for (const category of this.allCategories) {
			const categoryItem = this.createCategoryItem(category);
			this.categoryListContainer.appendChild(categoryItem);
		}
	}

	private createCategoryItem(category: CategoryInfo, isNew = false): HTMLElement {
		const item = document.createElement("div");
		addCls(item, "category-checkbox-item");

		if (isNew) {
			addCls(item, "category-new-item");
		}

		const isPreSelected = this.preSelectedCategories.includes(category.name);

		const checkbox = item.createEl("input", {
			type: "checkbox",
		});
		addCls(checkbox, "category-checkbox");

		if (isPreSelected) {
			checkbox.checked = true;
			addCls(item, "checked");
		}

		const label = item.createEl("label");
		addCls(label, "category-label");

		const colorDot = label.createEl("span");
		addCls(colorDot, "category-color-dot");
		colorDot.style.setProperty("--category-color", category.color);

		const nameSpan = label.createEl("span", { text: category.name });
		addCls(nameSpan, "category-name");

		if (isNew) {
			const newBadge = label.createEl("span", { text: "NEW" });
			addCls(newBadge, "category-new-badge");
		}

		item.addEventListener("click", (e) => {
			if (e.target === checkbox) return;
			e.preventDefault();
			checkbox.checked = !checkbox.checked;
			this.updateCheckboxState(item, checkbox.checked);
		});

		checkbox.addEventListener("change", () => {
			this.updateCheckboxState(item, checkbox.checked);
		});

		this.categoryStates.push({
			category,
			checked: isPreSelected,
			element: item,
			isNew,
		});

		return item;
	}

	private updateCheckboxState(item: HTMLElement, checked: boolean): void {
		const state = this.categoryStates.find((s) => s.element === item);
		if (state) {
			state.checked = checked;
		}
		toggleCls(item, "checked", checked);
		this.updateAssignButtonText();
	}

	private updateAssignButtonText(): void {
		if (!this.assignButton) return;

		const selectedCount = this.categoryStates.filter((state) => state.checked).length;

		if (selectedCount === 0) {
			this.assignButton.textContent = "Remove categories";
		} else {
			this.assignButton.textContent = "Assign categories";
		}
	}

	private filterCategories(): void {
		const searchTerm = this.searchInput.value.toLowerCase().trim();

		for (const state of this.categoryStates) {
			if (state.isNew) continue;

			const matches = state.category.name.toLowerCase().includes(searchTerm);
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

		const exactMatch = this.allCategories.some((cat) => cat.name.toLowerCase() === searchTerm.toLowerCase());

		if (exactMatch) {
			addCls(this.createNewContainer, "hidden");
			return;
		}

		removeCls(this.createNewContainer, "hidden");
		this.createNewContainer.empty();

		const createButton = this.createNewContainer.createEl("button", {
			text: `Create new category: "${searchTerm}"`,
		});
		addCls(createButton, "category-create-new-button");

		createButton.onclick = () => {
			this.createNewCategory(searchTerm);
		};
	}

	private createNewCategory(categoryName: string): void {
		const existingNewCategory = this.categoryStates.find(
			(state) => state.isNew && state.category.name === categoryName
		);

		if (existingNewCategory) {
			existingNewCategory.checked = true;
			const checkbox = existingNewCategory.element.querySelector("input") as HTMLInputElement;
			if (checkbox) checkbox.checked = true;
			this.updateCheckboxState(existingNewCategory.element, true);
			this.searchInput.value = "";
			this.filterCategories();
			this.updateCreateNewButton();
			return;
		}

		const newCategory: CategoryInfo = {
			name: categoryName,
			color: this.defaultColor,
		};

		const categoryItem = this.createCategoryItem(newCategory, true);
		this.categoryListContainer.insertBefore(categoryItem, this.categoryListContainer.firstChild);

		const newState = this.categoryStates.find((s) => s.element === categoryItem);
		if (newState) {
			newState.checked = true;
			const checkbox = categoryItem.querySelector("input") as HTMLInputElement;
			if (checkbox) checkbox.checked = true;
			this.updateCheckboxState(categoryItem, true);
		}

		this.searchInput.value = "";
		this.filterCategories();
		this.updateCreateNewButton();
	}

	private createButtons(container: HTMLElement): void {
		const buttonContainer = container.createDiv(cls("modal-button-container"));

		const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
		cancelBtn.onclick = () => this.close();

		this.assignButton = buttonContainer.createEl("button", {
			text: "Remove categories",
			cls: cls("mod-cta"),
		});
		this.assignButton.onclick = () => {
			this.submitCategories();
		};
	}

	private submitCategories(): void {
		const selectedCategories = this.categoryStates.filter((state) => state.checked).map((state) => state.category.name);

		this.onSubmit(selectedCategories);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
