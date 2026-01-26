import { getObsidianLinkPath } from "@real1ty-obsidian-plugins";
import { type App, Menu, Notice } from "obsidian";
import type { CalendarBundle } from "../core/calendar-bundle";
import {
	AssignCategoriesCommand,
	CloneEventCommand,
	DeleteEventCommand,
	DuplicateRecurringEventCommand,
	FillTimeCommand,
	MarkAsDoneCommand,
	MarkAsUndoneCommand,
	MoveByCommand,
	MoveEventCommand,
	ToggleSkipCommand,
} from "../core/commands";
import { calculateWeekOffsets } from "../core/commands/batch-commands";
import { type ContextMenuItem, type Frontmatter, isTimedEvent } from "../types";
import type { CalendarEvent } from "../types/calendar";
import { findAdjacentEvent, isEventDone } from "../utils/calendar-events";
import { intoDate, toLocalISOString } from "../utils/format";
import {
	emitHover,
	getCategoriesFromFilePath,
	getFileAndFrontmatter,
	getFileByPathOrThrow,
	openFileInNewWindow,
} from "../utils/obsidian";
import { calculateTimeOffset, isTimeUnitAllowedForAllDay } from "../utils/time-offset";
import type { CalendarView } from "./calendar-view";
import { EventPreviewModal, type PreviewEventData } from "./event-preview-modal";
import { RecurringEventsListModal } from "./list-modals/recurring-events-list-modal";
import { DeleteRecurringEventsModal, EventEditModal } from "./modals";
import { CategoryAssignModal } from "./modals/category-assign-modal";
import { MoveByModal } from "./modals/move-by-modal";

interface CalendarEventInfo {
	title: string;
	start: string | Date | null;
	end?: string | Date | null;
	allDay?: boolean;
	extendedProps?: {
		filePath?: string;
		isVirtual?: boolean;
		frontmatterDisplayData?: Frontmatter;
	};
}

interface CommandMessages {
	success: string;
	error: string;
}

type EventKind = "source" | "physical" | "virtual" | "normal";

export class EventContextMenu {
	private app: App;
	private bundle: CalendarBundle;
	private calendarView: CalendarView;
	private currentMenu: Menu | null = null;

	constructor(app: App, bundle: CalendarBundle, calendarView: CalendarView) {
		this.app = app;
		this.bundle = bundle;
		this.calendarView = calendarView;
	}

	private async runCommand(createCommand: () => unknown, messages: CommandMessages): Promise<void> {
		try {
			const command = createCommand();
			await this.bundle.commandManager.executeCommand(
				command as Parameters<typeof this.bundle.commandManager.executeCommand>[0]
			);
			new Notice(messages.success);
		} catch (error) {
			console.error(messages.error, error);
			new Notice(messages.error);
		}
	}

	private async withFilePath(
		event: CalendarEventInfo,
		operation: string,
		fn: (filePath: string) => void | Promise<void>
	): Promise<void> {
		const filePath = event.extendedProps?.filePath;
		if (!filePath) {
			new Notice(`Failed to ${operation}: No file path found`);
			return;
		}
		await fn(filePath);
	}

	private async withSourceFilePath(
		event: CalendarEventInfo,
		operation: string,
		fn: (sourceFilePath: string) => void | Promise<void>
	): Promise<void> {
		const sourceFilePath = this.getSourceFilePath(event);
		if (!sourceFilePath) {
			new Notice(`Failed to ${operation}: source event not found`);
			return;
		}
		await fn(sourceFilePath);
	}

	private getEventKind(event: CalendarEventInfo): EventKind {
		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = event.extendedProps?.frontmatterDisplayData;

		if (frontmatter?.[settings.rruleProp]) return "source";
		if (frontmatter?.[settings.rruleIdProp] && !frontmatter?.[settings.rruleProp]) return "physical";
		if (event.extendedProps?.isVirtual) return "virtual";
		return "normal";
	}

	private isRecurringEvent(event: CalendarEventInfo): boolean {
		const kind = this.getEventKind(event);
		return kind === "source" || kind === "physical" || kind === "virtual";
	}

