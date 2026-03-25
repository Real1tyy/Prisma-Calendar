import { parseIntoList } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";

import type { Frontmatter } from "../types";
import { getCalendarViewType } from "./calendar-view-type";

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
 * Trashes a file by path if it exists. Fire-and-forget — logs a warning and does not throw.
 */
export function trashDuplicateFile(app: App, filePath: string, context: string): void {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (file instanceof TFile) {
		console.warn(`[Prisma] Self-healing: trashing duplicate ${context}: ${filePath}`);
		void app.fileManager.trashFile(file);
	}
}

/**
 * Runs an async operation over a list of items in batches, yielding to the
 * main thread between batches so the UI stays responsive.
 */
export async function batchedPromiseAll<T>(
	items: T[],
	fn: (item: T) => Promise<void>,
	batchSize: number
): Promise<void> {
	for (let i = 0; i < items.length; i += batchSize) {
		const batch = items.slice(i, i + batchSize);
		await Promise.all(batch.map(fn));
		if (i + batchSize < items.length) {
			await new Promise((resolve) => window.setTimeout(resolve, 0));
		}
	}
}

/**
 * Deletes multiple files by their paths in small batches to avoid overwhelming
 * Obsidian's event loop. Each deletion triggers indexer events, so unbounded
 * parallelism can freeze or crash the app on large sets.
 */
export async function deleteFilesByPaths(
	app: App,
	filePaths: string[],
	batchSize = 10,
	onProgress?: (deleted: number, filePath: string) => void
): Promise<number> {
	let deleted = 0;
	await batchedPromiseAll(
		filePaths,
		async (filePath) => {
			try {
				const file = app.vault.getAbstractFileByPath(filePath);
				if (file instanceof TFile) {
					await app.fileManager.trashFile(file);
					deleted++;
					onProgress?.(deleted, filePath);
				}
			} catch (error) {
				console.error(`[Obsidian] Error deleting file ${filePath}:`, error);
			}
		},
		batchSize
	);
	return deleted;
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
		const error = new Error(`[Obsidian] File not found or is not a TFile: ${filePath}`);
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
		const error = new Error(`[Obsidian] File has no frontmatter: ${filePath}`);
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
		console.error(`[Obsidian] Error ${options.errorContext}:`, error);
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
