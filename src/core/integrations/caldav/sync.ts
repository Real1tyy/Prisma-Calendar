import { sanitizeForFilename } from "@real1ty-obsidian-plugins/utils";
import { type App, normalizePath, TFolder } from "obsidian";
import type { Subscription } from "rxjs";
import type { CustomCalendarSettings } from "../../../types/settings";
import type { CalendarBundle } from "../../calendar-bundle";
import type { SettingsStore } from "../../settings-store";
import {
	buildFrontmatterFromImportedEvent,
	extractBasenameFromOriginalPath,
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
		console.debug(`[CalDAV] Syncing ${this.calendar.displayName}`);

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
			console.debug(`[CalDAV] Fetched ${events.length} event(s)`);

			for (const event of events) {
				try {
					await this.createNoteFromEvent(event);
					result.created++;
				} catch (error) {
					const errorMsg = `Failed to sync event ${event.url}: ${error}`;
					console.error(`[CalDAV] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}

			console.debug(`[CalDAV] Sync complete - created: ${result.created}, errors: ${result.errors.length}`);
		} catch (error) {
			result.success = false;
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`[CalDAV] Sync failed:`, errorMsg);
			result.errors.push(errorMsg);
		}

		return result;
	}

	private async createNoteFromEvent(event: CalDAVFetchedEvent): Promise<void> {
		console.debug(`[CalDAV] Full ICS data for ${event.url}:\n`, event.data);

		const parsed = parseICSContent(event.data);

		if (!parsed.success || parsed.events.length === 0) {
			throw new Error("Failed to parse ICS data");
		}

		const importedEvent = parsed.events[0];
		console.debug(`[CalDAV] Parsed event:`, {
			title: importedEvent.title,
			start: importedEvent.start,
			end: importedEvent.end,
			allDay: importedEvent.allDay,
		});

		const folderPath = this.getSyncFolderPath();
		await this.ensureFolderExists(folderPath);

		const settings = this.getImportFrontmatterSettings();
		const frontmatter = buildFrontmatterFromImportedEvent(importedEvent, settings);

		const caldavProp = this.bundle.settingsStore.currentSettings.caldavProp;
		const syncMeta: CalDAVSyncMetadata = {
			href: event.url,
			etag: event.etag,
			accountId: this.account.id,
			calendarUrl: this.calendar.url,
			uid: event.uid ?? importedEvent.uid,
			lastModified: importedEvent.lastModified,
		};
		frontmatter[caldavProp] = syncMeta;

		const content = importedEvent.description ? `\n${importedEvent.description}\n` : undefined;
		const baseName =
			extractBasenameFromOriginalPath(importedEvent.originalFilePath) ||
			sanitizeForFilename(importedEvent.title, { style: "preserve" }) ||
			"CalDAV Event";

		await this.bundle.templateService.createFile({
			title: importedEvent.title,
			targetDirectory: folderPath,
			filename: baseName,
			content,
			frontmatter,
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
