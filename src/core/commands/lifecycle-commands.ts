import type { Command } from "@real1ty-obsidian-plugins";
import {
	createFileAtPath,
	extractContentAfterFrontmatter,
	getTFileOrThrow,
	getUniqueFilePathFromFull,
	sanitizeForFilename,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { TFile } from "obsidian";

import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { applyStartEndOffsets, removeNonCloneableProperties } from "../../utils/event-frontmatter";
import { ensureFileHasZettelId, generateUniqueEventPath, removeZettelId } from "../../utils/event-naming";
import type { CalendarBundle } from "../calendar-bundle";

export interface EventData {
	filePath: string | null;
	title: string;
	start: string;
	end?: string;
	allDay?: boolean;
	preservedFrontmatter: Frontmatter;
}

export type EditEventData = EventData;

/** Shared base for commands that create a new file and support undo by trashing it. */
abstract class CreatedFileCommand implements Command {
	protected createdFilePath: string | null = null;

	constructor(protected app: App) {}

	protected isAlreadyCreated(): boolean {
		if (!this.createdFilePath) return false;
		return this.app.vault.getAbstractFileByPath(this.createdFilePath) instanceof TFile;
	}

	async undo(): Promise<void> {
		if (!this.createdFilePath) return;
		const f = this.app.vault.getAbstractFileByPath(this.createdFilePath);
		if (f instanceof TFile) await this.app.fileManager.trashFile(f);
	}

	canUndo(): boolean {
		if (!this.createdFilePath) return false;
		return this.app.vault.getAbstractFileByPath(this.createdFilePath) instanceof TFile;
	}

	getCreatedFilePath(): string | null {
		return this.createdFilePath;
	}

	abstract execute(): Promise<void>;
	abstract getType(): string;
}

/** Reads a source file and returns the pieces needed to create a copy with a new zettel ID. */
async function prepareFileCopy(
	app: App,
	sourceFile: TFile,
	settings: SingleCalendarConfig
): Promise<{ fullPath: string; zettelId: string; frontmatter: Frontmatter; body: string }> {
	const content = await app.vault.read(sourceFile);
	const baseNameWithoutZettel = removeZettelId(sourceFile.basename);
	const directory = sourceFile.parent?.path || "";
	const { fullPath, zettelId } = generateUniqueEventPath(app, directory, baseNameWithoutZettel);

	const cache = app.metadataCache.getFileCache(sourceFile);
	const frontmatter: Frontmatter = cache?.frontmatter ? { ...cache.frontmatter } : {};
	const body = extractContentAfterFrontmatter(content);

	if (settings.zettelIdProp) {
		frontmatter[settings.zettelIdProp] = zettelId;
	}

	return { fullPath, zettelId, frontmatter, body };
}

export class CreateEventCommand extends CreatedFileCommand {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private eventData: EventData,
		private targetDirectory: string
	) {
		super(app);
	}

	async execute(): Promise<void> {
		if (this.isAlreadyCreated()) return;

		const title = this.eventData.title;
		const sanitizedTitle = sanitizeForFilename(title, { style: "preserve" });
		const { filename, zettelId } = generateUniqueEventPath(this.app, this.targetDirectory, sanitizedTitle);

		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = { ...this.eventData.preservedFrontmatter };

		if (settings.zettelIdProp) {
			frontmatter[settings.zettelIdProp] = zettelId;
		}

		const file = await this.bundle.templateService.createFileAtomic({
			title,
			targetDirectory: this.targetDirectory,
			filename,
			frontmatter,
			templatePath: settings.templatePath,
			useTemplater: !!settings.templatePath,
		});

		this.createdFilePath = file.path;
	}

	getType() {
		return "create-event";
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

export class CloneEventCommand extends CreatedFileCommand {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private sourceFilePath: string,
		private startOffset?: number,
		private endOffset?: number
	) {
		super(app);
	}

	async execute(): Promise<void> {
		if (this.isAlreadyCreated()) return;

		let src = getTFileOrThrow(this.app, this.sourceFilePath);
		const settings = this.bundle.settingsStore.currentSettings;

		const sourceResult = await ensureFileHasZettelId(this.app, src, settings.zettelIdProp);
		src = sourceResult.file;

		const { fullPath, frontmatter, body } = await prepareFileCopy(this.app, src, settings);

		applyStartEndOffsets(frontmatter, settings, this.startOffset, this.endOffset);
		removeNonCloneableProperties(frontmatter, settings);

		const uniquePath = getUniqueFilePathFromFull(this.app, fullPath);
		const file = await createFileAtPath(this.app, uniquePath, body, frontmatter);
		this.createdFilePath = file.path;
	}

	getType() {
		return "clone-event";
	}
}

/**
 * Duplicates a physical recurring event instance.
 * Copies frontmatter (preserves RRuleID, Source, instanceDate) and marks as ignored for instance count.
 */
export class DuplicateRecurringEventCommand extends CreatedFileCommand {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private physicalFilePath: string
	) {
		super(app);
	}

	async execute(): Promise<void> {
		if (this.isAlreadyCreated()) return;

		const settings = this.bundle.settingsStore.currentSettings;
		const physicalFile = getTFileOrThrow(this.app, this.physicalFilePath);

		const { fullPath, frontmatter, body } = await prepareFileCopy(this.app, physicalFile, settings);

		// Mark as ignored so it doesn't count towards future instance generation
		frontmatter[settings.ignoreRecurringProp] = true;

		// Remove notification status so duplicated events can trigger notifications
		delete frontmatter[settings.alreadyNotifiedProp];

		const uniquePath = getUniqueFilePathFromFull(this.app, fullPath);
		const file = await createFileAtPath(this.app, uniquePath, body, frontmatter);
		this.createdFilePath = file.path;
	}

	getType() {
		return "duplicate-recurring-event";
	}
}
