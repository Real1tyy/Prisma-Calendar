import { sanitizeForFilename } from "@real1ty-obsidian-plugins/utils/file-utils";
import { generateZettelId } from "@real1ty-obsidian-plugins/utils/generate";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import { applyStartEndOffsets, setEventBasics } from "../../utils/calendar-events";
import { backupFrontmatter, getTFileOrThrow, restoreFrontmatter, withFrontmatter } from "../../utils/obsidian";
import type { CalendarBundle } from "../calendar-bundle";
import type { Command } from "./command";

export interface EventData {
	filePath: string | null;
	title: string;
	start: string;
	end?: string;
	allDay?: boolean;
}

export interface EditEventData extends EventData {
	preservedFrontmatter: Record<string, unknown>;
}

export class CreateEventCommand implements Command {
	private createdFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private eventData: EventData,
		private targetDirectory: string,
		private clickedDate?: Date
	) {}

	async execute(): Promise<void> {
		if (this.createdFilePath) {
			const existing = this.app.vault.getAbstractFileByPath(this.createdFilePath);
			if (existing instanceof TFile) return;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const title = this.eventData.title || `Event ${this.clickedDate?.toISOString().split("T")[0]}`;
		const zettelId = generateZettelId();
		const filename = `${sanitizeForFilename(title)}-${zettelId}`;

		const file = await this.bundle.templateService.createFile({
			title,
			targetDirectory: this.targetDirectory,
			filename,
		});

		this.createdFilePath = file.path;

		await withFrontmatter(this.app, file, (fm) => {
			setEventBasics(fm, settings, {
				title: this.eventData.title,
				start: this.eventData.start,
				end: this.eventData.end,
				allDay: this.eventData.allDay,
				zettelId,
			});
		});
	}

	async undo(): Promise<void> {
		if (!this.createdFilePath) return;
		const f = this.app.vault.getAbstractFileByPath(this.createdFilePath);
		if (f instanceof TFile) await this.app.fileManager.trashFile(f);
	}

	getType() {
		return "create-event";
	}

	async canUndo() {
		if (!this.createdFilePath) return false;
		return this.app.vault.getAbstractFileByPath(this.createdFilePath) instanceof TFile;
	}
}

export class DeleteEventCommand implements Command {
	private originalContent: string | null = null;
	private readonly originalPath: string;

	constructor(
		private app: App,
		_bundle: CalendarBundle,
		private filePath: string
	) {
		this.originalPath = filePath;
	}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		this.originalContent = await this.app.vault.read(file);
		await this.app.fileManager.trashFile(file);
	}

	async undo(): Promise<void> {
		if (!this.originalContent) throw new Error("Cannot undo: original content not stored");
		await this.app.vault.create(this.originalPath, this.originalContent);
	}

	getType() {
		return "delete-event";
	}

	async canUndo() {
		if (!this.originalContent) return false;
		return !(this.app.vault.getAbstractFileByPath(this.originalPath) instanceof TFile);
	}
}

export class EditEventCommand implements Command {
	private originalFrontmatter?: Record<string, unknown>;

	constructor(
		private app: App,
		_bundle: CalendarBundle,
		private filePath: string,
		private newEventData: EditEventData
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);
		await withFrontmatter(this.app, file, (fm) => Object.assign(fm, this.newEventData.preservedFrontmatter));
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;
		const file = getTFileOrThrow(this.app, this.filePath);
		await restoreFrontmatter(this.app, file, this.originalFrontmatter);
	}

	getType() {
		return "edit-event";
	}

	async canUndo(): Promise<boolean> {
		return true;
	}
}

export class MoveEventCommand implements Command {
	private originalFrontmatter?: Record<string, unknown>;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
		private startOffset: number,
		private endOffset: number
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);

		const settings = this.bundle.settingsStore.currentSettings;
		await withFrontmatter(this.app, file, (fm) => applyStartEndOffsets(fm, settings, this.startOffset, this.endOffset));
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;
		const file = getTFileOrThrow(this.app, this.filePath);
		await restoreFrontmatter(this.app, file, this.originalFrontmatter);
	}

	getType() {
		return "move-event";
	}

	async canUndo(): Promise<boolean> {
		return true;
	}
}

