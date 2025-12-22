import { cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { Modal } from "obsidian";
import type { CategoryTracker } from "../../core/category-tracker";

export class CategorySelectModal extends Modal {
	private onSelect: (category: string) => void;
	private categoryTracker: CategoryTracker;
	private categorySelect: HTMLSelectElement | null = null;
	private selectedCategory: string | null = null;

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

		const categorySection = formEl.createDiv({ cls: cls("category-select-section") });
		categorySection.createEl("label", { text: "Select category" });
		this.categorySelect = categorySection.createEl("select", { cls: cls("category-select") });

		const categories = this.categoryTracker.getCategories();
		if (categories.length === 0) {
			const emptyOption = this.categorySelect.createEl("option", {
				value: "",
				text: "No categories available",
			});
			emptyOption.disabled = true;
		} else {
			const placeholderOption = this.categorySelect.createEl("option", {
				value: "",
				text: "Choose a category...",
			});
			placeholderOption.selected = true;

			for (const category of categories) {
				this.categorySelect.createEl("option", {
					value: category,
					text: category,
				});
			}
		}

		this.categorySelect.addEventListener("change", () => {
			this.selectedCategory = this.categorySelect?.value || null;
		});

		const infoEl = formEl.createDiv({ cls: cls("category-select-info") });
		infoEl.createEl("p", {
			text: "Events with the selected category will be highlighted for 10 seconds.",
		});

		const buttonRow = formEl.createDiv({ cls: cls("category-select-buttons") });

		const cancelButton = buttonRow.createEl("button", { text: "Cancel" });
		cancelButton.addEventListener("click", () => this.close());

		const highlightButton = buttonRow.createEl("button", {
			text: "Highlight",
			cls: "mod-cta",
		});
		highlightButton.addEventListener("click", () => this.handleHighlight());
		highlightButton.disabled = categories.length === 0;

		this.categorySelect.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && this.selectedCategory) {
				this.handleHighlight();
			}
		});
	}

	private handleHighlight(): void {
		if (!this.selectedCategory || !this.categorySelect) return;

		this.onSelect(this.selectedCategory);
		this.close();
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
