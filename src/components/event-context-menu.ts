import type {
	ContextMenuHandle,
	ContextMenuItemDefinition,
	ContextMenuState,
	Frontmatter,
} from "@real1ty-obsidian-plugins";
import {
	createContextMenu,
	getObsidianLinkPath,
	intoDate,
	MacroCommand,
	parseIntoList,
	toLocalISOString,
} from "@real1ty-obsidian-plugins";
import { type App, Notice } from "obsidian";

import { CONTEXT_MENU_BUTTON_LABELS, CSS_PREFIX } from "../constants";
import type { CalendarBundle } from "../core/calendar-bundle";
import {
	assignCategories,
	CloneEventCommand,
	DeleteEventCommand,
	fillTime,
	markAsDone,
	markAsUndone,
	moveEvent,
	toggleSkip,
} from "../core/commands";
import { weekDuration } from "../core/commands/batch-commands";
import { MinimizedModalManager } from "../core/minimized-modal-manager";
import { isTimedEvent } from "../types";
import type { CalendarEvent } from "../types/calendar";
import { type EventKind, getEventKind, isRecurringEventKind } from "../types/event-classification";
import { isTimeUnitAllowedForAllDay } from "../types/move-by";
import { isEventDone, parseCustomDoneProperty } from "../utils/event-frontmatter";
import { findAdjacentEvent } from "../utils/event-matching";
import { getEventName } from "../utils/event-naming";
import {
	emitHover,
	getCategoriesFromFilePath,
	getFileAndFrontmatter,
	getFileByPathOrThrow,
	openFileInNewWindow,
} from "../utils/obsidian";
import { toSafeLocalISO, toSafeLocalISOOrNull } from "../utils/virtual-event-conversion";
import type { CalendarHost } from "./calendar-host";
import { EventSeriesModal } from "./list-modals/event-series-modal";
import type { PreviewEventData } from "./modals";
import {
	EventEditModal,
	openCategoryAssignModal,
	showDeleteRecurringEventsModal,
	showEventPreviewModal,
	showMoveByModal,
} from "./modals";

interface CalendarEventInfo {
	title: string;
	start: string | Date | null;
	end?: string | Date | null;
	allDay?: boolean;
	extendedProps?: {
		filePath?: string;
		virtualKind?: string;
		virtualEventId?: string;
		frontmatterDisplayData?: Frontmatter;
	};
}