export class CloneEventCommand implements Command {
	private clonedFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private sourceFilePath: string,
		private startOffset?: number,
		private endOffset?: number
	) {}

	async execute(): Promise<void> {
		if (this.clonedFilePath) {
			const existing = this.app.vault.getAbstractFileByPath(this.clonedFilePath);
			if (existing instanceof TFile) return;
		}
		const src = getTFileOrThrow(this.app, this.sourceFilePath);
		const content = await this.app.vault.read(src);

		const zettelId = generateZettelId();
		// Remove existing ZettelID from basename and replace with new one
		const baseNameWithoutZettel = src.basename.replace(/-\d{14}$/, "");
		const newName = `${baseNameWithoutZettel}-${zettelId}.md`;
		const newPath = src.parent ? `${src.parent.path}/${newName}` : newName;

		await this.app.vault.create(newPath, content);
		this.clonedFilePath = newPath;

		const cloned = this.app.vault.getAbstractFileByPath(newPath);
		if (!(cloned instanceof TFile)) return;

		const settings = this.bundle.settingsStore.currentSettings;
		await withFrontmatter(this.app, cloned, (fm) => {
			applyStartEndOffsets(fm, settings, this.startOffset, this.endOffset);
			if (settings.zettelIdProp) fm[settings.zettelIdProp] = zettelId;
		});
	}

	async undo(): Promise<void> {
		if (!this.clonedFilePath) return;
		const f = this.app.vault.getAbstractFileByPath(this.clonedFilePath);
		if (f instanceof TFile) await this.app.fileManager.trashFile(f);
	}

	getType() {
		return "clone-event";
	}

	async canUndo() {
		if (!this.clonedFilePath) return false;
		return this.app.vault.getAbstractFileByPath(this.clonedFilePath) instanceof TFile;
	}
}

export class UpdateEventCommand implements Command {
	private originalFrontmatter?: Record<string, unknown>;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
		private newStart: string,
		private newEnd: string | undefined,
		private newAllDay: boolean,
		private oldStart: string,
		private oldEnd: string | undefined,
		private oldAllDay: boolean
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		if (!this.originalFrontmatter) {
			this.originalFrontmatter = await backupFrontmatter(this.app, file);
		}

		const settings = this.bundle.settingsStore.currentSettings;

		// Generate end time if not provided (e.g., when converting from all-day)
		let endTime = this.newEnd;
		if (!endTime && !this.newAllDay) {
			const startDate = new Date(this.newStart);
			startDate.setHours(startDate.getHours() + 1);
			endTime = startDate.toISOString();
		}

		await withFrontmatter(this.app, file, (fm) => {
			setEventBasics(fm, settings, {
				start: this.newStart,
				end: endTime,
				allDay: this.newAllDay,
			});
		});
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;

		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm) => {
			setEventBasics(fm, settings, {
				start: this.oldStart,
				end: this.oldEnd,
				allDay: this.oldAllDay,
			});
		});
	}

	getType(): string {
		return "update-event-time";
	}

	async canUndo(): Promise<boolean> {
		return this.originalFrontmatter !== undefined;
	}
}

export class ToggleSkipCommand implements Command {
	private originalSkipValue?: boolean;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		if (!settings.skipProp) {
			throw new Error("Skip property not configured in settings");
		}

		await withFrontmatter(this.app, file, (fm) => {
			// Store original value on first execution
			if (this.originalSkipValue === undefined) {
				this.originalSkipValue = fm[settings.skipProp] === true;
			}

			// Toggle: if currently true or missing, set to true; if false, remove property
			const currentValue = fm[settings.skipProp] === true;
			if (currentValue) {
				delete fm[settings.skipProp];
			} else {
				fm[settings.skipProp] = true;
			}
		});
	}

	async undo(): Promise<void> {
		if (this.originalSkipValue === undefined) return;

		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		if (!settings.skipProp) return;

		await withFrontmatter(this.app, file, (fm) => {
			if (this.originalSkipValue) {
				fm[settings.skipProp] = true;
			} else {
				delete fm[settings.skipProp];
			}
		});
	}

	getType(): string {
		return "toggle-skip";
	}

	async canUndo(): Promise<boolean> {
		return this.originalSkipValue !== undefined;
	}
}
