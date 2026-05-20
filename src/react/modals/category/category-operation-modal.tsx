import { describeError, showProgressModal, type MacroCommand } from "@real1ty-obsidian-plugins";
import { openConfirmation, openRenameModal } from "@real1ty-obsidian-plugins-react";
import { Notice, type App } from "obsidian";
import { memo } from "react";

import { cls, CSS_PREFIX, tid } from "../../../constants";
import type { CalendarBundle } from "../../../core/calendar-bundle";
import type { CategoryTracker } from "../../../core/category-tracker";
import { getCategoryExpression } from "../../../utils/filters/expressions";
import {
	createBatchDeleteCategory,
	createBatchRenameCategory,
	UpdateColorRulesCommand,
} from "./../../../core/commands";

interface UntrackedToggleProps {
	value: boolean;
	untrackedCount: number;
	onChange: (next: boolean) => void;
}

const UntrackedToggle = memo(function UntrackedToggle({ value, untrackedCount, onChange }: UntrackedToggleProps) {
	if (untrackedCount === 0) return null;
	return (
		<label
			className={cls("category-operation-untracked-toggle")}
			data-testid={tid("category-include-untracked-label")}
			style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "12px" }}
		>
			<input
				type="checkbox"
				checked={value}
				onChange={(e) => onChange(e.target.checked)}
				data-testid={tid("category-include-untracked-toggle")}
			/>
			<span>
				Also apply to {untrackedCount} untracked event{untrackedCount === 1 ? "" : "s"} with this category
			</span>
		</label>
	);
});

function resolveTargetPaths(
	categoryTracker: CategoryTracker,
	categoryName: string,
	includeUntracked: boolean
): string[] {
	return includeUntracked
		? categoryTracker.getFilePathsWithCategory(categoryName)
		: categoryTracker.getEventsWithCategory(categoryName).map((e) => e.ref.filePath);
}

function showUndoNotice(message: string, bundle: CalendarBundle): void {
	const notice = new Notice("", 10000);
	const doc = activeDocument;
	const frag = doc.createDocumentFragment();
	frag.appendText(`${message} `);
	const link = doc.createElement("a");
	link.textContent = "Undo";
	link.className = cls("undo-link");
	link.addEventListener("click", () => {
		void bundle.undo();
		notice.hide();
	});
	frag.appendChild(link);
	notice.setMessage(frag);
}

interface RunOptions {
	app: App;
	bundle: CalendarBundle;
	macro: MacroCommand;
	operationTitle: string;
	statusVerb: string;
	categoryName: string;
	successMessage: string;
}

async function executeCategoryMacro({
	app,
	bundle,
	macro,
	operationTitle,
	statusVerb,
	categoryName,
	successMessage,
}: RunOptions): Promise<void> {
	const total = macro.getCommandCount();
	const progress = showProgressModal({
		app,
		cssPrefix: CSS_PREFIX,
		total,
		title: `${operationTitle}...`,
		statusTemplate: `${operationTitle} {current} of {total}...`,
		initialDetails: `Processing "${categoryName}"...`,
	});

	try {
		await macro.executeWithProgress((completed) => progress.updateProgress(completed));
		await bundle.commandManager.registerExecutedCommand(macro);

		const summary = macro.getExecutionSummary();
		if (summary.failCount > 0) {
			console.error(`[CategoryOperation] Errors in ${statusVerb} operation:`, summary.errors);
			progress.showComplete([
				`Successfully ${statusVerb} category in ${summary.successCount} event(s)`,
				`${summary.failCount} failed`,
			]);
		} else {
			progress.showComplete([`Successfully ${statusVerb} category in ${summary.successCount} event(s)`]);
			showUndoNotice(successMessage, bundle);
		}
	} catch (error) {
		console.error(`[CategoryOperation] Error in ${statusVerb} operation:`, error);
		progress.showError(`Error ${statusVerb} category: ${describeError(error)}`);
	}
}

export function runCategoryRenameFlow(
	app: App,
	bundle: CalendarBundle,
	categoryName: string,
	onSuccess: () => void
): void {
	const { categoryTracker, settingsStore } = bundle;
	const stats = categoryTracker.getCategoryStats(categoryName);
	const trackedCount = stats.timed + stats.allDay;

	void openRenameModal<{ includeUntracked: boolean }>(app, {
		title: `Rename category (${stats.total} event${stats.total === 1 ? "" : "s"})`,
		initialValue: "",
		description: `Renaming will update ${stats.total} event${stats.total === 1 ? "" : "s"} that use "${categoryName}".`,
		testIdPrefix: tid("category-"),
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

		const filePaths = resolveTargetPaths(categoryTracker, categoryName, extras.includeUntracked);
		const categoryProp = settingsStore.currentSettings.categoryProp;
		const oldExpr = getCategoryExpression(categoryName, categoryProp);
		const newExpr = getCategoryExpression(newName, categoryProp);

		const macro = createBatchRenameCategory(bundle, filePaths, categoryName, newName);
		macro.addCommand(
			new UpdateColorRulesCommand(
				settingsStore,
				(rules) => rules.map((rule) => (rule.expression === oldExpr ? { ...rule, expression: newExpr } : rule)),
				"rename-category-color-rule"
			)
		);

		await executeCategoryMacro({
			app,
			bundle,
			macro,
			operationTitle: trackedCount === 0 && extras.includeUntracked ? "Renaming untracked" : "Renaming",
			statusVerb: "renamed",
			categoryName,
			successMessage: `Renamed "${categoryName}" → "${newName}".`,
		});
		onSuccess();
	});
}

export function runCategoryDeleteFlow(
	app: App,
	bundle: CalendarBundle,
	categoryName: string,
	onSuccess: () => void
): void {
	const { categoryTracker, settingsStore } = bundle;
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
		testIdPrefix: tid("category-delete-"),
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

		const filePaths = resolveTargetPaths(categoryTracker, categoryName, result.extras.includeUntracked);
		const categoryProp = settingsStore.currentSettings.categoryProp;
		const expr = getCategoryExpression(categoryName, categoryProp);

		const macro = createBatchDeleteCategory(bundle, filePaths, categoryName);
		macro.addCommand(
			new UpdateColorRulesCommand(
				settingsStore,
				(rules) => rules.filter((rule) => rule.expression !== expr),
				"delete-category-color-rule"
			)
		);

		await executeCategoryMacro({
			app,
			bundle,
			macro,
			operationTitle: "Deleting",
			statusVerb: "deleted",
			categoryName,
			successMessage: `Deleted "${categoryName}".`,
		});
		onSuccess();
	});
}
