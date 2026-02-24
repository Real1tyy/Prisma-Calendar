import type { Command } from "@real1ty-obsidian-plugins";
import { Notice, TFile } from "obsidian";
import { CalendarView } from "../components/calendar-view";
import { EventCreateModal, EventEditModal, UntrackedEventCreateModal } from "../components/modals";
import type CustomCalendarPlugin from "../main";
import type { Frontmatter } from "../types";
import {
	assignListToFrontmatter,
	parseCustomDoneProperty,
	setEventBasics,
	setUntrackedEventBasics,
} from "../utils/event-frontmatter";
import { autoAssignCategories } from "../utils/event-matching";
import { ensureISOSuffix, roundToNearestHour, toLocalISOString } from "../utils/format";
import { openFileInNewTab } from "../utils/obsidian";
import type { CalendarBundle } from "./calendar-bundle";
import {
	AddZettelIdCommand,
	ConvertFileToEventCommand,
	CreateEventCommand,
	DeleteEventCommand,
	EditEventCommand,
	type EventData,
} from "./commands/event-commands";
import { MinimizedModalManager } from "./minimized-modal-manager";

interface PrismaEventInput {
	title?: string;
	start?: string;
	end?: string;
	allDay?: boolean;
	categories?: string[];
	location?: string;
	participants?: string[];
	markAsDone?: boolean;
	skip?: boolean;
	frontmatter?: Frontmatter;
}

interface PrismaCreateEventInput extends PrismaEventInput {
	title: string;
	calendarId?: string;
}

interface PrismaEditEventInput extends PrismaEventInput {
	filePath: string;
	calendarId?: string;
}

interface PrismaDeleteEventInput {
	filePath: string;
	calendarId?: string;
}

interface PrismaConvertEventInput extends PrismaEventInput {
	filePath: string;
	calendarId?: string;
}

interface PrismaCalendarApi {
	openCreateEventModal: (options?: {
		calendarId?: string;
		autoStartStopwatch?: boolean;
		openCreatedInNewTab?: boolean;
	}) => void;
	openEditActiveNoteModal: (options?: { calendarId?: string }) => Promise<boolean>;
	createUntrackedEvent: (title: string, options?: { calendarId?: string }) => Promise<string | null>;
	createEvent: (input: PrismaCreateEventInput) => Promise<string | null>;
	editEvent: (input: PrismaEditEventInput) => Promise<boolean>;
	deleteEvent: (input: PrismaDeleteEventInput) => Promise<boolean>;
	convertFileToEvent: (input: PrismaConvertEventInput) => Promise<boolean>;
	addZettelIdToActiveNote: (options?: { calendarId?: string }) => Promise<boolean>;
}

export class PrismaCalendarApiManager {
	private readonly apiGlobalKey = "PrismaCalendar";

	constructor(private readonly plugin: CustomCalendarPlugin) {}

	// ─── API Registration ─────────────────────────────────────────

	exposeProgrammaticApi(): void {
		const api: PrismaCalendarApi = {
			openCreateEventModal: (options) => {
				void this.openCreateEventModal(
					options?.calendarId,
					options?.autoStartStopwatch ?? false,
					options?.openCreatedInNewTab ?? false
				);
			},
			openEditActiveNoteModal: async (options) => {
				return await this.openEditActiveNoteModal(options?.calendarId);
			},
			createUntrackedEvent: async (title, options) => {
				return await this.createUntrackedEvent(title, options?.calendarId);
			},
			createEvent: async (input) => {
				return await this.createEvent(input);
			},
			editEvent: async (input) => {
				return await this.editEvent(input);
			},
			deleteEvent: async (input) => {
				return await this.deleteEvent(input);
			},
			convertFileToEvent: async (input) => {
				return await this.convertFileToEvent(input);
			},
			addZettelIdToActiveNote: async (options) => {
				return await this.addZettelIdToActiveNote(options?.calendarId);
			},
		};

		(window as unknown as Record<string, unknown>)[this.apiGlobalKey] = api;
	}