interface CommandMessages {
	success: string;
	error: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export class EventContextMenu {
	private app: App;
	private bundle: CalendarBundle;
	private calendarComponent: CalendarHost;
	private handle: ContextMenuHandle;
	private currentEvent: CalendarEventInfo | null = null;
	private currentTargetEl: HTMLElement | null = null;
	private currentContainerEl: HTMLElement | null = null;

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(app: App, bundle: CalendarBundle, calendarComponent: CalendarHost) {
		this.app = app;
		this.bundle = bundle;
		this.calendarComponent = calendarComponent;

		const settings = this.bundle.settingsStore.currentSettings;
		const initialState = this.resolveInitialState(settings);

		this.handle = createContextMenu({
			items: this.buildItemDefinitions(),
			cssPrefix: CSS_PREFIX,
			...(initialState ? { initialState } : {}),
			editable: true,
			app,
			onStateChange: (state) => {
				void this.bundle.settingsStore.updateSettings((s) => ({
					...s,
					contextMenuState: state,
				}));
			},
		});

		// Eagerly persist migrated state so the legacy field is only read once
		if (!settings.contextMenuState && initialState) {
			void this.bundle.settingsStore.updateSettings((s) => ({
				...s,
				contextMenuState: initialState,
			}));
		}
	}

	// ─── Menu Display ─────────────────────────────────────────────

	show(
		eOrPosition: MouseEvent | { x: number; y: number },
		info: { event: CalendarEventInfo },
		targetEl?: HTMLElement,
		containerEl?: HTMLElement
	): void {
		const event = info.event;
		this.currentEvent = event;
		this.currentTargetEl = targetEl ?? null;
		this.currentContainerEl = containerEl ?? null;

		const kind = this.getEventKindForEvent(event);
		const isRecurring = this.isRecurringEvent(event);
		const isNormal = kind === "normal" || kind === "source" || kind === "physical";
		const isPhysical = kind === "physical";
		const filePath = event.extendedProps?.filePath;
		const isDone = this.isEventDone(event);
		const isDisabled = isRecurring ? this.isSourceEventDisabled(event) : false;

		const titleOverrides: Record<string, string> = {};
		if (isDone) {
			titleOverrides["markDone"] = "Mark as undone";
		}
		if (isDisabled) {
			titleOverrides["toggleRecurring"] = "Enable recurring event";
		}

		this.handle.show(
			eOrPosition,
			(id) => {
				switch (id) {
					case "preview":
						return isNormal && !!filePath && !!targetEl && !!containerEl;
					case "goToSource":
					case "editSourceEvent":
						return isPhysical || kind === "virtual";
					case "editEvent":
						return kind !== "virtual";
					case "triggerStopwatch":
					case "assignCategories":
					case "assignPrerequisites":
					case "duplicateEvent":
					case "duplicateRemainingWeekDays":
					case "moveBy":
					case "markDone":
					case "moveToNextWeek":
					case "cloneToNextWeek":
					case "moveToPreviousWeek":
					case "cloneToPreviousWeek":
					case "skipEvent":
						return isNormal;
					case "deleteEvent":
						return kind !== "virtual";
					case "fillStartTimeNow":
					case "fillEndTimeNow":
					case "fillStartTimePrevious":
					case "fillEndTimeNext":
						return isNormal && !event.allDay;
					case "openFile":
					case "openFileNewWindow":
						return isNormal && !!filePath;
					case "toggleRecurring":
						return isRecurring;
					case "makeVirtual":
						return isNormal;
					case "makeReal":
						return kind === "manual";
					default:
						return true;
				}
			},
			titleOverrides
		);
	}

	destroy(): void {
		this.handle.destroy();
	}

	// ─── State Resolution ─────────────────────────────────────────

	private resolveInitialState(settings: {
		contextMenuState?: ContextMenuState | undefined;
		contextMenuItems?: string[] | undefined;
	}): ContextMenuState | undefined {
		if (settings.contextMenuState) return settings.contextMenuState;

		// Backward compatibility: migrate legacy contextMenuItems to contextMenuState
		if (settings.contextMenuItems && settings.contextMenuItems.length > 0) {
			return { visibleItemIds: settings.contextMenuItems };
		}

		return undefined;
	}

	// ─── Item Definitions ─────────────────────────────────────────

	private buildItemDefinitions(): ContextMenuItemDefinition[] {
		return [
			{
				id: "enlarge",
				label: CONTEXT_MENU_BUTTON_LABELS.enlarge,
				icon: "maximize-2",
				section: "navigation",
				onAction: () => this.openEventPreview(this.currentEvent!),
			},
			{
				id: "preview",
				label: CONTEXT_MENU_BUTTON_LABELS.preview,
				icon: "eye",
				section: "navigation",
				onAction: () => {
					const filePath = this.currentEvent!.extendedProps?.filePath;
					if (filePath && this.currentTargetEl && this.currentContainerEl) {
						this.showHoverPreview(this.currentTargetEl, this.currentContainerEl, filePath);
					}
				},
			},
			{
				id: "goToSource",
				label: CONTEXT_MENU_BUTTON_LABELS.goToSource,
				icon: "corner-up-left",
				section: "navigation",
				onAction: () => this.goToSourceEvent(this.currentEvent!),
			},
			{
				id: "editSourceEvent",
				label: CONTEXT_MENU_BUTTON_LABELS.editSourceEvent,
				icon: "pencil",
				section: "navigation",
				onAction: () => this.editSourceEvent(this.currentEvent!),
			},
			{
				id: "viewEventGroups",
				label: CONTEXT_MENU_BUTTON_LABELS.viewEventGroups,
				icon: "list",
				section: "navigation",
				onAction: () => this.showEventSeries(this.currentEvent!),
			},
			{
				id: "editEvent",
				label: CONTEXT_MENU_BUTTON_LABELS.editEvent,
				icon: "edit",
				section: "edit",
				onAction: () => this.openEditModal(this.currentEvent!),
			},
			{
				id: "triggerStopwatch",
				label: CONTEXT_MENU_BUTTON_LABELS.triggerStopwatch,
				icon: "timer",
				section: "edit",
				onAction: () => {
					void this.triggerStopwatch(this.currentEvent!);
				},
			},
			{
				id: "assignCategories",
				label: CONTEXT_MENU_BUTTON_LABELS.assignCategories,
				icon: "tag",
				section: "edit",
				onAction: () => {
					void this.openAssignCategoriesModal(this.currentEvent!);
				},
			},
			{
				id: "assignPrerequisites",
				label: CONTEXT_MENU_BUTTON_LABELS.assignPrerequisites,
				icon: "workflow",
				section: "edit",
				onAction: () => {
					void this.startPrerequisiteSelection(this.currentEvent!);
				},
			},
			{
				id: "duplicateEvent",
				label: CONTEXT_MENU_BUTTON_LABELS.duplicateEvent,
				icon: "copy",
				section: "edit",
				onAction: () => {
					void this.duplicateEvent(this.currentEvent!);
				},
			},
			{
				id: "duplicateRemainingWeekDays",
				label: CONTEXT_MENU_BUTTON_LABELS.duplicateRemainingWeekDays,
				icon: "calendar-plus",
				section: "edit",
				onAction: () => {
					void this.duplicateRemainingWeekDays(this.currentEvent!);
				},
			},
			{
				id: "moveBy",
				label: CONTEXT_MENU_BUTTON_LABELS.moveBy,
				icon: "move",
				section: "move",
				onAction: () => this.moveEventBy(this.currentEvent!),
			},
			{
				id: "markDone",
				label: CONTEXT_MENU_BUTTON_LABELS.markDone,
				icon: "check",
				section: "move",
				onAction: () => {
					const isDone = this.isEventDone(this.currentEvent!);
					if (isDone) {
						void this.markEventAsUndone(this.currentEvent!);
					} else {
						void this.markEventAsDone(this.currentEvent!);
					}
				},
			},
			{
				id: "moveToNextWeek",
				label: CONTEXT_MENU_BUTTON_LABELS.moveToNextWeek,
				icon: "arrow-right",
				section: "move",
				onAction: () => {
					void this.moveEventByWeeks(this.currentEvent!, 1);
				},
			},
			{
				id: "cloneToNextWeek",
				label: CONTEXT_MENU_BUTTON_LABELS.cloneToNextWeek,
				icon: "copy-plus",
				section: "move",
				onAction: () => {
					void this.cloneEventByWeeks(this.currentEvent!, 1);
				},
			},
			{
				id: "moveToPreviousWeek",
				label: CONTEXT_MENU_BUTTON_LABELS.moveToPreviousWeek,
				icon: "arrow-left",
				section: "move",
				onAction: () => {
					void this.moveEventByWeeks(this.currentEvent!, -1);
				},
			},
			{
				id: "cloneToPreviousWeek",
				label: CONTEXT_MENU_BUTTON_LABELS.cloneToPreviousWeek,
				icon: "copy-minus",
				section: "move",
				onAction: () => {
					void this.cloneEventByWeeks(this.currentEvent!, -1);
				},
			},
			{
				id: "fillStartTimeNow",
				label: CONTEXT_MENU_BUTTON_LABELS.fillStartTimeNow,
				icon: "clock",
				section: "move",
				onAction: () => {
					void this.fillStartTimeFromNow(this.currentEvent!);
				},
			},
			{
				id: "fillEndTimeNow",
				label: CONTEXT_MENU_BUTTON_LABELS.fillEndTimeNow,
				icon: "clock",
				section: "move",
				onAction: () => {
					void this.fillEndTimeFromNow(this.currentEvent!);
				},
			},
			{
				id: "fillStartTimePrevious",
				label: CONTEXT_MENU_BUTTON_LABELS.fillStartTimePrevious,
				icon: "arrow-left",
				section: "move",
				onAction: () => {
					void this.fillStartTimeFromPrevious(this.currentEvent!);
				},
			},
			{
				id: "fillEndTimeNext",
				label: CONTEXT_MENU_BUTTON_LABELS.fillEndTimeNext,
				icon: "arrow-right",
				section: "move",
				onAction: () => {
					void this.fillEndTimeFromNext(this.currentEvent!);
				},
			},
			{
				id: "deleteEvent",
				label: CONTEXT_MENU_BUTTON_LABELS.deleteEvent,
				icon: "trash",
				section: "danger",
				onAction: () => {
					void this.deleteEvent(this.currentEvent!);
				},
			},
			{
				id: "skipEvent",
				label: CONTEXT_MENU_BUTTON_LABELS.skipEvent,
				icon: "eye-off",
				section: "danger",
				onAction: () => {
					void this.toggleSkipEvent(this.currentEvent!);
				},
			},
			{
				id: "openFile",
				label: CONTEXT_MENU_BUTTON_LABELS.openFile,
				icon: "file-text",
				section: "danger",
				onAction: () => {
					const filePath = this.currentEvent!.extendedProps?.filePath;
					if (filePath) void this.app.workspace.openLinkText(filePath, "", false);
				},
			},
			{
				id: "openFileNewWindow",
				label: CONTEXT_MENU_BUTTON_LABELS.openFileNewWindow,
				icon: "external-link",
				section: "danger",
				onAction: () => {
					const filePath = this.currentEvent!.extendedProps?.filePath;
					if (filePath) void openFileInNewWindow(this.app, filePath);
				},
			},
			{
				id: "toggleRecurring",
				label: CONTEXT_MENU_BUTTON_LABELS.toggleRecurring,
				icon: "eye-off",
				section: "recurring",
				onAction: () => {
					void this.toggleRecurringEvent(this.currentEvent!);
				},
			},
			{
				id: "makeVirtual",
				label: CONTEXT_MENU_BUTTON_LABELS.makeVirtual,
				icon: "cloud",
				section: "edit",
				onAction: () => {
					void this.makeEventVirtual(this.currentEvent!);
				},
			},
			{
				id: "makeReal",
				label: CONTEXT_MENU_BUTTON_LABELS.makeReal,
				icon: "file-plus",
				section: "edit",
				onAction: () => {
					void this.makeEventReal(this.currentEvent!);
				},
			},
		];
	}

	// ─── Event Classification ─────────────────────────────────────

	private getEventKindForEvent(event: CalendarEventInfo): EventKind {
		return getEventKind(event, this.bundle.settingsStore.currentSettings);
	}

	private isRecurringEvent(event: CalendarEventInfo): boolean {
		return isRecurringEventKind(this.getEventKindForEvent(event));
	}

	private getRRuleId(event: CalendarEventInfo): string | null {
		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = event.extendedProps?.frontmatterDisplayData;
		const kind = this.getEventKindForEvent(event);

		const rruleIdFromProp = frontmatter?.[settings.rruleIdProp];
		if (rruleIdFromProp && typeof rruleIdFromProp === "string") {
			return rruleIdFromProp;
		}

		if (kind === "virtual") {
			const virtualRruleId = frontmatter?.["rruleId"];
			return typeof virtualRruleId === "string" ? virtualRruleId : null;
		}

		return null;
	}

	private getSourceFilePath(event: CalendarEventInfo): string | null {
		const kind = this.getEventKindForEvent(event);

		if (kind === "source" || kind === "virtual") return event.extendedProps?.filePath || null;

		if (kind === "physical") {
			const settings = this.bundle.settingsStore.currentSettings;
			const frontmatter = event.extendedProps?.frontmatterDisplayData;
			const sourceLink = frontmatter?.[settings.sourceProp];

			if (!sourceLink || typeof sourceLink !== "string") return null;

			const linkPath = getObsidianLinkPath(sourceLink);
			const sourceFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, event.extendedProps?.filePath || "");

			return sourceFile?.path || null;
		}

		return null;
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

		const customProp = parseCustomDoneProperty(settings.customDoneProperty);
		if (customProp) {
			try {
				const { frontmatter } = getFileAndFrontmatter(this.app, filePath);
				return frontmatter[customProp.key] === customProp.value;
			} catch {
				return false;
			}
		}

		return isEventDone(this.app, filePath, settings.statusProperty, settings.doneValue);
	}

