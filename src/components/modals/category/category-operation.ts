import {
	bulkDeleteCategoryFromFiles,
	bulkRenameCategoryInFiles,
	type CategoryOperationResult,
	showModal,
	showProgressModal,
} from "@real1ty-obsidian-plugins";
import { type App, Notice, Setting, TFile } from "obsidian";

import type { CategoryTracker } from "../../../core/category-tracker";
import type { CalendarSettingsStore } from "../../../core/settings-store";
import type { CalendarEvent } from "../../../types/calendar";
import { createModalButtons } from "../../../utils/dom-utils";

interface CategoryOperationConfig {
	app: App;
	categoryTracker: CategoryTracker;
	settingsStore: CalendarSettingsStore;
	categoryName: string;
	onSuccess: () => void;
	modalTitle: string;
	modalCssClass: string;
	actionButtonText: string;
	actionButtonClass: string;
	progressText: string;
	renderContent: (el: HTMLElement, eventsWithCategory: CalendarEvent[]) => void;
	isActionEnabled?: () => boolean;
	performOperation: (
		app: App,
		files: TFile[],
		settings: { categoryProp: string; onProgress: (completed: number) => void }
	) => Promise<CategoryOperationResult>;
	updateColorRules: (settingsStore: CalendarSettingsStore, categoryProp: string) => Promise<void>;
	successMessage: (filesModified: number) => string;
	errorMessage: (error: unknown) => string;
}

