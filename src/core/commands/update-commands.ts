import type { Command } from "@real1ty-obsidian-plugins";
import {
	backupFrontmatter,
	compareFrontmatter,
	getTFileOrThrow,
	restoreFrontmatter,
	toLocalISOString,
	withFrontmatter,
} from "@real1ty-obsidian-plugins";
import type { App, TFile } from "obsidian";

import type { Frontmatter, SingleCalendarConfig } from "../../types";
import {
	isPhysicalRecurringEvent,
	setEventBasics,
	shouldUpdateInstanceDateOnMove,
} from "../../utils/event-frontmatter";
import { ensureFileHasZettelId, extractZettelId, rebuildPhysicalInstanceWithNewDate } from "../../utils/event-naming";
import type { CalendarBundle } from "../calendar-bundle";
import type { EditEventData } from "./lifecycle-commands";

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

		let endTime = this.newEnd;
		if (!endTime && !this.newAllDay) {
			const startDate = new Date(this.newStart);
			startDate.setHours(startDate.getHours() + 1);
			endTime = toLocalISOString(startDate);
		}

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			setEventBasics(fm, settings, {
				start: this.newStart,
				end: endTime,
				allDay: this.newAllDay,
			});
		});

		await this.handleFileRenameIfNeeded(file, settings);
	}

	private async handleFileRenameIfNeeded(file: TFile, settings: SingleCalendarConfig): Promise<void> {
		const metadata = this.app.metadataCache.getFileCache(file);
		const frontmatter = metadata?.frontmatter as Frontmatter | undefined;

		if (!isPhysicalRecurringEvent(frontmatter, settings.rruleIdProp, settings.rruleProp, settings.instanceDateProp)) {
			return;
		}

		const oldDateStr = this.oldStart.split("T")[0];
		const newDateStr = this.newStart.split("T")[0];
		if (oldDateStr === newDateStr) return;

		if (shouldUpdateInstanceDateOnMove(frontmatter, settings.ignoreRecurringProp)) {
			await withFrontmatter(this.app, file, (fm) => {
				fm[settings.instanceDateProp] = newDateStr;
			});
		}

		const newBasename = rebuildPhysicalInstanceWithNewDate(file.basename, newDateStr);
		if (!newBasename) return;

		const folderPath = file.parent?.path ? `${file.parent.path}/` : "";
		const newPath = `${folderPath}${newBasename}.md`;
		await this.app.fileManager.renameFile(file, newPath);
		this.renamedFilePath = newPath;
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;

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

export class ConvertFileToEventCommand implements Command {
	private originalFrontmatter?: Frontmatter;
	private originalFilePath: string;
	private renamedFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		filePath: string,
		private newFrontmatter: Frontmatter
	) {
		this.originalFilePath = filePath;
	}

	async execute(): Promise<void> {
		let file = getTFileOrThrow(this.app, this.originalFilePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);

		const settings = this.bundle.settingsStore.currentSettings;
		const hadZettelId = !!extractZettelId(file.basename);
		const ensured = await ensureFileHasZettelId(this.app, file, settings.zettelIdProp);
		file = ensured.file;

		if (!hadZettelId) {
			this.renamedFilePath = file.path;
		}

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			Object.assign(fm, this.newFrontmatter);
		});
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;

		const currentPath = this.renamedFilePath ?? this.originalFilePath;
		const file = getTFileOrThrow(this.app, currentPath);

		await restoreFrontmatter(this.app, file, this.originalFrontmatter);

		if (this.renamedFilePath) {
			await this.app.fileManager.renameFile(file, this.originalFilePath);
			this.renamedFilePath = null;
		}
	}

	getType(): string {
		return "convert-file-to-event";
	}

	canUndo(): boolean {
		return this.originalFrontmatter !== undefined;
	}
}

export class AddZettelIdCommand implements Command {
	private originalFrontmatter?: Frontmatter;
	private originalFilePath: string;
	private renamedFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		filePath: string
	) {
		this.originalFilePath = filePath;
	}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.originalFilePath);
		if (!this.originalFrontmatter) this.originalFrontmatter = await backupFrontmatter(this.app, file);

		const settings = this.bundle.settingsStore.currentSettings;
		const result = await ensureFileHasZettelId(this.app, file, settings.zettelIdProp);

		if (result.file.path !== this.originalFilePath) {
			this.renamedFilePath = result.file.path;
		}
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;

		const currentPath = this.renamedFilePath ?? this.originalFilePath;
		const file = getTFileOrThrow(this.app, currentPath);

		await restoreFrontmatter(this.app, file, this.originalFrontmatter);

		if (this.renamedFilePath) {
			await this.app.fileManager.renameFile(file, this.originalFilePath);
			this.renamedFilePath = null;
		}
	}

	getType(): string {
		return "add-zettel-id";
	}

	canUndo(): boolean {
		return this.originalFrontmatter !== undefined;
	}

	getRenamedFilePath(): string | null {
		return this.renamedFilePath;
	}
}
