import {
	backupFrontmatter,
	compareFrontmatter,
	createFileAtPath,
	extractContentAfterFrontmatter,
	getTFileOrThrow,
	getUniqueFilePathFromFull,
	parseFrontmatterRecord,
	restoreFrontmatter,
	sanitizeForFilename,
	withFrontmatter,
} from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { Frontmatter, SingleCalendarConfig } from "../../types";
import {
	applyStartEndOffsets,
	assignCategoriesToFrontmatter,
	ensureFileHasZettelId,
	generateUniqueEventPath,
	isPhysicalRecurringEvent,
	rebuildPhysicalInstanceWithNewDate,
	removeNonCloneableProperties,
	removeZettelId,
	setEventBasics,
	shouldUpdateInstanceDateOnMove,
} from "../../utils/calendar-events";
import type { CalendarBundle } from "../calendar-bundle";
import type { Command } from "./command";

export interface EventData {
	filePath: string | null;
	title: string;
	start: string;
	end?: string;
	allDay?: boolean;
	preservedFrontmatter: Frontmatter;
}

type EditEventData = EventData;

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
		const sanitizedTitle = sanitizeForFilename(title, { style: "preserve" });
		const { filename, zettelId } = generateUniqueEventPath(this.app, this.targetDirectory, sanitizedTitle);

		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = { ...this.eventData.preservedFrontmatter };

		if (settings.zettelIdProp) {
			frontmatter[settings.zettelIdProp] = zettelId;
		}

		const file = await this.bundle.templateService.createFile({
			title,
			targetDirectory: this.targetDirectory,
			filename,
			frontmatter,
			templatePath: settings.templatePath,
			useTemplater: !!settings.templatePath,
		});

		this.createdFilePath = file.path;
	}

	async undo(): Promise<void> {
		if (!this.createdFilePath) return;
		const f = this.app.vault.getAbstractFileByPath(this.createdFilePath);
		if (f instanceof TFile) await this.app.fileManager.trashFile(f);
	}

	getType() {
		return "create-event";
	}

	canUndo(): boolean {
		if (!this.createdFilePath) return false;
		return this.app.vault.getAbstractFileByPath(this.createdFilePath) instanceof TFile;
	}

	getCreatedFilePath(): string | null {
		return this.createdFilePath;
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

	canUndo(): boolean {
		if (!this.originalContent) return false;
		return !(this.app.vault.getAbstractFileByPath(this.originalPath) instanceof TFile);
	}
}

export class EditEventCommand implements Command {
	private originalFrontmatter?: Frontmatter;

	constructor(
		private app: App,
		private filePath: string,
		private newEventData: EditEventData
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);
		const diff = compareFrontmatter(this.originalFrontmatter, this.newEventData.preservedFrontmatter);

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			for (const change of diff.deleted) {
				delete fm[change.key];
			}

			for (const change of diff.modified) {
				fm[change.key] = change.newValue;
			}

			for (const change of diff.added) {
				fm[change.key] = change.newValue;
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

	canUndo(): boolean {
		return true;
	}
}

export class MoveEventCommand implements Command {
	private originalFrontmatter?: Frontmatter;

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
		await withFrontmatter(this.app, file, (fm: Frontmatter) =>
			applyStartEndOffsets(fm, settings, this.startOffset, this.endOffset)
		);
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;
		const file = getTFileOrThrow(this.app, this.filePath);
		await restoreFrontmatter(this.app, file, this.originalFrontmatter);
	}

	getType() {
		return "move-event";
	}

	canUndo(): boolean {
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

		const sourceResult = await ensureFileHasZettelId(this.app, src, settings.zettelIdProp);
		src = sourceResult.file;

		const content = await this.app.vault.read(src);
		const baseNameWithoutZettel = removeZettelId(src.basename);
		const directory = src.parent?.path || "";
		const { fullPath, zettelId } = generateUniqueEventPath(this.app, directory, baseNameWithoutZettel);

		const cache = this.app.metadataCache.getFileCache(src);
		const existingFrontmatter: Frontmatter = cache?.frontmatter ? { ...cache.frontmatter } : {};
		const body = extractContentAfterFrontmatter(content);

		applyStartEndOffsets(existingFrontmatter, settings, this.startOffset, this.endOffset);

		if (settings.zettelIdProp) {
			existingFrontmatter[settings.zettelIdProp] = zettelId;
		}

		removeNonCloneableProperties(existingFrontmatter, settings);
		const uniquePath = getUniqueFilePathFromFull(this.app, fullPath);
		const file = await createFileAtPath(this.app, uniquePath, body, existingFrontmatter);
		this.clonedFilePath = file.path;
	}

	async undo(): Promise<void> {
		if (!this.clonedFilePath) return;
		const f = this.app.vault.getAbstractFileByPath(this.clonedFilePath);
		if (f instanceof TFile) await this.app.fileManager.trashFile(f);
	}

	getType() {
		return "clone-event";
	}

