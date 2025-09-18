import { type App, Menu, Notice, type TFile } from "obsidian";
import { duplicateFileWithNewZettelId, withFile, withFileOperation } from "utils/file-operations";
import { generateUniqueFilePath, getFilenameFromPath, sanitizeForFilename } from "utils/file-utils";
import { generateDuplicatedTitle } from "utils/string-utils";
import type { CalendarBundle } from "../core/calendar-bundle";
import { EventEditModal } from "./event-edit-modal";

export class EventContextMenu {
	private app: App;
	private bundle: CalendarBundle;

	constructor(app: App, bundle: CalendarBundle) {
		this.app = app;
		this.bundle = bundle;
	}

	show(e: MouseEvent, info: any): void {
		const menu = new Menu();
		const event = info.event;
		const filePath = event.extendedProps.filePath;

		menu.addItem((item) => {
			item
				.setTitle("Edit Event")
				.setIcon("edit")
				.onClick(() => {
					this.openEventEditModal(event);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Duplicate Event")
				.setIcon("copy")
				.onClick(() => {
					this.duplicateEvent(event);
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item
				.setTitle("Move to Next Week")
				.setIcon("arrow-right")
				.onClick(() => {
					this.moveEventByWeeks(event, 1);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Clone to Next Week")
				.setIcon("copy-plus")
				.onClick(() => {
					this.cloneEventByWeeks(event, 1);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Move to Previous Week")
				.setIcon("arrow-left")
				.onClick(() => {
					this.moveEventByWeeks(event, -1);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Clone to Previous Week")
				.setIcon("copy-minus")
				.onClick(() => {
					this.cloneEventByWeeks(event, -1);
				});
		});

		menu.addSeparator();

		menu.addItem((item) => {
			item
				.setTitle("Delete Event")
				.setIcon("trash")
				.onClick(() => {
					this.deleteEvent(event);
				});
		});

		menu.addItem((item) => {
			item
				.setTitle("Open File")
				.setIcon("file-text")
				.onClick(() => {
					this.app.workspace.openLinkText(filePath, "", false);
				});
		});

		menu.showAtMouseEvent(e);
	}

	async moveEventByWeeks(event: any, weeks: number): Promise<void> {
		await withFileOperation(
			this.app,
			event,
			async (file) => {
				await this.moveFileEventByWeeks(file, weeks);
				const direction = weeks > 0 ? "next" : "previous";
				new Notice(`Event moved to ${direction} week`);
			},
			"Failed to move event"
		);
	}

	private async moveFileEventByWeeks(file: TFile, weeks: number): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		const daysToAdd = weeks * 7;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			if (fm[settings.startProp]) {
				const startDate = new Date(fm[settings.startProp]);
				startDate.setDate(startDate.getDate() + daysToAdd);
				fm[settings.startProp] = startDate.toISOString();
			}

			if (fm[settings.endProp]) {
				const endDate = new Date(fm[settings.endProp]);
				endDate.setDate(endDate.getDate() + daysToAdd);
				fm[settings.endProp] = endDate.toISOString();
			}
		});
	}

	async cloneEventByWeeks(event: any, weeks: number): Promise<void> {
		await withFileOperation(
			this.app,
			event,
			async (file) => {
				const settings = this.bundle.settingsStore.currentSettings;
				const clonedFile = await duplicateFileWithNewZettelId(
					this.app,
					file,
					settings.zettelIdProp
				);
				await this.moveFileEventByWeeks(clonedFile, weeks);
				const fileName = getFilenameFromPath(clonedFile.path);
				const direction = weeks > 0 ? "next" : "previous";
				new Notice(`Event cloned to ${direction} week: ${fileName}`);
			},
			"Failed to clone event"
		);
	}

	async duplicateEvent(event: any): Promise<void> {
		await withFileOperation(
			this.app,
			event,
			async (file) => {
				const settings = this.bundle.settingsStore.currentSettings;
				const duplicatedFile = await duplicateFileWithNewZettelId(
					this.app,
					file,
					settings.zettelIdProp
				);
				await this.updateDuplicateTitle(duplicatedFile, file.basename);
				const fileName = getFilenameFromPath(duplicatedFile.path);
				new Notice(`Event duplicated: ${fileName}`);
			},
			"Failed to duplicate event"
		);
	}

	private async updateDuplicateTitle(file: TFile, originalBasename: string): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.titleProp) return;

		await this.app.fileManager.processFrontMatter(file, (fm) => {
			const currentTitle = fm[settings.titleProp!] || originalBasename;
			fm[settings.titleProp!] = generateDuplicatedTitle(currentTitle);
		});
	}

	async deleteEvent(event: any): Promise<void> {
		await withFileOperation(
			this.app,
			event,
			async (file) => {
				await this.app.vault.delete(file);
				new Notice("Event deleted successfully");
			},
			"Failed to delete event"
		);
	}

	private openEventEditModal(event: any): void {
		new EventEditModal(this.app, this.bundle, event, (updatedEvent) => {
			this.updateEventFile(updatedEvent);
		}).open();
	}

	private async updateEventFile(eventData: any): Promise<void> {
		await withFile(
			this.app,
			eventData.filePath,
			async (file) => {
				const settings = this.bundle.settingsStore.currentSettings;

				// Handle file renaming when titleProp is undefined/empty
				if (eventData.title && !settings.titleProp) {
					const sanitizedTitle = sanitizeForFilename(eventData.title);
					if (sanitizedTitle && sanitizedTitle !== file.basename) {
						const parentPath = file.parent?.path || "";
						const newFilePath = generateUniqueFilePath(this.app, parentPath, sanitizedTitle);
						await this.app.vault.rename(file, newFilePath);
					}
				}

				await this.app.fileManager.processFrontMatter(file, (fm) => {
					if (eventData.preservedFrontmatter) {
						// Use preserved frontmatter approach - update each property individually
						for (const [key, value] of Object.entries(eventData.preservedFrontmatter)) {
							fm[key] = value;
						}
					} else {
						// Update only calendar-specific properties
						if (eventData.title && settings.titleProp) {
							fm[settings.titleProp] = eventData.title;
						}
						if (eventData.start) {
							fm[settings.startProp] = eventData.start;
						}
						if (eventData.end) {
							fm[settings.endProp] = eventData.end;
						}
						if (eventData.allDay !== undefined && settings.allDayProp) {
							fm[settings.allDayProp] = eventData.allDay;
						}
					}
				});
				new Notice("Event updated successfully");
			},
			"Failed to update event"
		);
	}
}
