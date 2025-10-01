import { generateUniqueFilePath, sanitizeForFilename } from "@real1ty-obsidian-plugins/utils/file-utils";
import { type App, Menu, Notice, TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import { CloneEventCommand, DeleteEventCommand, EditEventCommand, MoveEventCommand } from "../core/commands";
import { calculateWeekOffsets } from "../core/commands/batch-commands";
import { EventEditModal } from "./event-edit-modal";
import { EventPreviewModal } from "./event-preview-modal";

export class EventContextMenu {
	private app: App;
	private bundle: CalendarBundle;

	constructor(app: App, bundle: CalendarBundle) {
		this.app = app;
		this.bundle = bundle;
	}

	private getFilePathOrNotice(event: any, operation: string): string | null {
		const filePath = event.extendedProps?.filePath;
		if (!filePath) {
			new Notice(`Failed to ${operation}: No file path found`);
			return null;
		}
		return filePath;
	}

	show(e: MouseEvent, info: any): void {
		const menu = new Menu();
		const event = info.event;
		const filePath = event.extendedProps.filePath;

		menu.addItem((item) => {
			item
				.setTitle("Enlarge")
				.setIcon("maximize-2")
				.onClick(() => {
					this.openEventPreview(event);
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item
				.setTitle("Edit event")
				.setIcon("edit")
				.onClick(() => {
					this.openEventEditModal(event);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Duplicate event")
				.setIcon("copy")
				.onClick(() => {
					this.duplicateEvent(event);
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item
				.setTitle("Move to next week")
				.setIcon("arrow-right")
				.onClick(() => {
					this.moveEventByWeeks(event, 1);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Clone to next week")
				.setIcon("copy-plus")
				.onClick(() => {
					this.cloneEventByWeeks(event, 1);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Move to previous week")
				.setIcon("arrow-left")
				.onClick(() => {
					this.moveEventByWeeks(event, -1);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Clone to previous week")
				.setIcon("copy-minus")
				.onClick(() => {
					this.cloneEventByWeeks(event, -1);
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item
				.setTitle("Delete event")
				.setIcon("trash")
				.onClick(() => {
					this.deleteEvent(event);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Open file")
				.setIcon("file-text")
				.onClick(() => {
					this.app.workspace.openLinkText(filePath, "", false);
				});
		});

		menu.showAtMouseEvent(e);
	}

	async moveEventByWeeks(event: any, weeks: number): Promise<void> {
		const filePath = this.getFilePathOrNotice(event, "move event");
		if (!filePath) return;

		try {
			const [startOffset, endOffset] = calculateWeekOffsets(weeks);
			const command = new MoveEventCommand(this.app, this.bundle, filePath, startOffset, endOffset);

			await this.bundle.commandManager.executeCommand(command);

			const direction = weeks > 0 ? "next" : "previous";
			new Notice(`Event moved to ${direction} week`);
		} catch (error) {
			console.error("Failed to move event:", error);
			new Notice("Failed to move event");
		}
	}

	async cloneEventByWeeks(event: any, weeks: number): Promise<void> {
		const filePath = this.getFilePathOrNotice(event, "clone event");
		if (!filePath) return;

		try {
			const [startOffset, endOffset] = calculateWeekOffsets(weeks);
			const command = new CloneEventCommand(this.app, this.bundle, filePath, startOffset, endOffset);

			await this.bundle.commandManager.executeCommand(command);

			const direction = weeks > 0 ? "next" : "previous";
			new Notice(`Event cloned to ${direction} week`);
		} catch (error) {
			console.error("Failed to clone event:", error);
			new Notice("Failed to clone event");
		}
	}

	async duplicateEvent(event: any): Promise<void> {
		const filePath = this.getFilePathOrNotice(event, "duplicate event");
		if (!filePath) return;

		try {
			// Use CloneEventCommand without offsets for duplication
			const command = new CloneEventCommand(this.app, this.bundle, filePath);

			await this.bundle.commandManager.executeCommand(command);

			new Notice("Event duplicated");
		} catch (error) {
			console.error("Failed to duplicate event:", error);
			new Notice("Failed to duplicate event");
		}
	}

	async deleteEvent(event: any): Promise<void> {
		const filePath = this.getFilePathOrNotice(event, "delete event");
		if (!filePath) return;

		try {
			const command = new DeleteEventCommand(this.app, this.bundle, filePath);

			await this.bundle.commandManager.executeCommand(command);

			new Notice("Event deleted successfully");
		} catch (error) {
			console.error("Failed to delete event:", error);
			new Notice("Failed to delete event");
		}
	}

	private openEventPreview(event: any): void {
		new EventPreviewModal(this.app, this.bundle, event).open();
	}

	private openEventEditModal(event: any): void {
		new EventEditModal(this.app, this.bundle, event, (updatedEvent) => {
			this.updateEventFile(updatedEvent);
		}).open();
	}

	private async updateEventFile(eventData: any): Promise<void> {
		const { filePath } = eventData;
		if (!filePath) {
			new Notice("Failed to update event: No file path found");
			return;
		}

		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) {
				new Notice(`File not found: ${filePath}`);
				return;
			}

			// Handle file renaming when titleProp is undefined/empty
			const settings = this.bundle.settingsStore.currentSettings;
			let finalFilePath = filePath;
			if (eventData.title && !settings.titleProp) {
				const sanitizedTitle = sanitizeForFilename(eventData.title);
				if (sanitizedTitle && sanitizedTitle !== file.basename) {
					const parentPath = file.parent?.path || "";
					const newFilePath = generateUniqueFilePath(this.app, parentPath, sanitizedTitle);
					await this.app.fileManager.renameFile(file, newFilePath);
					finalFilePath = newFilePath;
				}
			}

			const command = new EditEventCommand(this.app, this.bundle, finalFilePath, eventData);
			await this.bundle.commandManager.executeCommand(command);

			new Notice("Event updated successfully");
		} catch (error) {
			console.error("Failed to update event:", error);
			new Notice("Failed to update event");
		}
	}
}
