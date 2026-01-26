import type { App } from "obsidian";
import { TFile } from "obsidian";

/**
 * Waits for a file to be accessible and readable by Obsidian's cache.
 * This is necessary because Templater creates files asynchronously.
 */
export async function waitForFileReady(app: App, filePath: string, timeoutMs = 5000): Promise<TFile | null> {
	const started = Date.now();

	while (Date.now() - started < timeoutMs) {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (file instanceof TFile) {
			// Check if file is readable by trying to get its metadata
			const metadata = app.metadataCache.getFileCache(file);
			if (metadata !== null && metadata !== undefined) {
				return file;
			}
		}
		await new Promise((r) => setTimeout(r, 50));
	}

	return null;
}

/**
 * Gets a TFile by path or throws an error if not found.
 * Useful when you need to ensure a file exists before proceeding.
 */
export const getTFileOrThrow = (app: App, path: string): TFile => {
	const f = app.vault.getAbstractFileByPath(path);
	if (!(f instanceof TFile)) throw new Error(`File not found: ${path}`);
	return f;
};

/**
 * Executes an operation on a file's frontmatter.
 * Wrapper around Obsidian's processFrontMatter for more concise usage.
 */
export const withFrontmatter = async (app: App, file: TFile, update: (fm: Record<string, unknown>) => void) =>
	app.fileManager.processFrontMatter(file, update);

/**
 * Creates a backup copy of a file's frontmatter.
 * Useful for undo/redo operations or temporary modifications.
 */
export const backupFrontmatter = async (app: App, file: TFile) => {
	let copy: Record<string, unknown> = {};
	await withFrontmatter(app, file, (fm) => {
		copy = { ...fm };
	});
	return copy;
};

/**
 * Restores a file's frontmatter from a backup.
 * Clears existing frontmatter and replaces with the backup.
 */
export const restoreFrontmatter = async (app: App, file: TFile, original: Record<string, unknown>) =>
	withFrontmatter(app, file, (fm) => {
		for (const k of Object.keys(fm)) {
			delete fm[k];
		}
		Object.assign(fm, original);
	});

/**
 * Extracts the content that appears after the frontmatter section.
 * Returns the entire content if no frontmatter is found.
 */
export const extractContentAfterFrontmatter = (fullContent: string): string => {
	const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
	const match = fullContent.match(frontmatterRegex);

	if (match) {
		// Return content after frontmatter
		return fullContent.substring(match.index! + match[0].length);
	}

	// If no frontmatter found, return the entire content
	return fullContent;
};
