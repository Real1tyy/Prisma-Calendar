import { bulkDeleteCategoryFromFiles, type CategoryOperationResult } from "@real1ty-obsidian-plugins";
import type { TFile } from "obsidian";
import type { CalendarEvent } from "../../types/calendar";
import { BaseCategoryOperationModal } from "./base-category-operation-modal";

export class CategoryDeleteModal extends BaseCategoryOperationModal {
	getModalTitle(): string {
		return "Delete category";
	}

	getModalCssClass(): string {
		return "prisma-calendar-category-delete-confirm-modal";
	}

	renderModalContent(contentEl: HTMLElement, eventsWithCategory: CalendarEvent[]): void {
		contentEl.createEl("p", {
			text: `Are you sure you want to delete "${this.categoryName}"?`,
		});

		if (eventsWithCategory.length > 0) {
			contentEl.createEl("p", {
				text: `This will remove the category from ${eventsWithCategory.length} event(s).`,
				cls: "mod-warning",
			});
		} else {
			contentEl.createEl("p", {
				text: "This category is not currently used in any events.",
				cls: "setting-item-description",
			});
		}
	}

	getActionButtonText(): string {
		return "Delete";
	}

	getActionButtonClass(): string {
		return "mod-warning";
	}

	getProgressText(): string {
		return "Deleting...";
	}

	async performOperation(files: TFile[]): Promise<CategoryOperationResult> {
		const settings = this.settingsStore.currentSettings;
		return await bulkDeleteCategoryFromFiles(this.app, files, this.categoryName, settings.categoryProp, {
			onComplete: () => {
				setTimeout(() => {
					this.onSuccess();
				}, 150);
			},
		});
	}

	async updateColorRules(categoryProp: string): Promise<void> {
		const categoryExpression = this.getCategoryExpression(this.categoryName, categoryProp);

		await this.settingsStore.updateSettings((s) => {
			const updatedColorRules = s.colorRules.filter((rule) => rule.expression !== categoryExpression);
			return { ...s, colorRules: updatedColorRules };
		});
	}

	getSuccessMessage(filesModified: number): string {
		return `Successfully deleted category from ${filesModified} event(s)`;
	}

	getErrorMessage(error: unknown): string {
		return `Error deleting category: ${error instanceof Error ? error.message : String(error)}`;
	}
}
