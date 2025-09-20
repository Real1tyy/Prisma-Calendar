import type { App } from "obsidian";
import { TFile } from "obsidian";
import { sanitizeForFilename } from "@real1ty-obsidian-plugins/utils/file-utils";
import { generateZettelId } from "@real1ty-obsidian-plugins/utils/generate";
import type { CalendarBundle } from "../calendar-bundle";
import type { Command } from "./command";

/**
 * Event data structure for command operations
 */
export interface EventData {
	filePath: string | null;
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	preservedFrontmatter: Record<string, unknown>;
}

/**
 * Command to create a new event.
 * Stores all data needed to recreate or delete the event.
 */
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
			// Command already executed, ensure file exists
			const existingFile = this.app.vault.getAbstractFileByPath(this.createdFilePath);
			if (existingFile instanceof TFile) return;
		}

		const settings = this.bundle.settingsStore.currentSettings;

		// Generate filename
		const title =
			this.eventData.title ||
			`Event ${this.clickedDate?.toISOString().split("T")[0] || "Untitled"}`;
		const sanitizedTitle = sanitizeForFilename(title);
		const zettelId = generateZettelId();
		const filenameWithZettel = `${sanitizedTitle}-${zettelId}`;

		// Create file using template service
		const file = await this.bundle.templateService.createFile({
			title,
			targetDirectory: this.targetDirectory,
			filename: filenameWithZettel,
		});

		this.createdFilePath = file.path;

		// Set frontmatter using Obsidian API
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// Apply all preserved frontmatter
			Object.assign(fm, this.eventData.preservedFrontmatter);

			// Set event-specific properties
			if (this.eventData.title && settings.titleProp) {
				fm[settings.titleProp] = this.eventData.title;
			}
			fm[settings.startProp] = this.eventData.start;
			if (this.eventData.end && settings.endProp) {
				fm[settings.endProp] = this.eventData.end;
			}
			if (settings.allDayProp) {
				fm[settings.allDayProp] = this.eventData.allDay;
			}
			if (settings.zettelIdProp) {
				fm[settings.zettelIdProp] = zettelId;
			}
		});
	}

	async undo(): Promise<void> {
		if (!this.createdFilePath) return;

		const file = this.app.vault.getAbstractFileByPath(this.createdFilePath);
		if (file instanceof TFile) {
			await this.app.vault.delete(file);
		}
	}

	getDescription(): string {
		return `Create Event: ${this.eventData.title || "Untitled"}`;
	}

	getType(): string {
		return "create-event";
	}

	async canUndo(): Promise<boolean> {
		if (!this.createdFilePath) return false;
		const file = this.app.vault.getAbstractFileByPath(this.createdFilePath);
		return file instanceof TFile;
	}
}

/**
 * Command to delete an existing event.
 * Stores the file content to enable recreation.
 */
export class DeleteEventCommand implements Command {
	private originalContent: string | null = null;
	private originalPath: string;

	constructor(
		private app: App,
		_bundle: CalendarBundle,
		private filePath: string
	) {
		this.originalPath = filePath;
	}

