import { type App, TFile } from "obsidian";
import { getCalendarViewType } from "src/components/calendar-view";

export const getTFileOrThrow = (app: App, path: string): TFile => {
	const f = app.vault.getAbstractFileByPath(path);
	if (!(f instanceof TFile)) throw new Error(`File not found: ${path}`);
	return f;
};

export const withFrontmatter = async (app: App, file: TFile, update: (fm: Record<string, unknown>) => void) =>
	app.fileManager.processFrontMatter(file, update);

export const backupFrontmatter = async (app: App, file: TFile) => {
	let copy: Record<string, unknown> = {};
	await withFrontmatter(app, file, (fm) => {
		copy = { ...fm };
	});
	return copy;
};

export const restoreFrontmatter = async (app: App, file: TFile, original: Record<string, unknown>) =>
	withFrontmatter(app, file, (fm) => {
		Object.keys(fm).forEach((k) => {
			delete fm[k];
		});
		Object.assign(fm, original);
	});

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
