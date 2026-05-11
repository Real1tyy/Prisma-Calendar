import {
	bulkDeleteCategoryFromFiles,
	bulkRenameCategoryInFiles,
	type CategoryOperationResult,
	showProgressModal,
} from "@real1ty-obsidian-plugins";
import { openConfirmation, openRenameModal } from "@real1ty-obsidian-plugins-react";
import { type App, TFile } from "obsidian";
import { memo } from "react";

import type { CategoryTracker } from "../../../core/category-tracker";
import type { CalendarSettingsStore } from "../../../core/settings-store";

export function getCategoryExpression(category: string, categoryProp: string): string {
	const escapedCategory = category.replace(/'/g, "\\'");
	return `${categoryProp}.includes('${escapedCategory}')`;
}

interface UntrackedToggleProps {
	value: boolean;
	untrackedCount: number;
	onChange: (next: boolean) => void;
}

const UntrackedToggle = memo(function UntrackedToggle({ value, untrackedCount, onChange }: UntrackedToggleProps) {
	if (untrackedCount === 0) return null;
	return (
		<label
			className="prisma-category-operation-untracked-toggle"
			data-testid="prisma-category-include-untracked-label"
			style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}
		>
			<input
				type="checkbox"
				checked={value}
				onChange={(e) => onChange(e.target.checked)}
				data-testid="prisma-category-include-untracked-toggle"
			/>
			<span>
				Also apply to {untrackedCount} untracked event{untrackedCount === 1 ? "" : "s"} with this category
			</span>
		</label>
	);
});

interface CategoryBulkOperationOptions {
	app: App;
	categoryTracker: CategoryTracker;
	settingsStore: CalendarSettingsStore;
	categoryName: string;
	includeUntracked: boolean;
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
	includeUntracked,
	operationTitle,
	statusVerb,
	bulkFn,
	updateColorRules,
	onSuccess,
}: CategoryBulkOperationOptions): Promise<void> {
	const settings = settingsStore.currentSettings;
	const paths = includeUntracked
		? categoryTracker.getFilePathsWithCategory(categoryName)
		: categoryTracker.getEventsWithCategory(categoryName).map((e) => e.ref.filePath);
	const files = paths
		.map((path) => app.vault.getAbstractFileByPath(path))
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
	const stats = categoryTracker.getCategoryStats(categoryName);
	const trackedCount = stats.timed + stats.allDay;

	void openRenameModal<{ includeUntracked: boolean }>(app, {
		title: `Rename category (${stats.total} event${stats.total === 1 ? "" : "s"})`,
		initialValue: "",
		description: `Renaming will update ${stats.total} event${stats.total === 1 ? "" : "s"} that use "${categoryName}".`,
		testIdPrefix: "prisma-category-",
		initialExtras: { includeUntracked: true },
		renderExtras: (state, setState) => (
			<UntrackedToggle
				value={state.includeUntracked}
				untrackedCount={stats.untracked}
				onChange={(includeUntracked) => setState({ includeUntracked })}
			/>
		),
	}).then(async (result) => {
		if (!result || result.value === categoryName) return;
		const { value: newName, extras } = result;

		await runCategoryBulkOperation({
			app,
			categoryTracker,
			settingsStore,
			categoryName,
			includeUntracked: extras.includeUntracked,
			operationTitle: trackedCount === 0 && extras.includeUntracked ? "Renaming untracked" : "Renaming",
			statusVerb: "renamed",
			bulkFn: (a, files, catName, catProp, cbs) => bulkRenameCategoryInFiles(a, files, catName, newName, catProp, cbs),
			updateColorRules: (rules, categoryProp) => {
				const oldExpr = getCategoryExpression(categoryName, categoryProp);
				const newExpr = getCategoryExpression(newName, categoryProp);
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
	const stats = categoryTracker.getCategoryStats(categoryName);
	const trackedCount = stats.timed + stats.allDay;

	const message =
		trackedCount + stats.untracked > 0
			? `Are you sure you want to delete "${categoryName}"? This will remove the category from ${trackedCount} tracked event(s).`
			: `Are you sure you want to delete "${categoryName}"? This category is not currently used in any events.`;

	void openConfirmation<{ includeUntracked: boolean }>(app, {
		title: "Delete category",
		message,
		confirmLabel: "Delete",
		destructive: true,
		testIdPrefix: "prisma-category-delete-",
		initialExtras: { includeUntracked: true },
		renderExtras: (state, setState) => (
			<UntrackedToggle
				value={state.includeUntracked}
				untrackedCount={stats.untracked}
				onChange={(includeUntracked) => setState({ includeUntracked })}
			/>
		),
	}).then(async (result) => {
		if (!result) return;

		await runCategoryBulkOperation({
			app,
			categoryTracker,
			settingsStore,
			categoryName,
			includeUntracked: result.extras.includeUntracked,
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
