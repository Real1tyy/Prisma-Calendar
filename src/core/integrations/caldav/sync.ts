import { sanitizeForFilename } from "@real1ty-obsidian-plugins/utils";
import { type App, Notice, normalizePath, TFile } from "obsidian";
import type { Subscription } from "rxjs";
import type { CustomCalendarSettings } from "../../../types/settings";
import { extractZettelId, removeZettelId } from "../../../utils/calendar-events";
import type { CalendarBundle } from "../../calendar-bundle";
import type { SettingsStore } from "../../settings-store";
import { buildFrontmatterFromImportedEvent, createEventNoteFromImportedEvent, parseICSContent } from "../ics-import";
import { CalDAVClientService, type CalDAVFetchedEvent } from "./client";
import type { CalDAVSyncStateManager } from "./sync-state-manager";
import type { CalDAVAccount, CalDAVCalendarInfo, CalDAVSyncMetadata, CalDAVSyncResult } from "./types";

export interface CalDAVSyncServiceOptions {
	app: App;
	bundle: CalendarBundle;
	mainSettingsStore: SettingsStore;
	syncStateManager: CalDAVSyncStateManager;
	account: CalDAVAccount;
	calendar: CalDAVCalendarInfo;
}

export class CalDAVSyncService {
	private app: App;
	private bundle: CalendarBundle;
	private mainSettingsStore: SettingsStore;
	private syncStateManager: CalDAVSyncStateManager;
	private account: CalDAVAccount;
	private calendar: CalDAVCalendarInfo;
	private client: CalDAVClientService;
	private settingsSubscription: Subscription | null = null;

	constructor(options: CalDAVSyncServiceOptions) {
		this.app = options.app;
		this.bundle = options.bundle;
		this.mainSettingsStore = options.mainSettingsStore;
		this.syncStateManager = options.syncStateManager;
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
		const defaultResult = {
			success: true,
			accountId: this.account.id,
			calendarUrl: this.calendar.url,
			created: 0,
			updated: 0,
			deleted: 0,
			errors: [] as string[],
		};

		if (!this.account.enabled) {
			return {
				...defaultResult,
				success: false,
				errors: ["Account is disabled"],
			};
		}

		const result: CalDAVSyncResult = { ...defaultResult };

		try {
			const events = await this.client.fetchCalendarEvents({ calendar: this.calendar });

			for (const event of events) {
				try {
					const uid = event.uid ?? "";
					const existingEvent = this.syncStateManager.findByUid(this.account.id, this.calendar.url, uid);

					if (existingEvent) {
						if (existingEvent.metadata.etag === event.etag) {
							continue; // Event unchanged, skip
						}
						await this.updateNoteFromEvent(existingEvent.filePath, event);
						result.updated++;
					} else {
						await this.createNoteFromEvent(event);
						result.created++;
					}
				} catch (error) {
					const errorMsg = `Failed to sync event ${event.url}: ${error}`;
					console.error(`[CalDAV Sync] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}

			const mainSettings = this.mainSettingsStore.currentSettings;
			if (mainSettings.caldav.notifyOnSync && (result.created > 0 || result.updated > 0 || result.errors.length > 0)) {
				const parts: string[] = [];
				if (result.created > 0) parts.push(`${result.created} created`);
				if (result.updated > 0) parts.push(`${result.updated} updated`);
				if (result.errors.length > 0) parts.push(`${result.errors.length} errors`);

				new Notice(`${this.calendar.displayName}: ${parts.join(", ")}`);
			}
		} catch (error) {
			result.success = false;
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`[CalDAV] Sync failed:`, errorMsg);
			result.errors.push(errorMsg);

			const mainSettings = this.mainSettingsStore.currentSettings;
			if (mainSettings.caldav.notifyOnSync) {
				new Notice(`${this.calendar.displayName} sync failed: ${errorMsg}`);
			}
		}

		return result;
	}

	private async createNoteFromEvent(event: CalDAVFetchedEvent): Promise<void> {
		const parsed = parseICSContent(event.data);

		if (!parsed.success || parsed.events.length === 0) {
			throw new Error("Failed to parse ICS data");
		}

		const importedEvent = parsed.events[0];
		const folderPath = this.getSyncFolderPath();
		const caldavProp = this.bundle.settingsStore.currentSettings.caldavProp;

		const syncMeta: CalDAVSyncMetadata = {
			accountId: this.account.id,
			calendarHref: this.calendar.url,
			objectHref: event.url,
			etag: event.etag,
			uid: event.uid ?? importedEvent.uid,
			lastModified: importedEvent.lastModified,
			lastSyncedAt: Date.now(),
		};

		await createEventNoteFromImportedEvent(this.app, this.bundle, importedEvent, {
			targetDirectory: folderPath,
			timezone: this.account.timezone,
			additionalFrontmatter: {
				[caldavProp]: syncMeta,
			},
		});
	}

	private async updateNoteFromEvent(filePath: string, event: CalDAVFetchedEvent): Promise<void> {
		let file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			throw new Error(`File not found: ${filePath}`);
		}

		const parsed = parseICSContent(event.data);
		if (!parsed.success || parsed.events.length === 0) {
			throw new Error("Failed to parse ICS data");
		}

		const importedEvent = parsed.events[0];
		const settings = this.bundle.settingsStore.currentSettings;

		// Check if title changed by comparing with the file's basename
		const currentBasenameWithoutZettel = removeZettelId(file.basename);
		const newTitle = sanitizeForFilename(importedEvent.title, { style: "preserve" });

		const titleChanged = currentBasenameWithoutZettel !== newTitle;

		// If title changed, rename the file first (preserving ZettelID)
		if (titleChanged) {
			const existingZettelId = extractZettelId(file.basename);
			if (existingZettelId) {
				const directory = file.parent?.path || "";
				const newFilename = `${newTitle} - ${existingZettelId}`;
				const newPath = directory ? `${directory}/${newFilename}.md` : `${newFilename}.md`;

				await this.app.fileManager.renameFile(file, newPath);

				file = this.app.vault.getAbstractFileByPath(newPath);
				if (!(file instanceof TFile)) {
					throw new Error(`File not found after rename: ${newPath}`);
				}
			}
		}

		await this.app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const eventFm = buildFrontmatterFromImportedEvent(importedEvent, settings, this.account.timezone);
			Object.assign(fm, eventFm);

			const caldavProp = this.bundle.settingsStore.currentSettings.caldavProp;
			const existingMeta = (fm[caldavProp] as Record<string, unknown>) || {};

			existingMeta.etag = event.etag;
			existingMeta.lastModified = importedEvent.lastModified;
			existingMeta.lastSyncedAt = Date.now();

			fm[caldavProp] = existingMeta;
		});
	}

	private getSyncFolderPath(): string {
		return normalizePath(this.bundle.settingsStore.currentSettings.directory);
	}

	destroy(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.client.destroy();
	}
}