	async execute(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${this.filePath}`);
		}

		// Store content for undo
		this.originalContent = await this.app.vault.read(file);

		// Delete the file
		await this.app.vault.delete(file);
	}

	async undo(): Promise<void> {
		if (!this.originalContent) {
			throw new Error("Cannot undo: original content not stored");
		}

		// Recreate the file with original content
		await this.app.vault.create(this.originalPath, this.originalContent);
	}

	getDescription(): string {
		const filename = this.originalPath.split("/").pop() || this.originalPath;
		return `Delete Event: ${filename}`;
	}

	getType(): string {
		return "delete-event";
	}

	async canUndo(): Promise<boolean> {
		// Can undo if we have the original content and file doesn't exist
		if (!this.originalContent) return false;
		const file = this.app.vault.getAbstractFileByPath(this.originalPath);
		return !(file instanceof TFile);
	}
}

/**
 * Command to edit an existing event.
 * Stores the previous frontmatter state for undo.
 */
export class EditEventCommand implements Command {
	private originalFrontmatter: Record<string, unknown> | null = null;

	constructor(
		private app: App,
		_bundle: CalendarBundle,
		private filePath: string,
		private newEventData: EventData
	) {}

	async execute(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${this.filePath}`);
		}

		// Store original frontmatter for undo
		if (!this.originalFrontmatter) {
			const content = await this.app.vault.read(file);
			const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
			if (frontmatterMatch) {
				// Parse the existing frontmatter to store original values
				this.originalFrontmatter = {};
				await this.app.fileManager.processFrontMatter(file, (fm) => {
					this.originalFrontmatter = { ...fm };
				});
			} else {
				this.originalFrontmatter = {};
			}
		}

		// Apply new frontmatter
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// Apply all preserved frontmatter from the edit
			Object.assign(fm, this.newEventData.preservedFrontmatter);
		});
	}

	async undo(): Promise<void> {
		if (!this.originalFrontmatter) {
			throw new Error("Cannot undo: original frontmatter not stored");
		}

		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${this.filePath}`);
		}

		// Restore original frontmatter
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// Clear current frontmatter and restore original
			Object.keys(fm).forEach((key) => {
				delete fm[key];
			});
			Object.assign(fm, this.originalFrontmatter);
		});
	}

	getDescription(): string {
		const filename = this.filePath.split("/").pop() || this.filePath;
		return `Edit Event: ${filename}`;
	}

	getType(): string {
		return "edit-event";
	}

	async canUndo(): Promise<boolean> {
		if (!this.originalFrontmatter) return false;
		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		return file instanceof TFile;
	}
}

/**
 * Command to move an event by a time offset.
 * Stores the original dates for undo.
 */
export class MoveEventCommand implements Command {
	private originalStart: string | null = null;
	private originalEnd: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private filePath: string,
		private startOffset: number, // milliseconds to add to start
		private endOffset: number, // milliseconds to add to end
		private description: string
	) {}

	async execute(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${this.filePath}`);
		}

		const settings = this.bundle.settingsStore.currentSettings;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// Store original values for undo
			if (this.originalStart === null) {
				this.originalStart = (fm[settings.startProp] as string) || null;
				this.originalEnd = (fm[settings.endProp] as string) || null;
			}

			// Apply time offsets
			if (fm[settings.startProp]) {
				const startDate = new Date(fm[settings.startProp] as string);
				startDate.setTime(startDate.getTime() + this.startOffset);
				fm[settings.startProp] = startDate.toISOString();
			}

			if (fm[settings.endProp]) {
				const endDate = new Date(fm[settings.endProp] as string);
				endDate.setTime(endDate.getTime() + this.endOffset);
				fm[settings.endProp] = endDate.toISOString();
			}
		});
	}

	async undo(): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${this.filePath}`);
		}

		const settings = this.bundle.settingsStore.currentSettings;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			// Restore original values
			if (this.originalStart !== null) {
				fm[settings.startProp] = this.originalStart;
			}
			if (this.originalEnd !== null) {
				fm[settings.endProp] = this.originalEnd;
			}
		});
	}

	getDescription(): string {
		return this.description;
	}

	getType(): string {
		return "move-event";
	}

	async canUndo(): Promise<boolean> {
		const file = this.app.vault.getAbstractFileByPath(this.filePath);
		return file instanceof TFile;
	}
}

/**
 * Command to clone/duplicate an event.
 * Creates a new file with modified dates.
 */
export class CloneEventCommand implements Command {
	private clonedFilePath: string | null = null;

	constructor(
		private app: App,
		private bundle: CalendarBundle,
		private sourceFilePath: string,
		private startOffset: number, // milliseconds to add to start
		private endOffset: number, // milliseconds to add to end
		private description: string
	) {}

	async execute(): Promise<void> {
		if (this.clonedFilePath) {
			// Command already executed, ensure file exists
			const existingFile = this.app.vault.getAbstractFileByPath(this.clonedFilePath);
			if (existingFile instanceof TFile) return;
		}

		const sourceFile = this.app.vault.getAbstractFileByPath(this.sourceFilePath);
		if (!(sourceFile instanceof TFile)) {
			throw new Error(`Source file not found: ${this.sourceFilePath}`);
		}

		// Read source content
		const sourceContent = await this.app.vault.read(sourceFile);

		// Generate new filename
		const baseName = sourceFile.basename;
		const zettelId = generateZettelId();
		const newName = `${baseName}-clone-${zettelId}.md`;
		const newPath = sourceFile.parent ? `${sourceFile.parent.path}/${newName}` : newName;

		// Create cloned file
		await this.app.vault.create(newPath, sourceContent);
		this.clonedFilePath = newPath;

		// Update dates in cloned file
		const clonedFile = this.app.vault.getAbstractFileByPath(newPath);
		if (!(clonedFile instanceof TFile)) return;

		const settings = this.bundle.settingsStore.currentSettings;
		await this.app.fileManager.processFrontMatter(clonedFile, (fm) => {
			// Apply time offsets to dates
			if (fm[settings.startProp]) {
				const startDate = new Date(fm[settings.startProp] as string);
				startDate.setTime(startDate.getTime() + this.startOffset);
				fm[settings.startProp] = startDate.toISOString();
			}

			if (fm[settings.endProp]) {
				const endDate = new Date(fm[settings.endProp] as string);
				endDate.setTime(endDate.getTime() + this.endOffset);
				fm[settings.endProp] = endDate.toISOString();
			}

			// Update zettel ID if used
			if (settings.zettelIdProp) {
				fm[settings.zettelIdProp] = zettelId;
			}
		});
	}

	async undo(): Promise<void> {
		if (!this.clonedFilePath) return;

		const clonedFile = this.app.vault.getAbstractFileByPath(this.clonedFilePath);
		if (clonedFile instanceof TFile) {
			await this.app.vault.delete(clonedFile);
		}
	}

	getDescription(): string {
		return this.description;
	}

	getType(): string {
		return "clone-event";
	}

	async canUndo(): Promise<boolean> {
		if (!this.clonedFilePath) return false;
		const file = this.app.vault.getAbstractFileByPath(this.clonedFilePath);
		return file instanceof TFile;
	}
}
