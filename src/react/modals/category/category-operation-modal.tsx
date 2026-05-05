import {
	bulkDeleteCategoryFromFiles,
	bulkRenameCategoryInFiles,
	type CategoryOperationResult,
	showProgressModal,
} from "@real1ty-obsidian-plugins";
import { openConfirmation, openRenameModal } from "@real1ty-obsidian-plugins-react";
import { type App, TFile } from "obsidian";

import type { CategoryTracker } from "../../../core/category-tracker";
import type { CalendarSettingsStore } from "../../../core/settings-store";

export function getCategoryExpression(category: string, categoryProp: string): string {
	const escapedCategory = category.replace(/'/g, "\\'");
	return `${categoryProp}.includes('${escapedCategory}')`;
}

interface CategoryBulkOperationOptions {
	app: App;
	categoryTracker: CategoryTracker;
	settingsStore: CalendarSettingsStore;
	categoryName: string;
	operationTitle: string;
	statusVerb: string;
	bulkFn: (
		app: App,
		files: TFile[],
		categoryName: string,
		categoryProp: string,
		callbacks: { onProgress: (n: number) => void; onComplete: () => void }
	) => Promise<CategoryOperationResult>;
	updateColorRules: <T extends { expression: string }>(rules: T[], categoryProp: string) => T[];
	onSuccess: () => void;
}

async function runCategoryBulkOperation({
	app,
	categoryTracker,
	settingsStore,
	categoryName,
	operationTitle,
	statusVerb,
	bulkFn,
	updateColorRules,
	onSuccess,
}: CategoryBulkOperationOptions): Promise<void> {
	const settings = settingsStore.currentSettings;
	const events = categoryTracker.getEventsWithCategory(categoryName);
	const files = events
		.map((event) => app.vault.getAbstractFileByPath(event.ref.filePath))
		.filter((file): file is TFile => file instanceof TFile);

	const progress = showProgressModal({
		app,
		cssPrefix: "prisma-",
		total: files.length,
		title: `${operationTitle}...`,
		statusTemplate: `${operationTitle} {current} of {total}...`,
		initialDetails: `Processing "${categoryName}"...`,
	});

	try {
		const result = await bulkFn(app, files, categoryName, settings.categoryProp, {
			onProgress: (completed: number) => progress.updateProgress(completed),
			onComplete: () => setTimeout(onSuccess, 150),
		});

		await settingsStore.updateSettings((s) => ({
			...s,
			colorRules: updateColorRules(s.colorRules, s.categoryProp),
		}));

		if (result.filesWithErrors.length > 0) {
			console.error(`[CategoryOperation] Errors in ${statusVerb} operation:`, result.filesWithErrors);
			progress.showComplete([
				`Successfully ${statusVerb} category in ${result.filesModified.length} event(s)`,
				`${result.filesWithErrors.length} failed`,
			]);
		} else {
			progress.showComplete([`Successfully ${statusVerb} category in ${result.filesModified.length} event(s)`]);
		}
	} catch (error) {
		console.error(`[CategoryOperation] Error in ${statusVerb} operation:`, error);
		progress.showError(`Error ${statusVerb} category: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export function openCategoryRenameModal(
	app: App,
	categoryTracker: CategoryTracker,
	settingsStore: CalendarSettingsStore,
	categoryName: string,
	onSuccess: () => void
): void {
	const eventsWithCategory = categoryTracker.getEventsWithCategory(categoryName);

	void openRenameModal(app, {
		title: `Rename category (${eventsWithCategory.length} event(s))`,
		initialValue: "",
		testIdPrefix: "prisma-category-",
	}).then(async (newCategoryName) => {
		if (!newCategoryName || newCategoryName === categoryName) return;

		await runCategoryBulkOperation({
			app,
			categoryTracker,
			settingsStore,
			categoryName,
			operationTitle: "Renaming",
			statusVerb: "renamed",
			bulkFn: (a, files, catName, catProp, cbs) =>
				bulkRenameCategoryInFiles(a, files, catName, newCategoryName, catProp, cbs),
			updateColorRules: (rules, categoryProp) => {
				const oldExpr = getCategoryExpression(categoryName, categoryProp);
				const newExpr = getCategoryExpression(newCategoryName, categoryProp);
				return rules.map((rule) => (rule.expression === oldExpr ? { ...rule, expression: newExpr } : rule));
			},
			onSuccess,
		});
	});
}

export function openCategoryDeleteModal(
	app: App,
	categoryTracker: CategoryTracker,
	settingsStore: CalendarSettingsStore,
	categoryName: string,
	onSuccess: () => void
): void {
	const eventsWithCategory = categoryTracker.getEventsWithCategory(categoryName);

	const message =
		eventsWithCategory.length > 0
			? `Are you sure you want to delete "${categoryName}"? This will remove the category from ${eventsWithCategory.length} event(s).`
			: `Are you sure you want to delete "${categoryName}"? This category is not currently used in any events.`;

	void openConfirmation(app, {
		title: "Delete category",
		message,
		confirmLabel: "Delete",
		destructive: true,
		testIdPrefix: "prisma-category-delete-",
	}).then(async (confirmed) => {
		if (!confirmed) return;

		await runCategoryBulkOperation({
			app,
			categoryTracker,
			settingsStore,
			categoryName,
			operationTitle: "Deleting",
			statusVerb: "deleted",
			bulkFn: (a, files, catName, catProp, cbs) => bulkDeleteCategoryFromFiles(a, files, catName, catProp, cbs),
			updateColorRules: (rules, categoryProp) => {
				const expr = getCategoryExpression(categoryName, categoryProp);
				return rules.filter((rule) => rule.expression !== expr);
			},
			onSuccess,
		});
	});
}
