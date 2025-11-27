import { generateUniqueFilePath, getObsidianLinkPath, sanitizeForFilename } from "@real1ty-obsidian-plugins/utils";
import { type App, Menu, Notice, TFile } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import {
	CloneEventCommand,
	DeleteEventCommand,
	EditEventCommand,
	MoveByCommand,
	MoveEventCommand,
	ToggleSkipCommand,
} from "../core/commands";
import { calculateWeekOffsets } from "../core/commands/batch-commands";
import { intoDate } from "../utils/format";
import { emitHover } from "../utils/obsidian";
import { calculateTimeOffset, isTimeUnitAllowedForAllDay } from "../utils/time-offset";
import type { CalendarView } from "./calendar-view";
import { EventEditModal } from "./event-edit-modal";
import { EventPreviewModal, type PreviewEventData } from "./event-preview-modal";
import { RecurringEventsListModal } from "./list-modals/recurring-events-list-modal";
import { MoveByModal } from "./move-by-modal";

interface CalendarEventInfo {
	title: string;
	start: string | Date | null;
	end?: string | Date | null;
	allDay?: boolean;
	extendedProps?: {
		filePath?: string;
		isVirtual?: boolean;
		frontmatterDisplayData?: Record<string, unknown>;
	};
}

interface EventSaveData {
	filePath: string | null;
	title: string;
	start: string;
	end: string | null;
	allDay: boolean;
	preservedFrontmatter: Record<string, unknown>;
}

export class EventContextMenu {
	private app: App;
	private bundle: CalendarBundle;
	private calendarView: CalendarView;

	constructor(app: App, bundle: CalendarBundle, calendarView: CalendarView) {
		this.app = app;
		this.bundle = bundle;
		this.calendarView = calendarView;
	}

	private getFilePathOrNotice(event: CalendarEventInfo, operation: string): string | null {
		const filePath = event.extendedProps?.filePath;
		if (!filePath) {
			new Notice(`Failed to ${operation}: No file path found`);
			return null;
		}
		return filePath;
	}

	private isSourceEvent(event: CalendarEventInfo): boolean {
		const settings = this.bundle.settingsStore.currentSettings;
		return !!event.extendedProps?.frontmatterDisplayData?.[settings.rruleProp];
	}

	private isPhysicalEvent(event: CalendarEventInfo): boolean {
		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = event.extendedProps?.frontmatterDisplayData;
		return !!frontmatter?.[settings.rruleIdProp] && !frontmatter?.[settings.rruleProp];
	}

	private isVirtualEvent(event: CalendarEventInfo): boolean {
		return !!event.extendedProps?.isVirtual;
	}

	private getRRuleId(event: CalendarEventInfo): string | null {
		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = event.extendedProps?.frontmatterDisplayData;

		// Source events and physical events both have rruleIdProp in frontmatter
		const rruleIdFromProp = frontmatter?.[settings.rruleIdProp];
		if (rruleIdFromProp && typeof rruleIdFromProp === "string") {
			return rruleIdFromProp;
		}

		// Virtual events have rruleId in meta
		if (this.isVirtualEvent(event)) {
			const virtualRruleId = frontmatter?.rruleId;
			return typeof virtualRruleId === "string" ? virtualRruleId : null;
		}

		return null;
	}

	private getSourceFilePath(event: CalendarEventInfo): string | null {
		// For source events, return the file path directly
		if (this.isSourceEvent(event)) {
			return event.extendedProps?.filePath || null;
		}

		// For virtual events, the source file path is the event's file path
		if (this.isVirtualEvent(event)) {
			return event.extendedProps?.filePath || null;
		}

		// For physical instances, extract source file path from the source property
		if (this.isPhysicalEvent(event)) {
			const settings = this.bundle.settingsStore.currentSettings;
			const frontmatter = event.extendedProps?.frontmatterDisplayData;
			const sourceLink = frontmatter?.[settings.sourceProp];

			if (!sourceLink || typeof sourceLink !== "string") return null;

			// Use Obsidian's link resolution to get the actual file
			const linkPath = getObsidianLinkPath(sourceLink);
			const sourceFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, event.extendedProps?.filePath || "");

			return sourceFile?.path || null;
		}