	// ─── Navigation ───────────────────────────────────────────────

	private openEventPreview(event: CalendarEventInfo): void {
		const previewEvent: PreviewEventData = {
			title: event.title,
			start: intoDate(event.start),
			end: event.end ? intoDate(event.end) : undefined,
			allDay: event.allDay || false,
			extendedProps: event.extendedProps,
		};
		showEventPreviewModal(this.app, this.bundle, previewEvent);
	}

	private showHoverPreview(targetEl: HTMLElement, containerEl: HTMLElement, filePath: string): void {
		const rect = targetEl.getBoundingClientRect();
		const syntheticEvent = new MouseEvent("mouseover", {
			clientX: rect.left + rect.width / 2,
			clientY: rect.top + rect.height / 2,
			bubbles: true,
			cancelable: true,
			ctrlKey: true,
			view: window,
		});

		targetEl.dispatchEvent(syntheticEvent);
		emitHover(this.app, containerEl, targetEl, syntheticEvent, filePath, this.bundle.calendarId);
	}

	openEditModal(event: CalendarEventInfo): void {
		new EventEditModal(this.app, this.bundle, event).open();
	}

	private goToSourceEvent(event: CalendarEventInfo): void {
		this.withSourceEvent(event, (sourceEvent, sourceFilePath) => {
			const eventDate = new Date(sourceEvent.start);
			this.calendarComponent.navigateToDate(eventDate, "timeGridWeek");

			setTimeout(() => {
				this.calendarComponent.highlightEventByPath(sourceFilePath, 5000);
			}, 300);

			new Notice("Navigated to source event");
		});
	}

