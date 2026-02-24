import {
	backupFrontmatter,
	compareFrontmatter,
	getTFileOrThrow,
	parseFrontmatterRecord,
	restoreFrontmatter,
	withFrontmatter,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { Command } from "@real1ty-obsidian-plugins";
import type { Frontmatter, SingleCalendarConfig } from "../../types";
import { ensureFileHasZettelId, extractZettelId, rebuildPhysicalInstanceWithNewDate } from "../../utils/event-naming";
import {
	applyStartEndOffsets,
	isPhysicalRecurringEvent,
	setEventBasics,
	shouldUpdateInstanceDateOnMove,
} from "../../utils/event-frontmatter";
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

export class UpdateFrontmatterCommand implements Command {
	private originalValues: Map<string, unknown> = new Map();
	private originalKeyOrder: string[] = [];

	constructor(
		private app: App,
		_bundle: CalendarBundle,
		private filePath: string,
		private propertyUpdates: Map<string, string | null>
	) {}

	async execute(): Promise<void> {
		const file = getTFileOrThrow(this.app, this.filePath);

		await withFrontmatter(this.app, file, (fm: Frontmatter) => {
			if (this.originalKeyOrder.length === 0) {
				this.originalKeyOrder = Object.keys(fm);
			}

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
			// Restore original values
			for (const [key, originalValue] of this.originalValues.entries()) {
				if (originalValue === undefined) {
					delete fm[key];
				} else {
					fm[key] = originalValue;
				}
			}

			// Rebuild object in original key order to preserve YAML property positions
			if (this.originalKeyOrder.length > 0) {
				const currentKeys = Object.keys(fm);
				const orderedKeys = [
					...this.originalKeyOrder.filter((k) => k in fm),
					...currentKeys.filter((k) => !this.originalKeyOrder.includes(k)),
				];

				const snapshot: Record<string, unknown> = {};
				for (const k of orderedKeys) {
					snapshot[k] = fm[k];
				}

				for (const k of currentKeys) {
					delete fm[k];
				}

				for (const k of orderedKeys) {
					fm[k] = snapshot[k];
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

export class ConvertFileToEventCommand implements Command {
	private originalFrontmatter?: Frontmatter;
	private originalFilePath: string;
	private renamedFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
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
		private filePath: string
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