		return null;
	}

	show(e: MouseEvent, info: { event: CalendarEventInfo }, targetEl?: HTMLElement, containerEl?: HTMLElement): void {
		const menu = new Menu();
		const event = info.event;
		const filePath = event.extendedProps?.filePath;

		menu.addItem((item) => {
			item
				.setTitle("Enlarge")
				.setIcon("maximize-2")
				.onClick(() => {
					this.openEventPreview(event);
				});
		});

		// Show preview button for non-virtual events with a file path
		if (filePath && targetEl && containerEl) {
			menu.addItem((item) => {
				item
					.setTitle("Preview")
					.setIcon("eye")
					.onClick((clickEvent) => {
						this.showHoverPreview(targetEl, containerEl, clickEvent, filePath);
					});
			});
		}

		if (this.isPhysicalEvent(event) || this.isVirtualEvent(event)) {
			menu.addItem((item) => {
				item
					.setTitle("Go to source")
					.setIcon("corner-up-left")
					.onClick(() => {
						this.goToSourceEvent(event);
					});
			});
		}

		if (this.isSourceEvent(event) || this.isPhysicalEvent(event) || this.isVirtualEvent(event)) {
			menu.addItem((item) => {
				item
					.setTitle("View recurring events")
					.setIcon("calendar-range")
					.onClick(() => {
						this.showRecurringEventsList(event);
					});
			});
		}

		// Only show file-based operations for non-virtual events
		if (!this.isVirtualEvent(event)) {
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
						void this.duplicateEvent(event);
					});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item
					.setTitle("Move by...")
					.setIcon("move")
					.onClick(() => {
						void this.moveEventBy(event);
					});
			});

			menu.addItem((item) => {
				item
					.setTitle("Move to next week")
					.setIcon("arrow-right")
					.onClick(() => {
						void this.moveEventByWeeks(event, 1);
					});
			});

			menu.addItem((item) => {
				item
					.setTitle("Clone to next week")
					.setIcon("copy-plus")
					.onClick(() => {
						void this.cloneEventByWeeks(event, 1);
					});
			});

			menu.addItem((item) => {
				item
					.setTitle("Move to previous week")
					.setIcon("arrow-left")
					.onClick(() => {
						void this.moveEventByWeeks(event, -1);
					});
			});

			menu.addItem((item) => {
				item
					.setTitle("Clone to previous week")
					.setIcon("copy-minus")
					.onClick(() => {
						void this.cloneEventByWeeks(event, -1);
					});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item
					.setTitle("Delete event")
					.setIcon("trash")
					.onClick(() => {
						void this.deleteEvent(event);
					});
			});
			menu.addItem((item) => {
				item
					.setTitle("Skip event")
					.setIcon("eye-off")
					.onClick(() => {
						void this.toggleSkipEvent(event);
					});
			});
			if (filePath) {
				menu.addItem((item) => {
					item
						.setTitle("Open file")
						.setIcon("file-text")
						.onClick(() => {
							void this.app.workspace.openLinkText(filePath, "", false);
						});
				});
			}
		}

		menu.addSeparator();

		// Show "Disable"/"Enable" button for recurring events (source, physical, virtual)
		if (this.isSourceEvent(event) || this.isPhysicalEvent(event) || this.isVirtualEvent(event)) {
			// Determine if the source is currently disabled (skipped)
			let isDisabled = false;
			const settings = this.bundle.settingsStore.currentSettings;

			const sourceFilePath = this.getSourceFilePath(event);
			if (sourceFilePath) {
				const sourceFile = this.app.vault.getAbstractFileByPath(sourceFilePath);
				if (sourceFile instanceof TFile) {
					const metadata = this.app.metadataCache.getFileCache(sourceFile);
					isDisabled = metadata?.frontmatter?.[settings.skipProp] === true;
				}
			}

			menu.addItem((item) => {
				item
					.setTitle(isDisabled ? "Enable recurring event" : "Disable recurring event")
					.setIcon(isDisabled ? "eye" : "eye-off")
					.onClick(() => {
						void this.toggleRecurringEvent(event);
					});
			});
		}

		menu.showAtMouseEvent(e);
	}

	moveEventBy(event: CalendarEventInfo): void {
		const filePath = this.getFilePathOrNotice(event, "move event");
		if (!filePath) return;

		const isAllDay = event.allDay || false;

		new MoveByModal(this.app, (result) => {
			void (async () => {
				const { offsetMs, unit } = calculateTimeOffset(result);

				// Validate time unit for all-day events
				if (isAllDay && !isTimeUnitAllowedForAllDay(unit)) {
					console.warn(
						`Skipping MoveBy operation: Time unit "${unit}" is not allowed for all-day events. Only days, weeks, months, and years are supported.`
					);
					new Notice(`Cannot move all-day event by ${unit}. Please use days, weeks, months, or years.`, 5000);
					return;
				}

				try {
					const command = new MoveByCommand(this.app, this.bundle, filePath, offsetMs);
					await this.bundle.commandManager.executeCommand(command);

					new Notice(`Event moved by ${result.value} ${result.unit}`);
				} catch (error) {
					console.error("Failed to move event:", error);
					new Notice("Failed to move event");
				}
			})();
		}).open();
	}

	async moveEventByWeeks(event: CalendarEventInfo, weeks: number): Promise<void> {
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

	async cloneEventByWeeks(event: CalendarEventInfo, weeks: number): Promise<void> {
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

	async duplicateEvent(event: CalendarEventInfo): Promise<void> {
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

	async deleteEvent(event: CalendarEventInfo): Promise<void> {
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

	async toggleRecurringEvent(event: CalendarEventInfo): Promise<void> {
		const sourceFilePath = this.getSourceFilePath(event);
		if (!sourceFilePath) {
			new Notice("Failed to toggle recurring event: no source file found");
			return;
		}

		try {
			const command = new ToggleSkipCommand(this.app, this.bundle, sourceFilePath);
			await this.bundle.commandManager.executeCommand(command);

			new Notice("Recurring event toggled");
		} catch (error) {
			console.error("Failed to toggle recurring event:", error);
			new Notice("Failed to toggle recurring event");
		}
	}

	async toggleSkipEvent(event: CalendarEventInfo): Promise<void> {
		const filePath = this.getFilePathOrNotice(event, "toggle skip event");
		if (!filePath) return;

		try {
			const command = new ToggleSkipCommand(this.app, this.bundle, filePath);

			await this.bundle.commandManager.executeCommand(command);

			new Notice("Event skip toggled");
		} catch (error) {
			console.error("Failed to toggle skip event:", error);
			new Notice("Failed to toggle skip event");
		}
	}

	private openEventPreview(event: CalendarEventInfo): void {
		const previewEvent: PreviewEventData = {
			title: event.title,
			start: intoDate(event.start),
			end: event.end ? intoDate(event.end) : undefined,
			allDay: event.allDay || false,
			extendedProps: event.extendedProps,
		};
		new EventPreviewModal(this.app, this.bundle, previewEvent).open();
	}

	private showHoverPreview(
		targetEl: HTMLElement,
		containerEl: HTMLElement,
		_clickEvent: MouseEvent | KeyboardEvent,
		filePath: string
	): void {
		// Create a synthetic mouse event positioned at the target element for the hover
		const rect = targetEl.getBoundingClientRect();
		const syntheticEvent = new MouseEvent("mouseover", {
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
			view: window,
		});

		// Dispatch the event on the target element first to simulate actual hover
		targetEl.dispatchEvent(syntheticEvent);

		// Then trigger Obsidian's hover-link event
		emitHover(this.app, containerEl, targetEl, syntheticEvent, filePath, this.bundle.calendarId);
	}

	private openEventEditModal(event: CalendarEventInfo): void {
		new EventEditModal(this.app, this.bundle, event, (updatedEvent) => {
			void this.updateEventFile(updatedEvent);
		}).open();
	}

	private async updateEventFile(eventData: EventSaveData): Promise<void> {
		const { filePath } = eventData;
		if (!filePath) {
			new Notice("Failed to update event: no file path found");
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
				const sanitizedTitle = sanitizeForFilename(eventData.title, { style: "preserve" });
				if (sanitizedTitle && sanitizedTitle !== file.basename) {
					const parentPath = file.parent?.path || "";
					const newFilePath = generateUniqueFilePath(this.app, parentPath, sanitizedTitle);
					await this.app.fileManager.renameFile(file, newFilePath);
					finalFilePath = newFilePath;
				}
			}

			const eventDataForCommand = {
				...eventData,
				end: eventData.end ?? undefined,
			};
			const command = new EditEventCommand(this.app, this.bundle, finalFilePath, eventDataForCommand);
			await this.bundle.commandManager.executeCommand(command);

			new Notice("Event updated successfully");
		} catch (error) {
			console.error("Failed to update event:", error);
			new Notice("Failed to update event");
		}
	}

	private goToSourceEvent(event: CalendarEventInfo): void {
		const sourceFilePath = this.getSourceFilePath(event);

		if (!sourceFilePath) {
			new Notice("Source event not found");
			return;
		}

		const sourceEvent = this.bundle.eventStore.getEventByPath(sourceFilePath);
		if (!sourceEvent) {
			new Notice("Source event not found in calendar");
			return;
		}

		const eventDate = new Date(sourceEvent.start);
		this.calendarView.navigateToDate(eventDate, "timeGridWeek");

		setTimeout(() => {
			this.calendarView.highlightEventByPath(sourceFilePath, 5000);
		}, 300);

		new Notice("Navigated to source event");
	}

	private showRecurringEventsList(event: CalendarEventInfo): void {
		const rruleId = this.getRRuleId(event);

		if (!rruleId) {
			new Notice("No recurring event ID found");
			return;
		}

		const sourceEventPath = this.bundle.recurringEventManager.getSourceEventPath(rruleId);
		let sourceTitle = "Unknown Event";
		if (!sourceEventPath) {
			new Notice("Source event not found");
			return;
		}

		const sourceFile = this.app.vault.getAbstractFileByPath(sourceEventPath);
		if (sourceFile instanceof TFile) {
			sourceTitle = sourceFile.basename;
		}

		// Get all physical instances for this recurring event
		const physicalInstances = this.bundle.recurringEventManager.getPhysicalInstancesByRRuleId(rruleId);

		if (physicalInstances.length === 0) {
			new Notice("No physical instances found");
			return;
		}

		// Get file titles and skipped status for each instance
		const instancesWithTitles = physicalInstances.map((instance) => {
			const file = this.app.vault.getAbstractFileByPath(instance.filePath);
			const title = file instanceof TFile ? file.basename : instance.filePath;

			// Get skipped status from frontmatter
			let skipped = false;
			if (file instanceof TFile) {
				const metadata = this.app.metadataCache.getFileCache(file);
				const frontmatter = metadata?.frontmatter;
				if (frontmatter) {
					skipped = frontmatter[this.bundle.settingsStore.currentSettings.skipProp] === true;
				}
			}

			return {
				filePath: instance.filePath,
				instanceDate: instance.instanceDate,
				title,
				skipped,
			};
		});

		// Open the modal
		new RecurringEventsListModal(this.app, instancesWithTitles, sourceTitle, sourceEventPath).open();
	}
}
