import { bulkRenameCategoryInFiles, type CategoryOperationResult } from "@real1ty-obsidian-plugins";
import { Notice, Setting, type TFile } from "obsidian";
import type { CalendarEvent } from "../../types/calendar";
import { BaseCategoryOperationModal } from "./base-category-operation-modal";

export class CategoryRenameModal extends BaseCategoryOperationModal {
	private newCategoryName = "";

	getModalTitle(): string {
		return "Rename category";
	}

	getModalCssClass(): string {
		return "prisma-calendar-category-rename-modal";
	}

	renderModalContent(contentEl: HTMLElement, eventsWithCategory: CalendarEvent[]): void {
		contentEl.createEl("p", {
			text: `This will rename "${this.categoryName}" in ${eventsWithCategory.length} event(s).`,
			cls: "setting-item-description",
		});

		new Setting(contentEl).setName("Current name").addText((text) => {
			text.setValue(this.categoryName);
			text.setDisabled(true);
		});

		new Setting(contentEl).setName("New name").addText((text) => {
			text.setValue(this.newCategoryName);
			text.setPlaceholder("Enter new category name");
			text.onChange((value) => {
				this.newCategoryName = value.trim();
				this.updateActionButton();
			});
			text.inputEl.focus();
			text.inputEl.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					void this.handleOperation();
				}
			});
		});
	}

	getActionButtonText(): string {
		return "Rename";
	}

	getActionButtonClass(): string {
		return "mod-cta";
	}

	getProgressText(): string {
		return "Renaming...";
	}

	onOpen(): void {
		super.onOpen();
		this.updateActionButton();
	}

	private updateActionButton(): void {
		if (!this.actionButton) return;
		const isValid = this.newCategoryName.length > 0 && this.newCategoryName !== this.categoryName;
		this.actionButton.disabled = !isValid;
	}

	protected async handleOperation(): Promise<void> {
		if (!this.actionButton || this.actionButton.disabled) return;

		if (this.newCategoryName === this.categoryName) {
			new Notice("New name must be different from the current name");
			return;
		}

		if (this.newCategoryName.length === 0) {
			new Notice("Category name cannot be empty");
			return;
		}

		await super.handleOperation();
	}

	async performOperation(files: TFile[]): Promise<CategoryOperationResult> {
		const settings = this.settingsStore.currentSettings;
		return await bulkRenameCategoryInFiles(
			this.app,
			files,
			this.categoryName,
			this.newCategoryName,
			settings.categoryProp,
			{
				onComplete: () => {
					setTimeout(() => {
						this.onSuccess();
					}, 150);
				},
			}
		);
	}

	async updateColorRules(categoryProp: string): Promise<void> {
		const oldExpression = this.getCategoryExpression(this.categoryName, categoryProp);
		const newExpression = this.getCategoryExpression(this.newCategoryName, categoryProp);

		await this.settingsStore.updateSettings((s) => {
			const updatedColorRules = s.colorRules.map((rule) => {
				if (rule.expression === oldExpression) {
					return { ...rule, expression: newExpression };
				}
				return rule;
			});

			return { ...s, colorRules: updatedColorRules };
		});
	}

	getSuccessMessage(filesModified: number): string {
		return `Successfully renamed category in ${filesModified} event(s)`;
	}

	getErrorMessage(error: unknown): string {
		return `Error renaming category: ${error instanceof Error ? error.message : String(error)}`;
	}
}
