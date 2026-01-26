import type { App, TFile } from "obsidian";
import { formatListLikeOriginal, parseIntoList } from "../utils/list-utils";

export interface CategoryOperationResult {
	filesModified: string[];
	filesWithErrors: { filePath: string; error: string }[];
}

export interface CategoryOperationOptions {
	onProgress?: (completed: number, total: number) => void;
	onComplete?: () => void;
}

function transformCategoryProperty(propertyValue: unknown, transform: (categories: string[]) => string[]): unknown {
	if (propertyValue === undefined || propertyValue === null) {
		return propertyValue;
	}

	if (!Array.isArray(propertyValue) && typeof propertyValue !== "string") {
		return propertyValue;
	}

	const categories = parseIntoList(propertyValue);
	const updated = transform(categories);
	return formatListLikeOriginal(updated, propertyValue);
}

export function removeCategoryFromProperty(propertyValue: unknown, categoryName: string): unknown {
	return transformCategoryProperty(propertyValue, (categories) => categories.filter((c) => c !== categoryName));
}

export function renameCategoryInProperty(
	propertyValue: unknown,
	oldCategoryName: string,
	newCategoryName: string
): unknown {
	return transformCategoryProperty(propertyValue, (categories) =>
		categories.map((c) => (c === oldCategoryName ? newCategoryName : c))
	);
}

export async function deleteCategoryFromFile(
	app: App,
	file: TFile,
	categoryName: string,
	categoryProp: string
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		if (fm[categoryProp]) {
			const updated = removeCategoryFromProperty(fm[categoryProp], categoryName);
			if (updated === undefined || (Array.isArray(updated) && updated.length === 0)) {
				delete fm[categoryProp];
			} else {
				fm[categoryProp] = updated;
			}
		}
	});
}

export async function renameCategoryInFile(
	app: App,
	file: TFile,
	oldCategoryName: string,
	newCategoryName: string,
	categoryProp: string
): Promise<void> {
	await app.fileManager.processFrontMatter(file, (fm) => {
		if (fm[categoryProp]) {
			fm[categoryProp] = renameCategoryInProperty(fm[categoryProp], oldCategoryName, newCategoryName);
		}
	});
}

async function bulkCategoryOperation(
	files: TFile[],
	operation: (file: TFile) => Promise<void>,
	options?: CategoryOperationOptions
): Promise<CategoryOperationResult> {
	const filesModified: string[] = [];
	const filesWithErrors: { filePath: string; error: string }[] = [];

	const total = files.length;
	let completed = 0;

	const updatePromises = files.map(async (file) => {
		try {
			await operation(file);
			filesModified.push(file.path);
			completed++;
			options?.onProgress?.(completed, total);
		} catch (error) {
			filesWithErrors.push({
				filePath: file.path,
				error: error instanceof Error ? error.message : String(error),
			});
			completed++;
			options?.onProgress?.(completed, total);
		}
	});

	await Promise.all(updatePromises);
	options?.onComplete?.();

	return { filesModified, filesWithErrors };
}

export async function bulkDeleteCategoryFromFiles(
	app: App,
	files: TFile[],
	categoryName: string,
	categoryProp: string,
	options?: CategoryOperationOptions
): Promise<CategoryOperationResult> {
	return bulkCategoryOperation(files, (file) => deleteCategoryFromFile(app, file, categoryName, categoryProp), options);
}

export async function bulkRenameCategoryInFiles(
	app: App,
	files: TFile[],
	oldCategoryName: string,
	newCategoryName: string,
	categoryProp: string,
	options?: CategoryOperationOptions
): Promise<CategoryOperationResult> {
	return bulkCategoryOperation(
		files,
		(file) => renameCategoryInFile(app, file, oldCategoryName, newCategoryName, categoryProp),
		options
	);
}