	private editSourceEvent(event: CalendarEventInfo): void {
		this.withSourceEvent(event, (sourceEvent) => {
			this.openEditModal({
				title: sourceEvent.title,
				start: sourceEvent.start,
				...(isTimedEvent(sourceEvent) ? { end: sourceEvent.end } : {}),
				allDay: sourceEvent.allDay,
				extendedProps: {
					filePath: sourceEvent.ref.filePath,
					frontmatterDisplayData: sourceEvent.meta,
				},
			});
		});
	}

	private withSourceEvent(
		event: CalendarEventInfo,
		action: (sourceEvent: CalendarEvent, sourceFilePath: string) => void
	): void {
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

		action(sourceEvent, sourceFilePath);
	}

	private showEventSeries(event: CalendarEventInfo): void {
		const settings = this.bundle.settingsStore.currentSettings;
		const frontmatter = event.extendedProps?.frontmatterDisplayData;
		const filePath = event.extendedProps?.filePath ?? null;

		const nameKey =
			getEventName(settings.titleProp, frontmatter ?? {}, filePath, settings.calendarTitleProp)?.toLowerCase() ?? null;
		const rruleId = this.isRecurringEvent(event) ? this.getRRuleId(event) : null;
		const categoryValues =
			settings.categoryProp && frontmatter ? parseIntoList(frontmatter[settings.categoryProp]) : [];

		new EventSeriesModal(
			this.app,
			this.bundle,
			nameKey,
			rruleId,
			categoryValues.length > 0 ? categoryValues : null
		).open();
	}

