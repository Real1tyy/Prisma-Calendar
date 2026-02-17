import { Notice, TFile } from "obsidian";
import { CalendarView } from "../components/calendar-view";
import { EventCreateModal, EventEditModal, UntrackedEventCreateModal } from "../components/modals";
import type CustomCalendarPlugin from "../main";
import type { Frontmatter } from "../types";
import {
	assignListToFrontmatter,
	ensureFileHasZettelId,
	parseCustomDoneProperty,
	setEventBasics,
	setUntrackedEventBasics,
} from "../utils/calendar-events";
import { roundToNearestHour, toLocalISOString } from "../utils/format";
import { openFileInNewTab } from "../utils/obsidian";
import type { CalendarBundle } from "./calendar-bundle";
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

		const ensured = await ensureFileHasZettelId(this.plugin.app, activeFile, settings.zettelIdProp);
		const metadata = this.plugin.app.metadataCache.getFileCache(ensured.file);
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
			title: ensured.file.basename,
			start: startValue,
			end: endValue,
			allDay,
			extendedProps: {
				filePath: ensured.file.path,
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

		const result = await ensureFileHasZettelId(
			this.plugin.app,
			activeFile,
			bundle.settingsStore.currentSettings.zettelIdProp
		);
		if (result.file.path !== activeFile.path) {
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
		const filePath = await bundle.createEvent({
			filePath: null,
			title: input.title,
			start: input.start ?? "",
			end: input.end ?? null,
			allDay: input.allDay ?? false,
			preservedFrontmatter: frontmatter,
		});
		if (filePath) {
			void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		}
		return filePath;
	}

	async convertFileToEvent(input: PrismaConvertEventInput): Promise<boolean> {
		const bundle = this.resolveBundleOrNotice(input.calendarId);
		if (!bundle) return false;

		const file = this.plugin.app.vault.getAbstractFileByPath(input.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`File not found: ${input.filePath}`);
			return false;
		}

		const settings = bundle.settingsStore.currentSettings;
		const ensured = await ensureFileHasZettelId(this.plugin.app, file, settings.zettelIdProp);
		const frontmatter = this.buildFrontmatterFromInput(bundle, input);
		await this.plugin.app.fileManager.processFrontMatter(ensured.file, (fm) => {
			Object.assign(fm, frontmatter);
		});
		void this.plugin.rememberLastUsedCalendar(bundle.calendarId);
		return true;
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
			const end = allDay ? undefined : input.end;
			setEventBasics(frontmatter, settings, {
				title: input.title,
				start: input.start!,
				end,
				allDay,
			});
		} else {
			setUntrackedEventBasics(frontmatter, settings);
		}

		if (settings.categoryProp && input.categories) {
			assignListToFrontmatter(frontmatter, settings.categoryProp, input.categories);
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
