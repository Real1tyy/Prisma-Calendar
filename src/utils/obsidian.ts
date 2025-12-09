import type { App } from "obsidian";
import { TFile, TFolder } from "obsidian";
import { getCalendarViewType } from "../components/calendar-view";

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

export async function ensureFolderExists(app: App, folderPath: string): Promise<void> {
	const parts = folderPath.split("/");
	let currentPath = "";

	for (const part of parts) {
		currentPath = currentPath ? `${currentPath}/${part}` : part;
		const existing = app.vault.getAbstractFileByPath(currentPath);
		if (!existing) {
			await app.vault.createFolder(currentPath);
		} else if (!(existing instanceof TFolder)) {
			throw new Error(`Path ${currentPath} exists but is not a folder`);
		}
	}
}

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