	// ─── Event Actions ────────────────────────────────────────────

	async markEventAsDone(event: CalendarEventInfo): Promise<void> {
		await this.toggleDoneState(event, true);
	}

	async markEventAsUndone(event: CalendarEventInfo): Promise<void> {
		await this.toggleDoneState(event, false);
	}

	private async toggleDoneState(event: CalendarEventInfo, done: boolean): Promise<void> {
		const label = done ? "done" : "undone";
		const command = done ? markAsDone : markAsUndone;
		await this.withFilePath(event, `mark event as ${label}`, async (filePath) => {
			await this.runCommand(() => command(this.app, this.bundle, filePath), {
				success: `Event marked as ${label}`,
				error: `Failed to mark event as ${label}`,
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

	async duplicateRemainingWeekDays(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "duplicate remaining week days", async (filePath) => {
			const startDate = event.start ? new Date(event.start) : null;
			if (!startDate) {
				new Notice("Cannot duplicate: event has no start date");
				return;
			}

			// JS getDay(): 0=Sun, 1=Mon, ..., 6=Sat — Sunday has 0 remaining days
			const dayOfWeek = startDate.getDay();
			const remainingDays = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;

			if (remainingDays === 0) {
				new Notice("No remaining days in the week to duplicate to");
				return;
			}

			const cloneCommands = Array.from({ length: remainingDays }, (_, i) => {
				const offsetMs = (i + 1) * MS_PER_DAY;
				return new CloneEventCommand(this.app, this.bundle, filePath, offsetMs, offsetMs);
			});

			const macro = new MacroCommand(cloneCommands);
			await this.runCommand(() => macro, {
				success: `Event duplicated to ${remainingDays} remaining day${remainingDays > 1 ? "s" : ""} of the week`,
				error: "Failed to duplicate event to remaining week days",
			});
		});
	}

	moveEventBy(event: CalendarEventInfo): void {
		const isAllDay = event.allDay || false;

		void this.withFilePath(event, "move event", (filePath) => {
			showMoveByModal(this.app, (result) => {
				void (async () => {
					if (isAllDay && !isTimeUnitAllowedForAllDay(result.unit)) {
						console.warn(
							`[ContextMenu] Skipping MoveBy operation: Time unit "${result.unit}" is not allowed for all-day events. Only days, weeks, months, and years are supported.`
						);
						new Notice(`Cannot move all-day event by ${result.unit}. Please use days, weeks, months, or years.`, 5000);
						return;
					}

					const offset = { [result.unit]: result.value };
					await this.runCommand(() => moveEvent(this.app, this.bundle, filePath, offset, offset), {
						success: `Event moved by ${result.value} ${result.unit}`,
						error: "Failed to move event",
					});
				})();
			});
		});
	}

	async moveEventByWeeks(event: CalendarEventInfo, weeks: number): Promise<void> {
		await this.eventByWeeks(event, weeks, "move");
	}

	async cloneEventByWeeks(event: CalendarEventInfo, weeks: number): Promise<void> {
		await this.eventByWeeks(event, weeks, "clone");
	}

	private async eventByWeeks(event: CalendarEventInfo, weeks: number, mode: "move" | "clone"): Promise<void> {
		const direction = weeks > 0 ? "next" : "previous";
		await this.withFilePath(event, `${mode} event`, async (filePath) => {
			const offset = weekDuration(weeks);
			const command =
				mode === "move"
					? () => moveEvent(this.app, this.bundle, filePath, offset, offset)
					: () => new CloneEventCommand(this.app, this.bundle, filePath, offset, offset);
			await this.runCommand(command, {
				success: `Event ${mode === "move" ? "moved" : "cloned"} to ${direction} week`,
				error: `Failed to ${mode} event`,
			});
		});
	}

	async deleteEvent(event: CalendarEventInfo): Promise<void> {
		const kind = this.getEventKindForEvent(event);

		if (kind === "manual") {
			const virtualEventId = event.extendedProps?.virtualEventId;
			if (virtualEventId) {
				await this.bundle.virtualEventStore.remove(virtualEventId);
				new Notice("Virtual event deleted");
			}
			return;
		}

		await this.withFilePath(event, "delete event", async (filePath) => {
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
				await this.runCommand(() => toggleSkip(this.app, this.bundle, sourceFilePath), {
					success: "Recurring event toggled",
					error: "Failed to toggle recurring event",
				});
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
			showDeleteRecurringEventsModal(
				this.app,
				async () => {
					await this.bundle.recurringEventManager.deleteAllPhysicalInstances(rruleId);
					await onComplete();
				},
				() => {
					void onComplete();
				}
			);
		} else {
			await onComplete();
		}
	}

	async toggleSkipEvent(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "toggle skip event", async (filePath) => {
			await this.runCommand(() => toggleSkip(this.app, this.bundle, filePath), {
				success: "Event skip toggled",
				error: "Failed to toggle skip event",
			});
		});
	}

	private async triggerStopwatch(event: CalendarEventInfo): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		if (!settings.showStopwatch) {
			new Notice("Enable time tracker in settings to use this action");
			return;
		}
		await this.withFilePath(event, "trigger stopwatch", async () => {
			MinimizedModalManager.startStopwatchSession(this.app, this.bundle, event);
		});
	}

	private async openAssignCategoriesModal(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "assign categories", async (filePath) => {
			getFileByPathOrThrow(this.app, filePath);

			const settings = this.bundle.settingsStore.currentSettings;
			const currentCategories = getCategoriesFromFilePath(this.app, filePath, settings.categoryProp);
			const categories = this.bundle.categoryTracker.getCategoriesWithColors();

			openCategoryAssignModal(this.app, categories, settings.defaultNodeColor, currentCategories, (selected) => {
				void this.runCommand(() => assignCategories(this.app, this.bundle, filePath, selected), {
					success: "Categories updated",
					error: "Failed to assign categories",
				});
			});
		});
	}

	private async startPrerequisiteSelection(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "assign prerequisites", async (filePath) => {
			getFileByPathOrThrow(this.app, filePath);
			this.calendarComponent.enterPrerequisiteSelectionMode(filePath);
		});
	}

	// ─── Fill Time Actions ────────────────────────────────────────

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
		await this.fillTimeFromNow(event, "start");
	}