	unexposeProgrammaticApi(): void {
		delete (window as unknown as Record<string, unknown>)[this.apiGlobalKey];
	}

	// ─── Modal Actions ────────────────────────────────────────────

	openCreateUntrackedEventModal(): void {
		const bundle = this.resolveBundleOrNotice();
		if (!bundle) return;
		new UntrackedEventCreateModal(this.plugin.app, async (title) => {
			const filePath = await this.createUntrackedEvent(title, bundle.calendarId);
			if (filePath && !this.isCalendarViewFocused()) {
				await openFileInNewTab(this.plugin.app, filePath);
			}
		}).open();
	}

	async openCreateEventModal(
		calendarId?: string,
		autoStartStopwatch = false,
		openCreatedInNewTab = false
	): Promise<boolean> {
		const bundle = this.resolveBundleOrNotice(calendarId);
		if (!bundle) return false;

		if (autoStartStopwatch && MinimizedModalManager.hasMinimizedModal()) {
			MinimizedModalManager.stopAndSaveCurrentEvent(this.plugin.app, this.plugin.calendarBundles);
		}

		const settings = bundle.settingsStore.currentSettings;
		const now = new Date();
		const roundedStart = roundToNearestHour(now);
		const endDate = new Date(roundedStart);
		endDate.setMinutes(endDate.getMinutes() + settings.defaultDurationMinutes);

		const newEvent = {
			title: "",
			start: toLocalISOString(roundedStart),
			end: toLocalISOString(endDate),
			allDay: false,
			extendedProps: {
				filePath: null as string | null,
			},
		};

		const modal = new EventCreateModal(this.plugin.app, bundle, newEvent);
		if (autoStartStopwatch) {
			modal.setAutoStartStopwatch(true);
		}
		if (openCreatedInNewTab && !this.isCalendarViewFocused()) {
			modal.setOpenCreatedInNewTab(true);
		}
		modal.open();
		void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		return true;
	}

	async openEditActiveNoteModal(calendarId?: string): Promise<boolean> {
		const bundle = this.resolveBundleOrNotice(calendarId);
		if (!bundle) {
			return false;
		}

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!(activeFile instanceof TFile)) {
			new Notice("No file is currently open");
			return false;
		}

		const settings = bundle.settingsStore.currentSettings;
		if (settings.directory && !activeFile.path.startsWith(settings.directory)) {
			new Notice("Active note is outside the selected calendar directory");
			return false;
		}

		const metadata = this.plugin.app.metadataCache.getFileCache(activeFile);
		const frontmatter = metadata?.frontmatter ?? {};
		const allDayValue = frontmatter[settings.allDayProp];
		const allDay = allDayValue === true || allDayValue === "true";
		const startValue = allDay
			? (frontmatter[settings.dateProp] as string | undefined)
				? `${String(frontmatter[settings.dateProp])}T00:00:00`
				: null
			: ((frontmatter[settings.startProp] as string | undefined) ?? null);
		const endValue = allDay ? null : ((frontmatter[settings.endProp] as string | undefined) ?? null);

		const eventData = {
			title: activeFile.basename,
			start: startValue,
			end: endValue,
			allDay,
			extendedProps: {
				filePath: activeFile.path,
			},
		};

