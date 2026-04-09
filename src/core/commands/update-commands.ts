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

import type { EventDateTime, Frontmatter, SingleCalendarConfig } from "../../types";
import { isPhysicalRecurringEvent, setEventBasics } from "../../utils/event-frontmatter";
import { ensureFileHasZettelId, extractZettelId, rebuildPhysicalInstanceWithNewDate } from "../../utils/event-naming";
import type { CalendarBundle } from "../calendar-bundle";
import type { EventFileRepository, FrontmatterSnapshot } from "../event-file-repository";
import type { EventData } from "./lifecycle-commands";

export class EditEventCommand implements Command {
	private snapshot: FrontmatterSnapshot | null = null;

	constructor(
		private repo: EventFileRepository,
		private filePath: string,
		private newEventData: EventData
	) {}

	async execute(): Promise<void> {
		if (!this.snapshot) this.snapshot = await this.repo.snapshotByPath(this.filePath);
		const diff = compareFrontmatter(this.snapshot.data, this.newEventData.preservedFrontmatter);

		await this.repo.updateFrontmatterByPath(this.filePath, (fm: Frontmatter) => {
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
		if (!this.snapshot) return;
		await this.repo.restoreSnapshot(this.snapshot);
	}

	getType() {
		return "edit-event";
	}

	canUndo(): boolean {
		return this.snapshot !== null;
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
		private newDateTime: EventDateTime,
		private oldDateTime: EventDateTime
	) {
		this.originalFilePath = filePath;
	}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.originalFilePath);
		if (!this.originalFrontmatter) {
			this.originalFrontmatter = await backupFrontmatter(this.app, file);
		}

		const settings = this.bundle.settingsStore.currentSettings;

		let endTime = this.newDateTime.end;
		if (!endTime && !this.newDateTime.allDay) {
			const startDate = new Date(this.newDateTime.start);
			startDate.setHours(startDate.getHours() + 1);
			endTime = toLocalISOString(startDate);
		}

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			setEventBasics(fm, settings, {
				start: this.newDateTime.start,
				end: endTime,
				allDay: this.newDateTime.allDay,
			});
		});

		await this.renameInstanceFileIfNeeded(file, settings);
	}

	private async renameInstanceFileIfNeeded(file: TFile, settings: SingleCalendarConfig): Promise<void> {
		if (
			!isPhysicalRecurringEvent(
				this.originalFrontmatter,
				settings.rruleIdProp,
				settings.rruleProp,
				settings.instanceDateProp
			)
		) {
			return;
		}

		const oldDateStr = this.oldDateTime.start.split("T")[0];
		const newDateStr = this.newDateTime.start.split("T")[0];
		if (oldDateStr === newDateStr) return;

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
				start: this.oldDateTime.start,
				end: this.oldDateTime.end,
				allDay: this.oldDateTime.allDay,
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