	canUndo(): boolean {
		if (!this.clonedFilePath) return false;
		return this.app.vault.getAbstractFileByPath(this.clonedFilePath) instanceof TFile;
	}
}

/**
 * Duplicates a physical recurring event instance.
 * Copies frontmatter (preserves RRuleID, Source, instanceDate) and marks as ignored for instance count.
 */
export class DuplicateRecurringEventCommand implements Command {
	private createdFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private physicalFilePath: string
	) {}

	async execute(): Promise<void> {
		if (this.createdFilePath) {
			const existing = this.app.vault.getAbstractFileByPath(this.createdFilePath);
			if (existing instanceof TFile) return;
		}

		const settings = this.bundle.settingsStore.currentSettings;
		const physicalFile = getTFileOrThrow(this.app, this.physicalFilePath);

		// Read the full content of the physical file
		const content = await this.app.vault.read(physicalFile);

		// Generate unique path for the duplicate
		const baseNameWithoutZettel = removeZettelId(physicalFile.basename);
		const directory = physicalFile.parent?.path || "";
		const { fullPath, zettelId } = generateUniqueEventPath(this.app, directory, baseNameWithoutZettel);

		// Parse frontmatter and extract body content
		const cache = this.app.metadataCache.getFileCache(physicalFile);
		const existingFrontmatter: Frontmatter = cache?.frontmatter ? { ...cache.frontmatter } : {};
		const body = extractContentAfterFrontmatter(content);

		// Update zettelId to the new unique value
		if (settings.zettelIdProp) {
			existingFrontmatter[settings.zettelIdProp] = zettelId;
		}

		// Mark as ignored so it doesn't count towards future instance generation
		existingFrontmatter[settings.ignoreRecurringProp] = true;

		// Remove notification status so duplicated events can trigger notifications
		delete existingFrontmatter[settings.alreadyNotifiedProp];

		const uniquePath = getUniqueFilePathFromFull(this.app, fullPath);
		const file = await createFileAtPath(this.app, uniquePath, body, existingFrontmatter);
		this.createdFilePath = file.path;
	}

	async undo(): Promise<void> {
		if (!this.createdFilePath) return;
		const f = this.app.vault.getAbstractFileByPath(this.createdFilePath);
		if (f instanceof TFile) await this.app.fileManager.trashFile(f);
	}

	getType() {
		return "duplicate-recurring-event";
	}

	canUndo(): boolean {
		if (!this.createdFilePath) return false;
		return this.app.vault.getAbstractFileByPath(this.createdFilePath) instanceof TFile;
	}
}

export class UpdateEventCommand implements Command {
	private originalFrontmatter?: Frontmatter;
	private originalFilePath: string;
	private renamedFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		filePath: string,
		private newStart: string,
		private newEnd: string | undefined,
		private newAllDay: boolean,
		private oldStart: string,
		private oldEnd: string | undefined,
		private oldAllDay: boolean
	) {
		this.originalFilePath = filePath;
	}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.originalFilePath);
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

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			setEventBasics(fm, settings, {
				start: this.newStart,
				end: endTime,
				allDay: this.newAllDay,
			});
		});

		// Handle file rename for physical recurring events if date changed
		await this.handleFileRenameIfNeeded(file, settings);
	}

	private async handleFileRenameIfNeeded(file: TFile, settings: SingleCalendarConfig): Promise<void> {
		const metadata = this.app.metadataCache.getFileCache(file);
		const frontmatter = metadata?.frontmatter as Frontmatter | undefined;

		// Check if this is a physical recurring event
		if (!isPhysicalRecurringEvent(frontmatter, settings.rruleIdProp, settings.rruleProp, settings.instanceDateProp)) {
			return;
		}

		// Check if date actually changed (not just time)
		const oldDateStr = this.oldStart.split("T")[0];
		const newDateStr = this.newStart.split("T")[0];
		if (oldDateStr === newDateStr) return;

		// Only update instance date if this is an ignored/duplicated event
		if (shouldUpdateInstanceDateOnMove(frontmatter, settings.ignoreRecurringProp)) {
			await withFrontmatter(this.app, file, (fm) => {
				fm[settings.instanceDateProp] = newDateStr;
			});
		}

		// Always rename file to reflect new date for physical recurring events
		const newBasename = rebuildPhysicalInstanceWithNewDate(file.basename, newDateStr);
		if (!newBasename) return;

		const folderPath = file.parent?.path ? `${file.parent.path}/` : "";
		const newPath = `${folderPath}${newBasename}.md`;
		await this.app.fileManager.renameFile(file, newPath);
		this.renamedFilePath = newPath;
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;

		// Use renamed path if file was renamed, otherwise use original path
		const currentFilePath = this.renamedFilePath || this.originalFilePath;
		const file = getTFileOrThrow(this.app, currentFilePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			setEventBasics(fm, settings, {
				start: this.oldStart,
				end: this.oldEnd,
				allDay: this.oldAllDay,
			});
		});

		// Revert file rename if it was renamed
		if (this.renamedFilePath) {
			await this.app.fileManager.renameFile(file, this.originalFilePath);
			this.renamedFilePath = null;
		}
	}

	getType(): string {
		return "update-event-time";
	}

	canUndo(): boolean {
		return this.originalFrontmatter !== undefined;
	}
}

