import type { App } from "obsidian";
import { TFolder } from "obsidian";
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