	private getRRuleId(event: CalendarEventInfo): string | null {
		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = event.extendedProps?.frontmatterDisplayData;
		const kind = this.getEventKind(event);

		// Source events and physical events both have rruleIdProp in frontmatter
		const rruleIdFromProp = frontmatter?.[settings.rruleIdProp];
		if (rruleIdFromProp && typeof rruleIdFromProp === "string") {
			return rruleIdFromProp;
		}

		// Virtual events have rruleId in meta
		if (kind === "virtual") {
			const virtualRruleId = frontmatter?.rruleId;
			return typeof virtualRruleId === "string" ? virtualRruleId : null;
		}

		return null;
	}

	private getSourceFilePath(event: CalendarEventInfo): string | null {
		const kind = this.getEventKind(event);

		// For source events, return the file path directly
		if (kind === "source") {
			return event.extendedProps?.filePath || null;
		}

		// For virtual events, the source file path is the event's file path
		if (kind === "virtual") {
			return event.extendedProps?.filePath || null;
		}

		// For physical instances, extract source file path from the source property
		if (kind === "physical") {
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

	show(
		eOrPosition: MouseEvent | { x: number; y: number },
		info: { event: CalendarEventInfo },
		targetEl?: HTMLElement,
		containerEl?: HTMLElement
	): void {
		if (this.currentMenu) {
			this.currentMenu.close();
			this.currentMenu = null;
		}

		const menu = new Menu();
		this.currentMenu = menu;
		const event = info.event;
		const filePath = event.extendedProps?.filePath;

		const kind = this.getEventKind(event);
		const isRecurring = this.isRecurringEvent(event);
		const isVirtual = kind === "virtual";
		const isPhysical = kind === "physical";

		const settings = this.bundle.settingsStore.currentSettings;
		const enabledItems = new Set(settings.contextMenuItems || []);

		const shouldShow = (item: ContextMenuItem): boolean => enabledItems.has(item);

		if (shouldShow("enlarge")) {
			menu.addItem((item) => {
				item
					.setTitle("Enlarge")
					.setIcon("maximize-2")
					.onClick(() => {
						this.openEventPreview(event);
					});
			});
		}

		// Show preview button for non-virtual events with a file path
		if (shouldShow("preview") && filePath && targetEl && containerEl) {
			menu.addItem((item) => {
				item
					.setTitle("Preview")
					.setIcon("eye")
					.onClick((clickEvent) => {
						this.showHoverPreview(targetEl, containerEl, clickEvent, filePath);
					});
			});
		}

		if (shouldShow("goToSource") && (isPhysical || isVirtual)) {
			menu.addItem((item) => {
				item
					.setTitle("Go to source")
					.setIcon("corner-up-left")
					.onClick(() => {
						this.goToSourceEvent(event);
					});
			});
		}

		// Duplicate recurring instance - only available for physical events (not virtual)
		if (shouldShow("duplicateRecurringInstance") && isPhysical) {
			menu.addItem((item) => {
				item
					.setTitle("Duplicate recurring instance")
					.setIcon("copy-plus")
					.onClick(() => {
						void this.duplicateRecurringEvent(event);
					});
			});
		}

		if (shouldShow("viewRecurringEvents") && isRecurring) {
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
		if (!isVirtual) {
			menu.addSeparator();

			if (shouldShow("editEvent")) {
				menu.addItem((item) => {
					item
						.setTitle("Edit event")
						.setIcon("edit")
						.onClick(() => {
							this.openEditModal(event);
						});
				});
			}

			if (shouldShow("assignCategories")) {
				menu.addItem((item) => {
					item
						.setTitle("Assign categories")
						.setIcon("tag")
						.onClick(() => {
							void this.openAssignCategoriesModal(event);
						});
				});
			}

			if (shouldShow("duplicateEvent")) {
				menu.addItem((item) => {
					item
						.setTitle("Duplicate event")
						.setIcon("copy")
						.onClick(() => {
							void this.duplicateEvent(event);
						});
				});
			}

			menu.addSeparator();

			if (shouldShow("moveBy")) {
				menu.addItem((item) => {
					item
						.setTitle("Move by...")
						.setIcon("move")
						.onClick(() => {
							this.moveEventBy(event);
						});
				});
			}

			const isDone = this.isEventDone(event);

			if (shouldShow("markDone")) {
				menu.addItem((item) => {
					item
						.setTitle(isDone ? "Mark as undone" : "Mark as done")
						.setIcon(isDone ? "x" : "check")
						.onClick(() => {
							if (isDone) {
								void this.markEventAsUndone(event);
							} else {
								void this.markEventAsDone(event);
							}
						});
				});
			}

			if (shouldShow("moveToNextWeek")) {
				menu.addItem((item) => {
					item
						.setTitle("Move to next week")
						.setIcon("arrow-right")
						.onClick(() => {
							void this.moveEventByWeeks(event, 1);
						});
				});
			}

			if (shouldShow("cloneToNextWeek")) {
				menu.addItem((item) => {
					item
						.setTitle("Clone to next week")
						.setIcon("copy-plus")
						.onClick(() => {
							void this.cloneEventByWeeks(event, 1);
						});
				});
			}

			if (shouldShow("moveToPreviousWeek")) {
				menu.addItem((item) => {
					item
						.setTitle("Move to previous week")
						.setIcon("arrow-left")
						.onClick(() => {
							void this.moveEventByWeeks(event, -1);
						});
				});
			}

			if (shouldShow("cloneToPreviousWeek")) {
				menu.addItem((item) => {
					item
						.setTitle("Clone to previous week")
						.setIcon("copy-minus")
						.onClick(() => {
							void this.cloneEventByWeeks(event, -1);
						});
				});
			}

			// Fill time options - only for timed events
			if (!event.allDay) {
				if (shouldShow("fillStartTimeNow")) {
					menu.addItem((item) => {
						item
							.setTitle("Fill start time from current time")
							.setIcon("clock")
							.onClick(() => {
								void this.fillStartTimeFromNow(event);
							});
					});
				}
				if (shouldShow("fillEndTimeNow")) {
					menu.addItem((item) => {
						item
							.setTitle("Fill end time from current time")
							.setIcon("clock")
							.onClick(() => {
								void this.fillEndTimeFromNow(event);
							});
					});
				}
				if (shouldShow("fillStartTimePrevious")) {
					menu.addItem((item) => {
						item
							.setTitle("Fill start time from previous event")
							.setIcon("arrow-left")
							.onClick(() => {
								void this.fillStartTimeFromPrevious(event);
							});
					});
				}
				if (shouldShow("fillEndTimeNext")) {
					menu.addItem((item) => {
						item
							.setTitle("Fill end time from next event")
							.setIcon("arrow-right")
							.onClick(() => {
								void this.fillEndTimeFromNext(event);
							});
					});
				}
			}

			menu.addSeparator();

			if (shouldShow("deleteEvent")) {
				menu.addItem((item) => {
					item
						.setTitle("Delete event")
						.setIcon("trash")
						.onClick(() => {
							void this.deleteEvent(event);
						});
				});
			}
			if (shouldShow("skipEvent")) {
				menu.addItem((item) => {
					item
						.setTitle("Skip event")
						.setIcon("eye-off")
						.onClick(() => {
							void this.toggleSkipEvent(event);
						});
				});
			}
			if (shouldShow("openFile") && filePath) {
				menu.addItem((item) => {
					item
						.setTitle("Open file")
						.setIcon("file-text")
						.onClick(() => {
							void this.app.workspace.openLinkText(filePath, "", false);
						});
				});
			}

			if (shouldShow("openFileNewWindow") && filePath) {
				menu.addItem((item) => {
					item
						.setTitle("Open file in new window")
						.setIcon("external-link")
						.onClick(() => {
							void openFileInNewWindow(this.app, filePath);
						});
				});
			}
		}

		menu.addSeparator();

		// Show "Disable"/"Enable" button for recurring events (source, physical, virtual)
		if (shouldShow("toggleRecurring") && isRecurring) {
			// Determine if the source is currently disabled (skipped)
			const isDisabled = this.isSourceEventDisabled(event);

			menu.addItem((item) => {
				item
					.setTitle(isDisabled ? "Enable recurring event" : "Disable recurring event")
					.setIcon(isDisabled ? "eye" : "eye-off")
					.onClick(() => {
						void this.toggleRecurringEvent(event);
					});
			});
		}

		menu.onHide(() => {
			if (this.currentMenu === menu) {
				this.currentMenu = null;
			}
		});

		if (eOrPosition instanceof MouseEvent) {
			menu.showAtMouseEvent(eOrPosition);
		} else {
			menu.showAtPosition(eOrPosition);
		}
	}

	private isSourceEventDisabled(event: CalendarEventInfo): boolean {
		const settings = this.bundle.settingsStore.currentSettings;
		const sourceFilePath = this.getSourceFilePath(event);
		if (!sourceFilePath) return false;

		const { frontmatter } = getFileAndFrontmatter(this.app, sourceFilePath);
		return frontmatter[settings.skipProp] === true;
	}

	private isEventDone(event: CalendarEventInfo): boolean {
		const settings = this.bundle.settingsStore.currentSettings;
		const filePath = event.extendedProps?.filePath;
		if (!filePath) return false;

		return isEventDone(this.app, filePath, settings.statusProperty, settings.doneValue);
	}

	moveEventBy(event: CalendarEventInfo): void {
		const isAllDay = event.allDay || false;

		void this.withFilePath(event, "move event", (filePath) => {
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

					await this.runCommand(() => new MoveByCommand(this.app, this.bundle, filePath, offsetMs), {
						success: `Event moved by ${result.value} ${result.unit}`,
						error: "Failed to move event",
					});
				})();
			}).open();
		});
	}

	async moveEventByWeeks(event: CalendarEventInfo, weeks: number): Promise<void> {
		const direction = weeks > 0 ? "next" : "previous";

		await this.withFilePath(event, "move event", async (filePath) => {
			const [startOffset, endOffset] = calculateWeekOffsets(weeks);
			await this.runCommand(() => new MoveEventCommand(this.app, this.bundle, filePath, startOffset, endOffset), {
				success: `Event moved to ${direction} week`,
				error: "Failed to move event",
			});
		});
	}

	async cloneEventByWeeks(event: CalendarEventInfo, weeks: number): Promise<void> {
		const direction = weeks > 0 ? "next" : "previous";

		await this.withFilePath(event, "clone event", async (filePath) => {
			const [startOffset, endOffset] = calculateWeekOffsets(weeks);
			await this.runCommand(() => new CloneEventCommand(this.app, this.bundle, filePath, startOffset, endOffset), {
				success: `Event cloned to ${direction} week`,
				error: "Failed to clone event",
			});
		});
	}

	async duplicateEvent(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "duplicate event", async (filePath) => {
			await this.runCommand(() => new CloneEventCommand(this.app, this.bundle, filePath), {
				success: "Event duplicated",
				error: "Failed to duplicate event",
			});
		});
	}

	async duplicateRecurringEvent(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "duplicate recurring event", async (filePath) => {
			await this.runCommand(() => new DuplicateRecurringEventCommand(this.app, this.bundle, filePath), {
				success: "Recurring instance duplicated",
				error: "Failed to duplicate recurring event",
			});
		});
	}

	async markEventAsDone(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "mark event as done", async (filePath) => {
			await this.runCommand(() => new MarkAsDoneCommand(this.app, this.bundle, filePath), {
				success: "Event marked as done",
				error: "Failed to mark event as done",
			});
		});
	}

	async markEventAsUndone(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "mark event as undone", async (filePath) => {
			await this.runCommand(() => new MarkAsUndoneCommand(this.app, this.bundle, filePath), {
				success: "Event marked as undone",
				error: "Failed to mark event as undone",
			});
		});
	}

	private async handlePhysicalInstancesIfNeeded(
		rruleId: string | null,
		onComplete: () => void | Promise<void>
	): Promise<void> {
		if (!rruleId) {
			await onComplete();
			return;
		}

		const physicalInstances = this.bundle.recurringEventManager.getPhysicalInstancesByRRuleId(rruleId);
		if (physicalInstances.length > 0) {
			new DeleteRecurringEventsModal(
				this.app,
				async () => {
					await this.bundle.recurringEventManager.deleteAllPhysicalInstances(rruleId);
					await onComplete();
				},
				() => {
					void onComplete();
				}
			).open();
		} else {
			await onComplete();
		}
	}

	async deleteEvent(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "delete event", async (filePath) => {
			const kind = this.getEventKind(event);
			const isSourceRecurring = kind === "source";
			const rruleId = isSourceRecurring ? this.getRRuleId(event) : null;

			await this.handlePhysicalInstancesIfNeeded(rruleId, async () => {
				await this.runCommand(() => new DeleteEventCommand(this.app, this.bundle, filePath), {
					success: "Event deleted successfully",
					error: "Failed to delete event",
				});
			});
		});
	}

	async toggleRecurringEvent(event: CalendarEventInfo): Promise<void> {
		await this.withSourceFilePath(event, "toggle recurring event", async (sourceFilePath) => {
			const isCurrentlyDisabled = this.isSourceEventDisabled(event);
			const willBeDisabled = !isCurrentlyDisabled;
			const rruleId = willBeDisabled ? this.getRRuleId(event) : null;

			await this.handlePhysicalInstancesIfNeeded(rruleId, async () => {
				await this.runCommand(() => new ToggleSkipCommand(this.app, this.bundle, sourceFilePath), {
					success: "Recurring event toggled",
					error: "Failed to toggle recurring event",
				});
			});
		});
	}

	async toggleSkipEvent(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "toggle skip event", async (filePath) => {
			await this.runCommand(() => new ToggleSkipCommand(this.app, this.bundle, filePath), {
				success: "Event skip toggled",
				error: "Failed to toggle skip event",
			});
		});
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

	openEditModal(event: CalendarEventInfo): void {
		new EventEditModal(this.app, this.bundle, event).open();
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
		let rruleType: string | undefined;
		let rruleSpec: string | undefined;
		let sourceCategory: string | undefined;

		if (!sourceEventPath) {
			new Notice("Source event not found");
			return;
		}

		try {
			const { file, frontmatter } = getFileAndFrontmatter(this.app, sourceEventPath);
			sourceTitle = file.basename;

			const settings = this.bundle.settingsStore.currentSettings;
			rruleType = frontmatter[settings.rruleProp] as string | undefined;
			rruleSpec = frontmatter[settings.rruleSpecProp] as string | undefined;

			const categories = getCategoriesFromFilePath(this.app, sourceEventPath, settings.categoryProp);
			if (categories.length > 0) {
				const categoryColor = this.bundle.categoryTracker
					.getCategoriesWithColors()
					.find((c) => c.name === categories[0])?.color;
				sourceCategory = categoryColor || settings.defaultNodeColor;
			}
		} catch {
			// File doesn't exist or has no frontmatter - continue without source info
		}

		const physicalInstances = this.bundle.recurringEventManager.getPhysicalInstancesByRRuleId(rruleId);

		if (physicalInstances.length === 0) {
			new Notice("No physical instances found");
			return;
		}

		const settings = this.bundle.settingsStore.currentSettings;

		// Get file titles and skipped status for each instance
		const instancesWithTitles = physicalInstances.map((instance) => {
			let title = instance.filePath;
			let skipped = false;

			try {
				const { file, frontmatter } = getFileAndFrontmatter(this.app, instance.filePath);
				title = file.basename;
				skipped = frontmatter[settings.skipProp] === true;
			} catch {
				// File doesn't exist or has no frontmatter - use defaults
			}

			return {
				filePath: instance.filePath,
				instanceDate: instance.instanceDate,
				title,
				skipped,
			};
		});

		const recurringInfo = rruleType ? { rruleType, rruleSpec, sourceCategory } : undefined;
		new RecurringEventsListModal(this.app, instancesWithTitles, sourceTitle, sourceEventPath, recurringInfo).open();
	}

	async fillEndTimeFromNext(event: CalendarEventInfo): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		await this.fillTimeFromAdjacent(event, {
			direction: "next",
			propertyName: settings.endProp,
			getTimeValue: (adj) => adj.start,
			successMessage: "End time filled from next event",
			errorMessage: "Failed to fill end time",
		});
	}

	async fillStartTimeFromPrevious(event: CalendarEventInfo): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		await this.fillTimeFromAdjacent(event, {
			direction: "previous",
			propertyName: settings.startProp,
			getTimeValue: (adj) => (isTimedEvent(adj) ? adj.end : undefined),
			successMessage: "Start time filled from previous event",
			errorMessage: "Failed to fill start time",
		});
	}

	async fillStartTimeFromNow(event: CalendarEventInfo): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		await this.withFilePath(event, "fill start time", async (filePath) => {
			const now = toLocalISOString(new Date());
			await this.runCommand(() => new FillTimeCommand(this.app, this.bundle, filePath, settings.startProp, now), {
				success: "Start time filled from current time",
				error: "Failed to fill start time",
			});
		});
	}

	async fillEndTimeFromNow(event: CalendarEventInfo): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		await this.withFilePath(event, "fill end time", async (filePath) => {
			const now = toLocalISOString(new Date());
			await this.runCommand(() => new FillTimeCommand(this.app, this.bundle, filePath, settings.endProp, now), {
				success: "End time filled from current time",
				error: "Failed to fill end time",
			});
		});
	}

	private async fillTimeFromAdjacent(
		event: CalendarEventInfo,
		config: {
			direction: "next" | "previous";
			propertyName: string;
			getTimeValue: (adj: CalendarEvent) => string | undefined;
			successMessage: string;
			errorMessage: string;
		}
	): Promise<void> {
		await this.withFilePath(event, "fill time", async (filePath) => {
			const originalEvent = this.bundle.eventStore.getEventByPath(filePath);
			const currentStartISO = originalEvent?.start ?? null;

			const adjacentEvent = findAdjacentEvent(
				this.bundle.eventStore,
				currentStartISO,
				event.extendedProps?.filePath,
				config.direction
			);

			if (!adjacentEvent) {
				new Notice(`No ${config.direction} event found`);
				return;
			}

			const timeValue = config.getTimeValue(adjacentEvent);
			if (!timeValue) {
				new Notice(
					`${config.direction === "previous" ? "Previous" : "Next"} event has no ${config.direction === "previous" ? "end" : "start"} time`
				);
				return;
			}

			const timeValueISO = new Date(timeValue).toISOString();

			await this.runCommand(
				() => new FillTimeCommand(this.app, this.bundle, filePath, config.propertyName, timeValueISO),
				{
					success: config.successMessage,
					error: config.errorMessage,
				}
			);
		});
	}

	private async openAssignCategoriesModal(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "assign categories", async (filePath) => {
			getFileByPathOrThrow(this.app, filePath);

			const settings = this.bundle.settingsStore.currentSettings;
			const currentCategories = getCategoriesFromFilePath(this.app, filePath, settings.categoryProp);

			// Get all available categories with colors
			const categories = this.bundle.categoryTracker.getCategoriesWithColors();
			const defaultColor = settings.defaultNodeColor;

			const modal = new CategoryAssignModal(
				this.app,
				categories,
				defaultColor,
				currentCategories,
				(selectedCategories: string[]) => {
					void this.runCommand(() => new AssignCategoriesCommand(this.app, this.bundle, filePath, selectedCategories), {
						success: "Categories updated",
						error: "Failed to assign categories",
					});
				}
			);
			modal.open();
		});
	}
}
