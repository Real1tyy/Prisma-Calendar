import {
	backupFrontmatter,
	compareFrontmatter,
	extractContentAfterFrontmatter,
	getTFileOrThrow,
	restoreFrontmatter,
	toLocalISOString,
	type Command,
} from "@real1ty/obsidian-plugins";
import type { App, TFile } from "obsidian";

import type { EventDateTime, Frontmatter, SingleCalendarConfig } from "../../types";
import { ensureFileHasZettelId } from "../../utils/events/file-naming";
import { extractZettelId, rebuildPhysicalInstanceWithNewDate } from "../../utils/events/zettel-id";
import { setEventBasics } from "../../utils/frontmatter/basics";
import { withOrderedFrontmatter } from "../../utils/frontmatter/ordering";
import { isPhysicalRecurringEvent } from "../../utils/frontmatter/predicates";
import type { CalendarBundle } from "../calendar-bundle";
import type { EventFileRepository } from "../event-file-repository";
import type { EventData } from "./lifecycle-commands";

export class EditEventCommand implements Command {
	private originalFrontmatter: Frontmatter | null = null;
	private originalBodySnapshot: string | null = null;

	constructor(
		private app: App,
		private repo: EventFileRepository,
		private filePath: string,
		private newEventData: EventData
	) {}

	async execute(): Promise<void> {
		if (!this.originalFrontmatter) {
			const snapshot = await this.repo.snapshotByPath(this.filePath);
			this.originalFrontmatter = snapshot.data;
			if (this.newEventData.content !== undefined)
				this.originalBodySnapshot = extractContentAfterFrontmatter(snapshot.content);
		}
		const diff = compareFrontmatter(this.originalFrontmatter, this.newEventData.preservedFrontmatter);

		await this.repo.updateFrontmatterByPath(this.filePath, (fm: Frontmatter) => {
			for (const change of diff.deleted) {
				Reflect.deleteProperty(fm, change.key);
			}
			for (const change of diff.modified) {
				fm[change.key] = change.newValue;
			}
			for (const change of diff.added) {
				fm[change.key] = change.newValue;
			}
		});

		if (this.newEventData.content !== undefined)
			await this.repo.replaceBodyByPath(this.filePath, this.newEventData.content ?? "");
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) return;
		const file = getTFileOrThrow(this.app, this.filePath);
		if (this.originalBodySnapshot !== null) {
			await restoreFrontmatter(this.app, file, this.originalFrontmatter);
			await this.repo.replaceBodyByPath(this.filePath, this.originalBodySnapshot);
			return;
		}
		await restoreFrontmatter(this.app, file, this.originalFrontmatter);
	}

	getType() {
		return "edit-event";
	}

	canUndo(): boolean {
		return this.originalFrontmatter !== null;
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

		await withOrderedFrontmatter(this.app, file, settings, (fm: Frontmatter) => {
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

		await withOrderedFrontmatter(this.app, file, settings, (fm: Frontmatter) => {
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
		const ensured = await ensureFileHasZettelId(this.bundle.fileRepository, file, settings);
		file = ensured.file;

		if (!hadZettelId) {
			this.renamedFilePath = file.path;
		}

		await withOrderedFrontmatter(this.app, file, settings, (fm: Frontmatter) => Object.assign(fm, this.newFrontmatter));
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
		const result = await ensureFileHasZettelId(this.bundle.fileRepository, file, settings);

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