		new EventEditModal(this.plugin.app, bundle, eventData).open();
		void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		return true;
	}

	async addZettelIdToActiveNote(calendarId?: string): Promise<boolean> {
		const bundle = this.resolveBundleOrNotice(calendarId);
		if (!bundle) {
			return false;
		}

		const activeFile = this.plugin.app.workspace.getActiveFile();
		if (!(activeFile instanceof TFile)) {
			new Notice("No file is currently open");
			return false;
		}

		const command = new AddZettelIdCommand(this.plugin.app, bundle, activeFile.path);
		await bundle.commandManager.executeCommand(command);

		if (command.getRenamedFilePath()) {
			new Notice("ZettelID added and file renamed");
		} else {
			new Notice("ZettelID already present");
		}

		void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		return true;
	}

	// ─── Event Creation ───────────────────────────────────────────

	async createUntrackedEvent(title: string, calendarId?: string): Promise<string | null> {
		const bundle = this.resolveBundleOrNotice(calendarId);
		if (!bundle) return null;

		const settings = bundle.settingsStore.currentSettings;
		const preservedFrontmatter: Frontmatter = {};
		setUntrackedEventBasics(preservedFrontmatter, settings);

		const filePath = await bundle.createEvent({
			filePath: null,
			title,
			start: "",
			end: null,
			allDay: false,
			preservedFrontmatter,
		});

		if (filePath) {
			void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		}

		return filePath;
	}

	async createEvent(input: PrismaCreateEventInput): Promise<string | null> {
		const bundle = this.resolveBundleOrNotice(input.calendarId);
		if (!bundle) return null;

		const frontmatter = this.buildFrontmatterFromInput(bundle, input);
		const normalizedStart = input.start ? ensureISOSuffix(input.start) : "";
		const normalizedEnd = input.end ? ensureISOSuffix(input.end) : null;
		const filePath = await bundle.createEvent({
			filePath: null,
			title: input.title,
			start: normalizedStart,
			end: normalizedEnd,
			allDay: input.allDay ?? false,
			preservedFrontmatter: frontmatter,
		});
		if (filePath) {
			void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		}
		return filePath;
	}

	async editEvent(input: PrismaEditEventInput): Promise<boolean> {
		const result = this.buildEditEventCommand(input);
		if (!result) return false;

		await result.bundle.commandManager.executeCommand(result.command);
		return true;
	}

	async deleteEvent(input: PrismaDeleteEventInput): Promise<boolean> {
		const result = this.buildDeleteEventCommand(input);
		if (!result) return false;

		await result.bundle.commandManager.executeCommand(result.command);
		return true;
	}

	async convertFileToEvent(input: PrismaConvertEventInput): Promise<boolean> {
		const bundle = this.resolveBundleOrNotice(input.calendarId);
		if (!bundle) return false;

		const file = this.plugin.app.vault.getAbstractFileByPath(input.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`File not found: ${input.filePath}`);
			return false;
		}

		const frontmatter = this.buildFrontmatterFromInput(bundle, input);
		const command = new ConvertFileToEventCommand(this.plugin.app, bundle, file.path, frontmatter);
		await bundle.commandManager.executeCommand(command);
		void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		return true;
	}

	// ─── Undo / Redo ─────────────────────────────────────────────

	async undo(): Promise<boolean> {
		const bundle = this.resolveBundle();
		if (!bundle) return false;
		return await bundle.undo();
	}

	async redo(): Promise<boolean> {
		const bundle = this.resolveBundle();
		if (!bundle) return false;
		return await bundle.redo();
	}

	// ─── Command Builders (for batch execution) ─────────────────

	buildCreateEventCommand(input: PrismaCreateEventInput): { command: Command; bundle: CalendarBundle } | null {
		const bundle = this.resolveBundleOrNotice(input.calendarId);
		if (!bundle) return null;

		const frontmatter = this.buildFrontmatterFromInput(bundle, input);
		const normalizedStart = input.start ? ensureISOSuffix(input.start) : "";
		const normalizedEnd = input.end ? ensureISOSuffix(input.end) : null;
		const settings = bundle.settingsStore.currentSettings;

		const commandEventData: EventData = {
			filePath: null,
			title: input.title,
			start: normalizedStart,
			end: normalizedEnd ?? undefined,
			allDay: input.allDay ?? false,
			preservedFrontmatter: frontmatter,
		};

		const command = new CreateEventCommand(this.plugin.app, bundle, commandEventData, settings.directory);
		return { command, bundle };
	}

	buildEditEventCommand(input: PrismaEditEventInput): { command: Command; bundle: CalendarBundle } | null {
		const bundle = this.resolveBundleOrNotice(input.calendarId);
		if (!bundle) return null;

		const file = this.plugin.app.vault.getAbstractFileByPath(input.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`File not found: ${input.filePath}`);
			return null;
		}

		const metadata = this.plugin.app.metadataCache.getFileCache(file);
		const frontmatter: Frontmatter = metadata?.frontmatter ? { ...metadata.frontmatter } : {};
		const settings = bundle.settingsStore.currentSettings;

		this.patchEditFrontmatter(frontmatter, settings, bundle, input);

		const existingAllDay = frontmatter[settings.allDayProp] === true;
		const existingStart = existingAllDay
			? frontmatter[settings.dateProp]
				? `${String(frontmatter[settings.dateProp])}T00:00:00`
				: ""
			: ((frontmatter[settings.startProp] as string) ?? "");
		const existingEnd = (frontmatter[settings.endProp] as string) ?? undefined;

		const eventData: EventData = {
			filePath: file.path,
			title: input.title ?? file.basename,
			start: existingStart,
			end: existingEnd,
			allDay: existingAllDay,
			preservedFrontmatter: frontmatter,
		};

		const command = new EditEventCommand(this.plugin.app, file.path, eventData);
		return { command, bundle };
	}

	buildDeleteEventCommand(input: PrismaDeleteEventInput): { command: Command; bundle: CalendarBundle } | null {
		const bundle = this.resolveBundleOrNotice(input.calendarId);
		if (!bundle) return null;

		const file = this.plugin.app.vault.getAbstractFileByPath(input.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`File not found: ${input.filePath}`);
			return null;
		}

		const command = new DeleteEventCommand(this.plugin.app, bundle, file.path);
		return { command, bundle };
	}

	// ─── Utilities ───────────────────────────────────────────────

	private buildFrontmatterFromInput(bundle: CalendarBundle, input: PrismaEventInput): Frontmatter {
		const settings = bundle.settingsStore.currentSettings;
		const frontmatter: Frontmatter = {
			...(input.frontmatter ?? {}),
		};

		const hasTrackedDateData = Boolean(input.start);

		if (hasTrackedDateData) {
			const allDay = input.allDay === true;
			const normalizedStart = ensureISOSuffix(input.start!);
			const end = allDay ? undefined : input.end ? ensureISOSuffix(input.end) : undefined;
			setEventBasics(frontmatter, settings, {
				title: input.title,
				start: normalizedStart,
				end,
				allDay,
			});
		} else {
			setUntrackedEventBasics(frontmatter, settings);
		}

		if (settings.categoryProp && input.categories) {
			assignListToFrontmatter(frontmatter, settings.categoryProp, input.categories);
		} else if (settings.categoryProp && input.title) {
			const availableCategories = bundle.categoryTracker.getCategories();
			const autoAssigned = autoAssignCategories(input.title, settings, availableCategories);
			if (autoAssigned.length > 0) {
				assignListToFrontmatter(frontmatter, settings.categoryProp, autoAssigned);
			}
		}

		if (settings.locationProp && input.location !== undefined) {
			if (input.location.trim()) {
				frontmatter[settings.locationProp] = input.location.trim();
			} else {
				delete frontmatter[settings.locationProp];
			}
		}

		if (settings.participantsProp && input.participants) {
			assignListToFrontmatter(frontmatter, settings.participantsProp, input.participants);
		}

		if (settings.skipProp && input.skip !== undefined) {
			if (input.skip) {
				frontmatter[settings.skipProp] = true;
			} else {
				delete frontmatter[settings.skipProp];
			}
		}

		if (settings.statusProperty && input.markAsDone !== undefined) {
			const customDoneProp = parseCustomDoneProperty(settings.customDoneProperty);
			const customUndoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
			if (customDoneProp) {
				if (input.markAsDone) {
					frontmatter[customDoneProp.key] = customDoneProp.value;
				} else if (customUndoneProp) {
					frontmatter[customUndoneProp.key] = customUndoneProp.value;
				} else {
					delete frontmatter[customDoneProp.key];
				}
			} else {
				frontmatter[settings.statusProperty] = input.markAsDone ? settings.doneValue : settings.notDoneValue;
			}
		}

		return frontmatter;
	}

	private patchEditFrontmatter(
		frontmatter: Frontmatter,
		settings: CalendarBundle["settingsStore"]["currentSettings"],
		bundle: CalendarBundle,
		input: PrismaEditEventInput
	): void {
		// Patch date fields only if provided
		if (input.start !== undefined) {
			const allDay = input.allDay ?? frontmatter[settings.allDayProp] === true;
			if (allDay) {
				frontmatter[settings.dateProp] = input.start.split("T")[0];
				delete frontmatter[settings.startProp];
			} else {
				frontmatter[settings.startProp] = ensureISOSuffix(input.start);
				delete frontmatter[settings.dateProp];
			}
		}
		if (input.end !== undefined) {
			frontmatter[settings.endProp] = ensureISOSuffix(input.end);
		}
		if (input.allDay !== undefined) {
			frontmatter[settings.allDayProp] = input.allDay;
		}

		// Patch metadata fields only if provided
		if (input.categories !== undefined && settings.categoryProp) {
			assignListToFrontmatter(frontmatter, settings.categoryProp, input.categories);
		} else if (input.title !== undefined && settings.categoryProp && !input.categories) {
			const availableCategories = bundle.categoryTracker.getCategories();
			const autoAssigned = autoAssignCategories(input.title, settings, availableCategories);
			if (autoAssigned.length > 0) {
				assignListToFrontmatter(frontmatter, settings.categoryProp, autoAssigned);
			}
		}

		if (input.location !== undefined && settings.locationProp) {
			if (input.location.trim()) {
				frontmatter[settings.locationProp] = input.location.trim();
			} else {
				delete frontmatter[settings.locationProp];
			}
		}

		if (input.participants !== undefined && settings.participantsProp) {
			assignListToFrontmatter(frontmatter, settings.participantsProp, input.participants);
		}

		if (input.skip !== undefined && settings.skipProp) {
			if (input.skip) {
				frontmatter[settings.skipProp] = true;
			} else {
				delete frontmatter[settings.skipProp];
			}
		}

		if (input.markAsDone !== undefined && settings.statusProperty) {
			const customDoneProp = parseCustomDoneProperty(settings.customDoneProperty);
			const customUndoneProp = parseCustomDoneProperty(settings.customUndoneProperty);
			if (customDoneProp) {
				if (input.markAsDone) {
					frontmatter[customDoneProp.key] = customDoneProp.value;
				} else if (customUndoneProp) {
					frontmatter[customUndoneProp.key] = customUndoneProp.value;
				} else {
					delete frontmatter[customDoneProp.key];
				}
			} else {
				frontmatter[settings.statusProperty] = input.markAsDone ? settings.doneValue : settings.notDoneValue;
			}
		}

		// Merge any extra frontmatter properties
		if (input.frontmatter) {
			Object.assign(frontmatter, input.frontmatter);
		}
	}

	private resolveBundleOrNotice(calendarId?: string): CalendarBundle | null {
		const bundle = this.resolveBundle(calendarId);
		if (!bundle) {
			new Notice("No calendars available");
			return null;
		}
		return bundle;
	}

	private resolveBundle(calendarId?: string): CalendarBundle | null {
		if (this.plugin.calendarBundles.length === 0) {
			return null;
		}

		if (calendarId) {
			return this.plugin.calendarBundles.find((bundle) => bundle.calendarId === calendarId) ?? null;
		}

		const lastUsedCalendarId = this.plugin.syncStore.data.lastUsedCalendarId;
		if (lastUsedCalendarId) {
			const lastUsedBundle = this.plugin.calendarBundles.find((bundle) => bundle.calendarId === lastUsedCalendarId);
			if (lastUsedBundle) {
				return lastUsedBundle;
			}
		}

		return this.plugin.calendarBundles[0] ?? null;
	}

	private isCalendarViewFocused(): boolean {
		const activeView = this.plugin.app.workspace.getActiveViewOfType(CalendarView);
		return activeView !== null;
	}
}