export class FillTimeCommand implements Command {
	private originalValue?: string;

	constructor(
		private app: App,
		_bundle: CalendarBundle,
		private filePath: string,
		private propertyName: string,
		private newTimeValue: string
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);

		// Backup original value
		if (this.originalValue === undefined) {
			const cache = this.app.metadataCache.getFileCache(file);
			const fm = cache?.frontmatter;
			this.originalValue = fm?.[this.propertyName] as string | undefined;
		}

		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm[this.propertyName] = this.newTimeValue;
		});
	}

	async undo(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);

		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			if (this.originalValue === undefined) {
				delete fm[this.propertyName];
			} else {
				fm[this.propertyName] = this.originalValue;
			}
		});
	}

	getType(): string {
		return "fill-time";
	}

	canUndo(): boolean {
		return this.app.vault.getAbstractFileByPath(this.filePath) instanceof TFile;
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

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
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

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
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

	canUndo(): boolean {
		return this.originalSkipValue !== undefined;
	}
}

export class MoveByCommand implements Command {
	private originalFrontmatter?: Frontmatter;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
		private offsetMs: number
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);

		const settings = this.bundle.settingsStore.currentSettings;
		await withFrontmatter(this.app, file, (fm: Frontmatter) =>
			applyStartEndOffsets(fm, settings, this.offsetMs, this.offsetMs)
		);
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;
		const file = getTFileOrThrow(this.app, this.filePath);
		await restoreFrontmatter(this.app, file, this.originalFrontmatter);
	}

	getType() {
		return "move-by";
	}

	canUndo(): boolean {
		return true;
	}
}

abstract class SetStatusCommand implements Command {
	private originalStatusValue?: string | undefined;

	constructor(
		protected app: App,
		protected bundle: CalendarBundle,
		protected filePath: string
	) {}

	protected abstract getNewStatusValue(settings: SingleCalendarConfig): string;
	abstract getType(): string;

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalStatusValue === undefined) {
				this.originalStatusValue = fm[settings.statusProperty] as string | undefined;
			}

			fm[settings.statusProperty] = this.getNewStatusValue(settings);
		});
	}

	async undo(): Promise<void> {
		if (this.originalStatusValue === undefined && this.originalStatusValue !== "") return;

		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalStatusValue === undefined) {
				delete fm[settings.statusProperty];
			} else {
				fm[settings.statusProperty] = this.originalStatusValue;
			}
		});
	}

	canUndo(): boolean {
		return this.originalStatusValue !== undefined || this.originalStatusValue === "";
	}
}

export class MarkAsDoneCommand extends SetStatusCommand {
	protected getNewStatusValue(settings: SingleCalendarConfig): string {
		return settings.doneValue;
	}

	getType(): string {
		return "mark-as-done";
	}
}

export class MarkAsUndoneCommand extends SetStatusCommand {
	protected getNewStatusValue(settings: SingleCalendarConfig): string {
		return settings.notDoneValue;
	}

	getType(): string {
		return "mark-as-undone";
	}
}

export class AssignCategoriesCommand implements Command {
	private originalCategoryValue?: string | string[] | undefined;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
		private categoriesToAdd: string[]
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalCategoryValue === undefined) {
				this.originalCategoryValue = fm[settings.categoryProp] as string | string[] | undefined;
			}

			assignCategoriesToFrontmatter(fm, settings.categoryProp, this.categoriesToAdd);
		});
	}

	async undo(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);
		const settings = this.bundle.settingsStore.currentSettings;

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalCategoryValue === undefined) {
				delete fm[settings.categoryProp];
			} else {
				fm[settings.categoryProp] = this.originalCategoryValue;
			}
		});
	}

	canUndo(): boolean {
		return true;
	}

	getType(): string {
		return "assign-categories";
	}
}

export class UpdateFrontmatterCommand implements Command {
	private originalValues: Map<string, unknown> = new Map();

	constructor(
		private app: App,
		_bundle: CalendarBundle,
		private filePath: string,
		private propertyUpdates: Map<string, string | null>
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			for (const [key, value] of this.propertyUpdates.entries()) {
				if (!this.originalValues.has(key)) {
					this.originalValues.set(key, fm[key]);
				}

				if (value === null) {
					delete fm[key];
				} else {
					const parsed = parseFrontmatterRecord({ [key]: value });
					fm[key] = parsed[key];
				}
			}
		});
	}

	async undo(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			for (const [key, originalValue] of this.originalValues.entries()) {
				if (originalValue === undefined) {
					delete fm[key];
				} else {
					fm[key] = originalValue;
				}
			}
		});
	}

	canUndo(): boolean {
		return this.originalValues.size > 0;
	}

	getType(): string {
		return "update-frontmatter";
	}
}
