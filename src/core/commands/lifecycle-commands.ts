import type { Command } from "@real1ty-obsidian-plugins";
import {
	backupFrontmatter,
	createFileAtPath,
	ensureDirectory,
	extractContentAfterFrontmatter,
	getTFileOrThrow,
	getUniqueFilePathFromFull,
	restoreFrontmatter,
	sanitizeForFilename,
} from "@real1ty-obsidian-plugins";
import type { DurationLike } from "luxon";
import type { App } from "obsidian";
import { getFrontMatterInfo, parseYaml, TFile } from "obsidian";

import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { computeMovePath, ensureFileHasZettelId, generateUniqueEventPath } from "../../utils/event-naming";
import { removeZettelId } from "../../utils/events/zettel-id";
import { applyStartEndOffsets } from "../../utils/frontmatter/basics";
import { removeNonCloneableProperties } from "../../utils/frontmatter/props";
import { translateFrontmatterToCalendar } from "../../utils/frontmatter/translate-calendar";
import type { CalendarBundle } from "../calendar-bundle";
import type { EventFileRepository, FrontmatterSnapshot } from "../event-file-repository";

export interface EventData {
	filePath: string | null;
	title: string;
	start: string;
	end?: string | undefined;
	allDay?: boolean | undefined;
	preservedFrontmatter: Frontmatter;
}

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

	// Parse frontmatter from the just-read file content rather than metadataCache —
	// the cache can be stale immediately after ensureFileHasZettelId rewrites the file.
	const fmInfo = getFrontMatterInfo(content);
	const frontmatter: Frontmatter = fmInfo.exists ? ((parseYaml(fmInfo.frontmatter) as Frontmatter | null) ?? {}) : {};
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
			...(settings.templatePath ? { templatePath: settings.templatePath, useTemplater: true } : {}),
		});

		this.createdFilePath = file.path;
	}

	getType() {
		return "create-event";
	}
}

export class DeleteEventCommand implements Command {
	private snapshot: FrontmatterSnapshot | null = null;

	constructor(
		private repo: EventFileRepository,
		private filePath: string
	) {}

	async execute(): Promise<void> {
		this.snapshot = await this.repo.snapshotByPath(this.filePath);
		await this.repo.deleteByPath(this.filePath);
	}

	async undo(): Promise<void> {
		if (!this.snapshot) throw new Error("Cannot undo: no snapshot stored");
		await this.repo.restoreSnapshot(this.snapshot);
	}

	getType() {
		return "delete-event";
	}

	canUndo(): boolean {
		return this.snapshot !== null;
	}
}

export class MoveEventToCalendarCommand implements Command {
	private originalFrontmatter: Frontmatter | null = null;
	private originalFilePath: string;
	private newFilePath: string | null = null;

	constructor(
		private app: App,
		private fromSettings: SingleCalendarConfig,
		private toSettings: SingleCalendarConfig,
		filePath: string
	) {
		this.originalFilePath = filePath;
	}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.originalFilePath);
		this.originalFrontmatter ??= await backupFrontmatter(this.app, file);

		await ensureDirectory(this.app, this.toSettings.directory);
		const targetPath = computeMovePath(this.app, file, this.toSettings.directory);
		await this.app.fileManager.renameFile(file, targetPath);
		this.newFilePath = targetPath;

		const movedFile = getTFileOrThrow(this.app, targetPath);
		const translated = translateFrontmatterToCalendar(this.originalFrontmatter, this.fromSettings, this.toSettings);
		await restoreFrontmatter(this.app, movedFile, translated);
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter || !this.newFilePath) return;

		const movedFile = getTFileOrThrow(this.app, this.newFilePath);
		await restoreFrontmatter(this.app, movedFile, this.originalFrontmatter);
		await this.app.fileManager.renameFile(movedFile, this.originalFilePath);
		this.newFilePath = null;
	}

	getType(): string {
		return "move-event-to-calendar";
	}

	canUndo(): boolean {
		return this.originalFrontmatter !== null && this.newFilePath !== null;
	}

	getMovedFilePath(): string | null {
		return this.newFilePath;
	}
}

export class CloneEventCommand extends CreatedFileCommand {
	constructor(
		app: App,
		private bundle: CalendarBundle,
		private sourceFilePath: string,
		private startOffset?: DurationLike,
		private endOffset?: DurationLike
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