function getCategoryExpression(category: string, categoryProp: string): string {
	const escapedCategory = category.replace(/'/g, "\\'");
	return `${categoryProp}.includes('${escapedCategory}')`;
}

function renderCategoryOperation(el: HTMLElement, config: CategoryOperationConfig, close: () => void): void {
	const eventsWithCategory = config.categoryTracker.getEventsWithCategory(config.categoryName);

	el.createEl("h2", { text: config.modalTitle });
	config.renderContent(el, eventsWithCategory);

	const { submitButton: actionButton } = createModalButtons(el, {
		submitText: config.actionButtonText,
		submitCls: config.actionButtonClass,
		onSubmit: () => void handleOperation(),
		onCancel: close,
	});

	if (config.isActionEnabled && !config.isActionEnabled()) {
		actionButton.disabled = true;
	}

	async function handleOperation(): Promise<void> {
		if (actionButton.disabled) return;

		const settings = config.settingsStore.currentSettings;
		const events = config.categoryTracker.getEventsWithCategory(config.categoryName);
		const files = events
			.map((event) => config.app.vault.getAbstractFileByPath(event.ref.filePath))
			.filter((file): file is TFile => file instanceof TFile);

		close();

		const progress = showProgressModal({
			app: config.app,
			cssPrefix: "prisma-",
			total: files.length,
			title: config.progressText,
			statusTemplate: `${config.progressText.replace("...", "")} {current} of {total}...`,
			initialDetails: `Processing "${config.categoryName}"...`,
		});

		try {
			const result = await config.performOperation(config.app, files, {
				categoryProp: settings.categoryProp,
				onProgress: (completed: number) => {
					progress.updateProgress(completed);
				},
			});
			await config.updateColorRules(config.settingsStore, settings.categoryProp);

			if (result.filesWithErrors.length > 0) {
				console.error("[CategoryOperation] Errors in category operation:", result.filesWithErrors);
				progress.showComplete([
					config.successMessage(result.filesModified.length),
					`${result.filesWithErrors.length} failed`,
				]);
			} else {
				progress.showComplete([config.successMessage(result.filesModified.length)]);
			}
		} catch (error) {
			console.error("[CategoryOperation] Error in category operation:", error);
			progress.showError(config.errorMessage(error));
		}
	}
}

function showCategoryOperationModal(config: CategoryOperationConfig): void {
	showModal({
		app: config.app,
		cls: config.modalCssClass,
		render: (el, ctx) => renderCategoryOperation(el, config, ctx.close),
	});
}

export function showCategoryRenameModal(
	app: App,
	categoryTracker: CategoryTracker,
	settingsStore: CalendarSettingsStore,
	categoryName: string,
	onSuccess: () => void
): void {
	let newCategoryName = "";

	showCategoryOperationModal({
		app,
		categoryTracker,
		settingsStore,
		categoryName,
		onSuccess,
		modalTitle: "Rename category",
		modalCssClass: "prisma-calendar-category-rename-modal",
		actionButtonText: "Rename",
		actionButtonClass: "mod-cta",
		progressText: "Renaming...",
		isActionEnabled: () => false,
		renderContent: (el, eventsWithCategory) => {
			el.createEl("p", {
				text: `This will rename "${categoryName}" in ${eventsWithCategory.length} event(s).`,
				cls: "setting-item-description",
			});

			new Setting(el).setName("Current name").addText((text) => {
				text.setValue(categoryName);
				text.setDisabled(true);
			});

			new Setting(el).setName("New name").addText((text) => {
				text.setValue(newCategoryName);
				text.setPlaceholder("Enter new category name");
				text.inputEl.setAttribute("data-testid", "prisma-category-rename-input");
				text.onChange((value) => {
					newCategoryName = value.trim();
					const actionBtn = el.querySelector<HTMLButtonElement>(".mod-cta:last-of-type");
					if (actionBtn) {
						actionBtn.disabled = newCategoryName.length === 0 || newCategoryName === categoryName;
					}
				});
				text.inputEl.focus();
				text.inputEl.addEventListener("keydown", (e) => {
					if (e.key === "Enter") {
						e.preventDefault();
						const actionBtn = el.querySelector<HTMLButtonElement>(".mod-cta:last-of-type");
						if (actionBtn && !actionBtn.disabled) actionBtn.click();
					}
				});
			});
		},
		performOperation: async (appInstance, files, settings) => {
			if (newCategoryName === categoryName) {
				new Notice("New name must be different from the current name");
				throw new Error("Name unchanged");
			}
			if (newCategoryName.length === 0) {
				new Notice("Category name cannot be empty");
				throw new Error("Name empty");
			}
			return bulkRenameCategoryInFiles(appInstance, files, categoryName, newCategoryName, settings.categoryProp, {
				onProgress: settings.onProgress,
				onComplete: () => setTimeout(onSuccess, 150),
			});
		},
		updateColorRules: async (store, categoryProp) => {
			const oldExpression = getCategoryExpression(categoryName, categoryProp);
			const newExpression = getCategoryExpression(newCategoryName, categoryProp);
			await store.updateSettings((s) => ({
				...s,
				colorRules: s.colorRules.map((rule) =>
					rule.expression === oldExpression ? { ...rule, expression: newExpression } : rule
				),
			}));
		},
		successMessage: (n) => `Successfully renamed category in ${n} event(s)`,
		errorMessage: (error) => `Error renaming category: ${error instanceof Error ? error.message : String(error)}`,
	});
}

export function showCategoryDeleteModal(
	app: App,
	categoryTracker: CategoryTracker,
	settingsStore: CalendarSettingsStore,
	categoryName: string,
	onSuccess: () => void
): void {
	showCategoryOperationModal({
		app,
		categoryTracker,
		settingsStore,
		categoryName,
		onSuccess,
		modalTitle: "Delete category",
		modalCssClass: "prisma-calendar-category-delete-confirm-modal",
		actionButtonText: "Delete",
		actionButtonClass: "mod-warning",
		progressText: "Deleting...",
		renderContent: (el, eventsWithCategory) => {
			el.createEl("p", { text: `Are you sure you want to delete "${categoryName}"?` });

			if (eventsWithCategory.length > 0) {
				el.createEl("p", {
					text: `This will remove the category from ${eventsWithCategory.length} event(s).`,
					cls: "mod-warning",
				});
			} else {
				el.createEl("p", {
					text: "This category is not currently used in any events.",
					cls: "setting-item-description",
				});
			}
		},
		performOperation: async (appInstance, files, settings) => {
			return bulkDeleteCategoryFromFiles(appInstance, files, categoryName, settings.categoryProp, {
				onProgress: settings.onProgress,
				onComplete: () => setTimeout(onSuccess, 150),
			});
		},
		updateColorRules: async (store, categoryProp) => {
			const categoryExpression = getCategoryExpression(categoryName, categoryProp);
			await store.updateSettings((s) => ({
				...s,
				colorRules: s.colorRules.filter((rule) => rule.expression !== categoryExpression),
			}));
		},
		successMessage: (n) => `Successfully deleted category from ${n} event(s)`,
		errorMessage: (error) => `Error deleting category: ${error instanceof Error ? error.message : String(error)}`,
	});
}
