import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";
import { getCalendarViewType } from "../components/calendar-view";
import type { Frontmatter } from "../types";
import { parseIntoList } from "./list-utils";

export const emitHover = (
	app: App,
	containerEl: HTMLElement,
	targetEl: HTMLElement,
	jsEvent: MouseEvent,
	linktext: string,
	calendarId: string,
	sourcePath?: string
) =>
	app.workspace.trigger("hover-link", {
		event: jsEvent,
		source: getCalendarViewType(calendarId),
		hoverParent: containerEl,
		targetEl,
		linktext,
		sourcePath: sourcePath ?? app.workspace.getActiveFile()?.path ?? "",
	});

/**
 * Deletes multiple files by their paths using Promise.all.
 * Handles errors gracefully and continues deleting other files even if some fail.
 */
export async function deleteFilesByPaths(app: App, filePaths: string[]): Promise<void> {
	await Promise.all(
		filePaths.map(async (filePath) => {
			try {
				const file = app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
					await app.fileManager.trashFile(file);
				}
			} catch (error) {
				console.error(`Error deleting file ${filePath}:`, error);
			}
		})
	);
}

/**
 * Retrieves frontmatter from a file with retry logic to handle metadata cache race conditions.
 * This is useful when file events fire before the metadata cache has been updated.
 *
 * @param app The Obsidian app instance
 * @param file The file to retrieve frontmatter from
 * @param fallbackFrontmatter Initial frontmatter to use if available
 * @param options Retry configuration options
 * @returns The retrieved frontmatter, or the fallback if retries are exhausted
 */
export async function getFrontmatterWithRetry(
	app: App,
	file: TFile,
	fallbackFrontmatter: Frontmatter | undefined,
	options: { maxRetries?: number; delayMs?: number } = {}
): Promise<Frontmatter> {
	const { maxRetries = 5, delayMs = 100 } = options;

	// If fallback frontmatter exists and is not empty, use it immediately
	if (fallbackFrontmatter && Object.keys(fallbackFrontmatter).length > 0) {
		return fallbackFrontmatter;
	}

	// Otherwise, retry fetching from metadata cache
	for (let i = 0; i < maxRetries; i++) {
		const cache = app.metadataCache.getFileCache(file);
		if (cache?.frontmatter && Object.keys(cache.frontmatter).length > 0) {
			return cache.frontmatter as Frontmatter;
		}
		await new Promise((resolve) => window.setTimeout(resolve, delayMs));
	}

	// Return fallback (even if empty) if all retries exhausted
	return fallbackFrontmatter || {};
}

/**
 * Gets a TFile by path or throws an error if not found.
 * Assumes the file exists - use this when you're certain the file should be there.
 * @param app The Obsidian app instance
 * @param filePath The path of the file
 * @returns The TFile instance
 * @throws Error if file is not found or is not a TFile
 */
export function getFileByPathOrThrow(app: App, filePath: string): TFile {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) {
		const error = new Error(`File not found or is not a TFile: ${filePath}`);
		console.error(error);
		throw error;
	}
	return file;
}

/**
 * Gets a TFile and its frontmatter by path or throws an error if not found.
 * Assumes the file exists and has frontmatter - use this when you're certain both should be there.
 * @param app The Obsidian app instance
 * @param filePath The path of the file
 * @returns Object containing the TFile and its frontmatter
 * @throws Error if file is not found, is not a TFile, or has no frontmatter
 */
export function getFileAndFrontmatter(app: App, filePath: string): { file: TFile; frontmatter: Frontmatter } {
	const file = getFileByPathOrThrow(app, filePath);
	const metadata = app.metadataCache.getFileCache(file);
	const frontmatter = metadata?.frontmatter;

	if (!frontmatter) {
		const error = new Error(`File has no frontmatter: ${filePath}`);
		console.error(error);
		throw error;
	}

	return { file, frontmatter };
}

/**
 * Gets categories from a file path, parsing them and returning a list.
 * Returns empty array if no categories are found, categoryProp is undefined, or file doesn't exist.
 * This is a safe utility that handles missing files gracefully.
 * @param app The Obsidian app instance
 * @param filePath The path of the file
 * @param categoryProp The frontmatter property name for categories (can be undefined)
 * @returns Array of category names, or empty array if none found, categoryProp is undefined, or file doesn't exist
 */
export function getCategoriesFromFilePath(app: App, filePath: string, categoryProp: string | undefined): string[] {
	if (!categoryProp) {
		return [];
	}

	try {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			return [];
		}

		const cache = app.metadataCache.getFileCache(file);
		const categoryValue = cache?.frontmatter?.[categoryProp];
		if (!categoryValue) {
			return [];
		}
		return parseIntoList(categoryValue);
	} catch {
		return [];
	}
}

type LeafCreationStrategy = true | false | "window";

interface OpenFileOptions {
	errorContext: string;
	errorMessage: string;
}

/**
 * Template function for opening files with different leaf creation strategies.
 * @param app The Obsidian app instance
 * @param filePath The path of the file to open
 * @param leafStrategy The strategy for creating the leaf (true = new tab, false = current, "window" = new window)
 * @param options Error messages for different contexts
 * @returns Promise that resolves when the file is opened
 */
async function openFileWithStrategy(
	app: App,
	filePath: string,
	leafStrategy: LeafCreationStrategy,
	options: OpenFileOptions
): Promise<void> {
	try {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			new Notice(`File not found: ${filePath}`);
			return;
		}

		const leaf = app.workspace.getLeaf(leafStrategy);
		await leaf.openFile(file);
	} catch (error) {
		console.error(`Error ${options.errorContext}:`, error);
		new Notice(`${options.errorMessage}: ${filePath}`);
	}
}

/**
 * Opens a file in a new tab.
 * @param app The Obsidian app instance
 * @param filePath The path of the file to open
 * @returns Promise that resolves when the file is opened
 */
export async function openFileInNewTab(app: App, filePath: string): Promise<void> {
	return openFileWithStrategy(app, filePath, true, {
		errorContext: "opening file in new tab",
		errorMessage: "Failed to open file in new tab",
	});
}

/**
 * Opens a file in a new window.
 * @param app The Obsidian app instance
 * @param filePath The path of the file to open
 * @returns Promise that resolves when the file is opened
 */
export async function openFileInNewWindow(app: App, filePath: string): Promise<void> {
	return openFileWithStrategy(app, filePath, "window", {
		errorContext: "opening file in new window",
		errorMessage: "Failed to open file in new window",
	});
}
