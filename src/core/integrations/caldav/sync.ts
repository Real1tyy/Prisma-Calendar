import { type App, normalizePath, type TFile, TFolder } from "obsidian";
import type { Subscription } from "rxjs";
import type { CustomCalendarSettings } from "../../../types/settings";
import type { CalendarBundle } from "../../calendar-bundle";
import type { SettingsStore } from "../../settings-store";
import {
	buildFrontmatterFromImportedEvent,
	type ImportedEvent,
	type ImportFrontmatterSettings,
	parseICSContent,
} from "../ics-import";
import { CalDAVClientService, type CalDAVFetchedEvent } from "./client";
import type { CalDAVAccount, CalDAVCalendarInfo, CalDAVSyncMetadata, CalDAVSyncResult } from "./types";

export interface CalDAVSyncServiceOptions {
	app: App;
	bundle: CalendarBundle;
	mainSettingsStore: SettingsStore;
	account: CalDAVAccount;
	calendar: CalDAVCalendarInfo;
}

export class CalDAVSyncService {
	private app: App;
	private bundle: CalendarBundle;
	private mainSettingsStore: SettingsStore;
	private account: CalDAVAccount;
	private calendar: CalDAVCalendarInfo;
	private client: CalDAVClientService;
	private settingsSubscription: Subscription | null = null;

	constructor(options: CalDAVSyncServiceOptions) {
		this.app = options.app;
		this.bundle = options.bundle;
		this.mainSettingsStore = options.mainSettingsStore;
		this.account = options.account;
		this.calendar = options.calendar;
		this.client = new CalDAVClientService(this.account);
	}

	async initialize(): Promise<void> {
		await this.client.initialize();
		this.subscribeToSettingsChanges();
	}

	private subscribeToSettingsChanges(): void {
		this.settingsSubscription = this.mainSettingsStore.settings$.subscribe((settings: CustomCalendarSettings) => {
			const updatedAccount = settings.caldav.accounts.find((a: CalDAVAccount) => a.id === this.account.id);
			if (updatedAccount) {
				this.account = updatedAccount;
			}
		});
	}

	async sync(): Promise<CalDAVSyncResult> {
		if (!this.account.enabled) {
			return {
				success: false,
				accountId: this.account.id,
				calendarUrl: this.calendar.url,
				created: 0,
				updated: 0,
				deleted: 0,
				errors: ["Account is disabled"],
			};
		}

		const result: CalDAVSyncResult = {
			success: true,
			accountId: this.account.id,
			calendarUrl: this.calendar.url,
			created: 0,
			updated: 0,
			deleted: 0,
			errors: [],
		};

		try {
			const events = await this.client.fetchCalendarEvents({ calendar: this.calendar });

			for (const event of events) {
				try {
					await this.createNoteFromEvent(event);
					result.created++;
				} catch (error) {
					result.errors.push(`Failed to sync event ${event.url}: ${error}`);
				}
			}
		} catch (error) {
			result.success = false;
			result.errors.push(error instanceof Error ? error.message : String(error));
		}

		return result;
	}

	private async createNoteFromEvent(event: CalDAVFetchedEvent): Promise<void> {
		const parsed = parseICSContent(event.data);
		if (!parsed.success || parsed.events.length === 0) {
			return;
		}

		const importedEvent = parsed.events[0];
		const folderPath = this.getSyncFolderPath();
		await this.ensureFolderExists(folderPath);

		const fileName = this.generateFileName(importedEvent);
		const filePath = normalizePath(`${folderPath}/${fileName}.md`);

		const bodyContent = importedEvent.description || "";
		const file: TFile = await this.app.vault.create(filePath, bodyContent);

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const settings = this.getImportFrontmatterSettings();
			const eventFm = buildFrontmatterFromImportedEvent(importedEvent, settings);

			for (const [key, value] of Object.entries(eventFm)) {
				fm[key] = value;
			}

			const caldavProp = this.bundle.settingsStore.currentSettings.caldavProp;
			const syncMeta: CalDAVSyncMetadata = {
				href: event.url,
				etag: event.etag,
				accountId: this.account.id,
				calendarUrl: this.calendar.url,
				uid: event.uid ?? importedEvent.uid,
			};
			fm[caldavProp] = syncMeta;
		});
	}

	private getSyncFolderPath(): string {
		return normalizePath(this.bundle.settingsStore.currentSettings.directory);
	}

	private async ensureFolderExists(folderPath: string): Promise<void> {
		const parts = folderPath.split("/");
		let currentPath = "";

		for (const part of parts) {
			currentPath = currentPath ? `${currentPath}/${part}` : part;
			const existing = this.app.vault.getAbstractFileByPath(currentPath);
			if (!existing) {
				await this.app.vault.createFolder(currentPath);
			} else if (!(existing instanceof TFolder)) {
				throw new Error(`Path ${currentPath} exists but is not a folder`);
			}
		}
	}

	private generateFileName(event: ImportedEvent): string {
		const title = event.title.replace(/[/\\?%*:|"<>]/g, "-").slice(0, 100);
		const dateStr = event.start.toISOString().slice(0, 10);
		return `${dateStr} ${title}`;
	}

	private getImportFrontmatterSettings(): ImportFrontmatterSettings {
		const config = this.bundle.settingsStore.currentSettings;
		return {
			startProp: config.startProp,
			endProp: config.endProp,
			dateProp: config.dateProp,
			allDayProp: config.allDayProp,
			titleProp: config.titleProp,
			minutesBeforeProp: config.minutesBeforeProp,
			daysBeforeProp: config.daysBeforeProp,
			categoryProp: config.categoryProp,
		};
	}

	destroy(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.client.destroy();
	}
}
