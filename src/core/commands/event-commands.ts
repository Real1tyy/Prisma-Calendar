import type { App } from "obsidian";
import { TFile } from "obsidian";
import {
	applyStartEndOffsets,
	ensureFileHasZettelId,
	generateUniqueEventPath,
	removeZettelId,
	setEventBasics,
} from "../../utils/calendar-events";
import { sanitizeForFilename } from "../../utils/file-utils";
import { getInternalProperties } from "../../utils/format";
import { backupFrontmatter, getTFileOrThrow, restoreFrontmatter, withFrontmatter } from "../../utils/obsidian";
import type { CalendarBundle } from "../calendar-bundle";
import type { Command } from "./command";

export interface EventData {
	filePath: string | null;
	title: string;
	start: string;
	end?: string;
	allDay?: boolean;
	preservedFrontmatter: Record<string, unknown>;
}

export interface EditEventData extends EventData {}

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

		const title = this.eventData.title || `Event ${this.clickedDate?.toISOString().split("T")[0]}`;
		const sanitizedTitle = sanitizeForFilename(title);
		const { filename } = generateUniqueEventPath(this.app, this.targetDirectory, sanitizedTitle);

		const file = await this.bundle.templateService.createFile({
			title,
			targetDirectory: this.targetDirectory,
			filename,
		});

		this.createdFilePath = file.path;

		await withFrontmatter(this.app, file, (fm) => {
			Object.assign(fm, this.eventData.preservedFrontmatter);
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
		private bundle: CalendarBundle,
		private filePath: string,
		private newEventData: EditEventData
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);
		await withFrontmatter(this.app, file, (fm) => {
			const settings = this.bundle.settingsStore.currentSettings;
			const internalProps = getInternalProperties(settings);
			const handledKeys = new Set<string>();

			// First pass: update or delete existing properties (preserves order)
			for (const key of Object.keys(fm)) {
				if (internalProps.has(key)) {
					continue;
				}

				if (key in this.newEventData.preservedFrontmatter) {
					// Update existing property
					fm[key] = this.newEventData.preservedFrontmatter[key];
					handledKeys.add(key);
				} else {
					// Delete properties not in preservedFrontmatter
					delete fm[key];
				}
			}

			// Second pass: add new properties that weren't in original
			for (const [key, value] of Object.entries(this.newEventData.preservedFrontmatter)) {
				if (!handledKeys.has(key)) {
					fm[key] = value;
				}
			}
		});
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

		let src = getTFileOrThrow(this.app, this.sourceFilePath);
		const settings = this.bundle.settingsStore.currentSettings;

		// Ensure source file has ZettelID (embed if missing)
		const sourceResult = await ensureFileHasZettelId(this.app, src, settings.zettelIdProp);
		src = sourceResult.file;

		const content = await this.app.vault.read(src);
		const baseNameWithoutZettel = removeZettelId(src.basename);
		const directory = src.parent?.path || "";
		const { fullPath, zettelId } = generateUniqueEventPath(this.app, directory, baseNameWithoutZettel);

		await this.app.vault.create(fullPath, content);
		this.clonedFilePath = fullPath;

		const cloned = this.app.vault.getAbstractFileByPath(fullPath);
		if (!(cloned instanceof TFile)) return;

		await withFrontmatter(this.app, cloned, (fm) => {
			applyStartEndOffsets(fm, settings, this.startOffset, this.endOffset);
			if (settings.zettelIdProp) {
				fm[settings.zettelIdProp] = zettelId;
			}
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
