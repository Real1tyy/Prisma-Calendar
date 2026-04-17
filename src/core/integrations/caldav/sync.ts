import type { CalDAVAccount, CalDAVCalendarInfo } from "../../../types/integrations";
import type { CustomCalendarSettings } from "../../../types/settings";
import { BaseSyncService, type BaseSyncServiceOptions, yieldToMainThread } from "../base-sync-service";
import { parseICSContent } from "../ics-import";
import { CalDAVClientService, type CalDAVFetchedEvent } from "./client";
import { computeCaldavSyncPlan } from "./sync-planner";
import type { CalDAVSyncStateManager } from "./sync-state-manager";
import type { CalDAVSyncMetadata, CalDAVSyncResult } from "./types";

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

		if (this.destroyed) {
			return { ...defaultResult, success: false, errors: ["Sync service destroyed"] };
		}

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

			const plan = computeCaldavSyncPlan({
				accountId: this.account.id,
				calendarHref: this.calendar.url,
				remoteEvents: events,
				findByUid: (uid) => this.syncStateManager.findByUid(this.account.id, this.calendar.url, uid),
				findByUidGlobal: (uid) => this.syncStateManager.findByUidGlobal(uid),
			});

			let processedCount = 0;
			for (const action of plan.actions) {
				if (this.destroyed) break;

				// Every branch that performs IO wraps its own try/catch so a
				// single object-level failure (one bad ICS payload, one write
				// error) doesn't abort the rest of the batch. Mirrors the
				// per-event try/catch the pre-planner code had.
				try {
					if (action.kind === "create") {
						await this.createNoteFromEvent(action.event);
						result.created++;
					} else if (action.kind === "update") {
						const wasUpdated = await this.updateNoteFromEvent(action.filePath, action.event);
						if (wasUpdated) result.updated++;
					} else {
						// skip-unchanged / skip-foreign-uid / skip-missing-uid:
						// no IO, no counter increment. The planner has already
						// decided these are no-ops.
						continue;
					}

					processedCount++;
					if (processedCount % 3 === 0) {
						await yieldToMainThread();
					}
				} catch (error) {
					const url = action.kind === "create" || action.kind === "update" ? action.event.url : "";
					const errorMsg = `Failed to sync event ${url}: ${error}`;
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

	private async updateNoteFromEvent(filePath: string, event: CalDAVFetchedEvent): Promise<boolean> {
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

		return await this.updateNoteFromImportedEvent(filePath, importedEvent, this.account.timezone, {
			[caldavProp]: syncMeta,
		});
	}

	override destroy(): void {
		super.destroy();
		this.client.destroy();
	}
}
