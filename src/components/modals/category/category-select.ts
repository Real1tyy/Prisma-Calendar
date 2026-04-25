import { cls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type { CategoryInfo, CategoryTracker } from "../../../core/category-tracker";

function renderCategorySelectForm(
	el: HTMLElement,
	categoryTracker: CategoryTracker,
	onSelect: (category: string) => void,
	close: () => void
): void {
	let selectedCategory: string | null = null;
	const allCategories: CategoryInfo[] = categoryTracker.getCategoriesWithColors();

	el.createEl("h2", { text: "Highlight events with category" });

	const formEl = el.createDiv({ cls: cls("category-select-form") });
	const categorySection = formEl.createDiv({ cls: cls("category-select-section") });
	categorySection.createEl("label", { text: "Select category" });

	const inputWrapper = categorySection.createDiv(cls("category-input-wrapper"));
	const dropdownContainer = inputWrapper.createDiv(cls("category-dropdown-container"));

	const dropdownButton = dropdownContainer.createEl("button", {
		text: "Choose a category...",
		cls: cls("category-select-button"),
		type: "button",
	});

	const dropdownPanel = dropdownContainer.createDiv(cls("category-dropdown-panel"));
	dropdownPanel.classList.add("prisma-hidden");

	const searchInput = dropdownPanel.createEl("input", {
		type: "text",
		placeholder: "Search categories...",
		cls: cls("category-search-input"),
	});

	const listContainer = dropdownPanel.createDiv(cls("category-list"));

	const selectedCategoryDisplay = categorySection.createDiv(cls("category-selected-display"));
	selectedCategoryDisplay.classList.add("prisma-hidden");

	// eslint-disable-next-line prefer-const -- deferred initialization
	let highlightButton: HTMLButtonElement;

	function openDropdown(): void {
		dropdownPanel.classList.remove("prisma-hidden");
		renderCategoryList("");
		searchInput.focus();
	}

	function closeDropdown(): void {
		dropdownPanel.classList.add("prisma-hidden");
		searchInput.value = "";
	}

	function renderCategoryList(filter: string): void {
		listContainer.empty();
		const lowerFilter = filter.toLowerCase();
		const filtered = allCategories.filter((cat) => cat.name.toLowerCase().includes(lowerFilter));

		if (filtered.length === 0) {
			listContainer.createDiv({
				text: filter ? "No matching categories" : "No categories yet",
				cls: cls("category-empty-message"),
			});
			return;
		}

		for (const categoryInfo of filtered) {
			const item = listContainer.createDiv({ cls: cls("category-list-item") });
			const colorDot = item.createEl("span", { cls: cls("category-color-dot") });
			colorDot.style.setProperty("--category-color", categoryInfo.color);
			item.createSpan({ text: categoryInfo.name });

			item.addEventListener("click", () => {
				selectCategory(categoryInfo.name, categoryInfo.color);
				closeDropdown();
			});
		}
	}

	function selectCategory(category: string, color: string): void {
		selectedCategory = category;
		selectedCategoryDisplay.empty();
		selectedCategoryDisplay.classList.remove("prisma-hidden");

		selectedCategoryDisplay.createEl("span", { text: "Selected:", cls: cls("category-selected-label") });
		const categoryItem = selectedCategoryDisplay.createDiv(cls("category-selected-item"));
		const colorDot = categoryItem.createEl("span", { cls: cls("category-color-dot") });
		colorDot.style.setProperty("--category-color", color);
		categoryItem.createSpan({ text: category, cls: cls("category-selected-name") });

		highlightButton.disabled = false;
	}

	dropdownButton.addEventListener("click", (e) => {
		e.stopPropagation();
		if (dropdownPanel.classList.contains("prisma-hidden")) {
			openDropdown();
		} else {
			closeDropdown();
		}
	});

	searchInput.addEventListener("input", () => renderCategoryList(searchInput.value));

	searchInput.addEventListener("keydown", (e) => {
		if (e.key === "Escape") {
			closeDropdown();
		} else if (e.key === "Enter") {
			e.preventDefault();
			const firstItem = listContainer.querySelector(`.${cls("category-list-item")}`) as HTMLElement;
			firstItem.click();
		}
	});

	dropdownButton.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && selectedCategory) {
			e.preventDefault();
			onSelect(selectedCategory);
			close();
		}
	});

	document.addEventListener("click", (e) => {
		if (!dropdownContainer.contains(e.target as Node)) closeDropdown();
	});

	dropdownPanel.addEventListener("click", (e) => e.stopPropagation());

	const infoEl = formEl.createDiv({ cls: cls("category-select-info") });
	infoEl.createEl("p", {
		text: "Select a category to temporarily highlight all events associated with it for 10 seconds.",
	});

	const buttonRow = formEl.createDiv({ cls: cls("category-select-buttons") });
	const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
	cancelButton.addEventListener("click", close);

	highlightButton = buttonRow.createEl("button", { text: "Highlight", cls: "mod-cta" });
	highlightButton.disabled = true;
	highlightButton.addEventListener("click", () => {
		if (!selectedCategory) return;
		onSelect(selectedCategory);
		close();
	});

	if (allCategories.length === 0) {
		dropdownButton.textContent = "No categories available";
		dropdownButton.disabled = true;
	}

	renderCategoryList("");
}

export function showCategorySelectModal(
	app: App,
	categoryTracker: CategoryTracker,
	onSelect: (category: string) => void
): void {
	showModal({
		app,
		cls: cls("category-select-modal"),
		render: (el, ctx) => renderCategorySelectForm(el, categoryTracker, onSelect, ctx.close),
	});
}
