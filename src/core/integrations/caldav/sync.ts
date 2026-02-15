import type { CustomCalendarSettings } from "../../../types/settings";
import { BaseSyncService, type BaseSyncServiceOptions, yieldToMainThread } from "../base-sync-service";
import { parseICSContent } from "../ics-import";
import { CalDAVClientService, type CalDAVFetchedEvent } from "./client";
import type { CalDAVSyncStateManager } from "./sync-state-manager";
import type { CalDAVAccount, CalDAVCalendarInfo, CalDAVSyncMetadata, CalDAVSyncResult } from "./types";

interface CalDAVSyncServiceOptions extends BaseSyncServiceOptions {
	syncStateManager: CalDAVSyncStateManager;
	account: CalDAVAccount;
	calendar: CalDAVCalendarInfo;
}

export class CalDAVSyncService extends BaseSyncService<CalDAVSyncResult> {
	private syncStateManager: CalDAVSyncStateManager;
	private account: CalDAVAccount;
	private calendar: CalDAVCalendarInfo;
	private client: CalDAVClientService;

	constructor(options: CalDAVSyncServiceOptions) {
		super(options);
		this.syncStateManager = options.syncStateManager;
		this.account = options.account;
		this.calendar = options.calendar;
		this.client = new CalDAVClientService(this.app, this.account);
	}

	async initialize(): Promise<void> {
		await this.client.initialize();
		this.subscribeToSettingsChanges();
	}

	protected getSyncName(): string {
		return this.calendar.displayName;
	}

	protected shouldNotifyOnSync(): boolean {
		return this.mainSettingsStore.currentSettings.caldav.notifyOnSync;
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
			const events = await this.client.fetchCalendarEvents({
				calendar: this.calendar,
			});

			let processedCount = 0;
			for (const event of events) {
				try {
					const uid = event.uid ?? "";
					const existingEvent = this.syncStateManager.findByUid(this.account.id, this.calendar.url, uid);

					if (existingEvent) {
						if (existingEvent.metadata.etag === event.etag) {
							continue;
						}
						await this.updateNoteFromEvent(existingEvent.filePath, event);
						result.updated++;
					} else {
						await this.createNoteFromEvent(event);
						result.created++;
					}

					processedCount++;
					if (processedCount % 3 === 0) {
						await yieldToMainThread();
					}
				} catch (error) {
					const errorMsg = `Failed to sync event ${event.url}: ${error}`;
					console.error(`[CalDAV Sync] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}

			this.showSyncNotification(result);
		} catch (error) {
			result.success = false;
			const errorMsg = error instanceof Error ? error.message : String(error);
			console.error(`[CalDAV] Sync failed:`, errorMsg);
			result.errors.push(errorMsg);
			this.showSyncErrorNotification(errorMsg);
		}

		return result;
	}

	private async createNoteFromEvent(event: CalDAVFetchedEvent): Promise<void> {
		const parsed = parseICSContent(event.data);

		if (!parsed.success || parsed.events.length === 0) {
			throw new Error("Failed to parse ICS data");
		}

		const importedEvent = parsed.events[0];
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

		await this.createNoteFromImportedEvent(importedEvent, this.account.timezone, {
			[caldavProp]: syncMeta,
		});
	}

	private async updateNoteFromEvent(filePath: string, event: CalDAVFetchedEvent): Promise<void> {
		const parsed = parseICSContent(event.data);
		if (!parsed.success || parsed.events.length === 0) {
			throw new Error("Failed to parse ICS data");
		}

		const importedEvent = parsed.events[0];
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

		await this.updateNoteFromImportedEvent(filePath, importedEvent, this.account.timezone, {
			[caldavProp]: syncMeta,
		});
	}

	destroy(): void {
		super.destroy();
		this.client.destroy();
	}
}