	async fillEndTimeFromNow(event: CalendarEventInfo): Promise<void> {
		await this.fillTimeFromNow(event, "end");
	}

	private async fillTimeFromNow(event: CalendarEventInfo, field: "start" | "end"): Promise<void> {
		const settings = this.bundle.settingsStore.currentSettings;
		const propName = field === "start" ? settings.startProp : settings.endProp;
		await this.withFilePath(event, `fill ${field} time`, async (filePath) => {
			const now = toLocalISOString(new Date());
			await this.runCommand(() => fillTime(this.app, filePath, propName, now), {
				success: `${field === "start" ? "Start" : "End"} time filled from current time`,
				error: `Failed to fill ${field} time`,
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

			await this.runCommand(() => fillTime(this.app, filePath, config.propertyName, timeValue), {
				success: config.successMessage,
				error: config.errorMessage,
			});
		});
	}

	// ─── Command Helpers ──────────────────────────────────────────

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

	// ─── Virtual Event Conversion ────────────────────────────────

	private async makeEventVirtual(event: CalendarEventInfo): Promise<void> {
		await this.withFilePath(event, "make virtual", async (filePath) => {
			const result = getFileAndFrontmatter(this.app, filePath);
			if (!result) return;

			const { frontmatter } = result;
			const start = toSafeLocalISO(event.start);
			const end = toSafeLocalISOOrNull(event.end);

			await this.bundle.virtualEventStore.add({
				title: event.title,
				start,
				end,
				allDay: event.allDay ?? false,
				properties: frontmatter,
			});

			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (file) {
				await this.app.vault.trash(file, true);
			}

			new Notice("Event converted to virtual");
		});
	}

	private async makeEventReal(event: CalendarEventInfo): Promise<void> {
		const virtualEventId = event.extendedProps?.virtualEventId;
		if (!virtualEventId) {
			new Notice("Failed to make real: no virtual event ID found");
			return;
		}

		const virtualData = this.bundle.virtualEventStore.getById(virtualEventId);
		if (!virtualData) {
			new Notice("Failed to make real: virtual event not found");
			return;
		}

		await this.bundle.virtualEventStore.remove(virtualEventId);

		await this.bundle.createEvent({
			title: virtualData.title,
			start: virtualData.start,
			end: virtualData.end,
			allDay: virtualData.allDay,
			virtual: false,
			preservedFrontmatter: virtualData.properties as Record<string, unknown>,
		});

		new Notice("Virtual event converted to real");
	}
}
