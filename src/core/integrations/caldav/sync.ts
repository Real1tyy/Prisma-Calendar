import { type KVBackend, LocalKV } from "@real1ty-obsidian-plugins";
import { TFile } from "obsidian";

import {
	type CalDAVAccount,
	type CalDAVCalendarInfo,
	type CalDAVCalendarSyncState,
	CalDAVCalendarSyncStateSchema,
} from "../../../types/integrations";
import type { CustomCalendarSettings } from "../../../types/settings";
import { BaseSyncService, type BaseSyncServiceOptions, yieldToMainThread } from "../base-sync-service";
import { parseICSContent } from "../ics-import";
import { CalDAVClientService, type CalDAVFetchedEvent } from "./client";
import { computeCaldavSyncPlan } from "./sync-planner";
import type { CalDAVSyncStateManager } from "./sync-state-manager";
import { isSyncTokenInvalidated } from "./sync-token-invalidation";
import type { CalDAVStoredCalendar, CalDAVSyncMetadata, CalDAVSyncResult } from "./types";

/**
 * localStorage namespace for the per-(account, calendar) sync-collection
 * cursor. Exported so tests can poke the same keys the production code
 * writes without encoding the format twice.
 */
export const CALDAV_SYNC_STATE_NAMESPACE = "prisma-calendar:caldav:sync-state";

interface CalDAVSyncServiceOptions extends BaseSyncServiceOptions {
	syncStateManager: CalDAVSyncStateManager;
	account: CalDAVAccount;
	calendar: CalDAVCalendarInfo;
	/**
	 * Override the device-local token store. Production code omits this and
	 * falls through to `window.localStorage`; tests inject an in-memory
	 * stand-in so they don't depend on (or mutate) the real browser store.
	 */
	syncTokenBackend?: KVBackend;
}

export class CalDAVSyncService extends BaseSyncService<CalDAVSyncResult> {
	private syncStateManager: CalDAVSyncStateManager;
	private account: CalDAVAccount;
	private calendar: CalDAVCalendarInfo;
	private client: CalDAVClientService;
	private syncStateKV: LocalKV<CalDAVCalendarSyncState>;

	constructor(options: CalDAVSyncServiceOptions) {
		super(options);
		this.syncStateManager = options.syncStateManager;
		this.account = options.account;
		this.calendar = options.calendar;
		this.client = new CalDAVClientService(this.app, this.account);
		this.syncStateKV = new LocalKV<CalDAVCalendarSyncState>({
			namespace: CALDAV_SYNC_STATE_NAMESPACE,
			schema: CalDAVCalendarSyncStateSchema,
			...(options.syncTokenBackend && { backend: options.syncTokenBackend }),
		});
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

	private get syncStateScope(): string {
		return `${this.account.id}:${this.calendar.url}`;
	}

	private getCalendarSyncState(): CalDAVCalendarSyncState {
		return this.syncStateKV.get(this.syncStateScope) ?? {};
	}

	private saveCalendarSyncState(patch: CalDAVCalendarSyncState): void {
		this.syncStateKV.merge(this.syncStateScope, patch);
	}

	private buildStoredCalendar(syncToken: string | undefined): CalDAVStoredCalendar {
		return {
			url: this.calendar.url,
			displayName: this.calendar.displayName,
			accountId: this.account.id,
			...(syncToken !== undefined && { syncToken }),
			objects: this.syncStateManager.getAllForCalendar(this.account.id, this.calendar.url).map((tracked) => ({
				url: tracked.metadata.objectHref,
				etag: tracked.metadata.etag,
				uid: tracked.metadata.uid,
			})),
		};
	}

	/**
	 * Run `client.syncCalendar` and, if the server reports the token stale or
	 * unknown, clear the persisted token and retry once from scratch. Callers
	 * get a uniform result shape regardless of which pass produced it.
	 */
	private async runSyncWithTokenFallback(): Promise<{
		created: CalDAVFetchedEvent[];
		updated: CalDAVFetchedEvent[];
		deleted: string[];
		newSyncToken?: string | undefined;
		usedFullResync: boolean;
	}> {
		const storedState = this.getCalendarSyncState();
		const storedToken = storedState.syncToken;

		try {
			const result = await this.client.syncCalendar(this.buildStoredCalendar(storedToken));
			return { ...result, usedFullResync: storedToken === undefined };
		} catch (error) {
			if (!storedToken || !isSyncTokenInvalidated(error)) {
				throw error;
			}
			console.warn(
				`[CalDAV][${this.calendar.displayName}] Sync token invalidated by server — falling back to full resync.`
			);
			this.saveCalendarSyncState({ syncToken: undefined });
			const result = await this.client.syncCalendar(this.buildStoredCalendar(undefined));
			return { ...result, usedFullResync: true };
		}
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
			const { created, updated, deleted, newSyncToken, usedFullResync } = await this.runSyncWithTokenFallback();

			// tsdav's `smartCollectionSync` returns created + updated as
			// separate buckets. The planner runs the full own-scope/foreign-scope
			// decision tree over both — same rules as before.
			const remoteEvents = [...created, ...updated];

			// A full resync can't produce trustworthy deletes (absence != deletion
			// in a non-token REPORT), so ignore whatever tsdav returned for
			// `deleted` on the first pass. Once we have a sync token, every
			// subsequent response carries authoritative RFC 6578 tombstones.
			const tombstonedObjectHrefs = usedFullResync ? [] : deleted;

			const plan = computeCaldavSyncPlan({
				accountId: this.account.id,
				calendarHref: this.calendar.url,
				remoteEvents,
				tombstonedObjectHrefs,
				findByUid: (uid) => this.syncStateManager.findByUid(this.account.id, this.calendar.url, uid),
				findByUidGlobal: (uid) => this.syncStateManager.findByUidGlobal(uid),
				findByObjectHref: (href) => this.syncStateManager.findByObjectHref(this.account.id, this.calendar.url, href),
			});

			let processedCount = 0;
			for (const action of plan.actions) {
				if (this.destroyed) break;

				try {
					if (action.kind === "create") {
						await this.createNoteFromEvent(action.event);
						result.created++;
					} else if (action.kind === "update") {
						const wasUpdated = await this.updateNoteFromEvent(action.filePath, action.event);
						if (wasUpdated) result.updated++;
					} else if (action.kind === "delete") {
						const file = this.app.vault.getAbstractFileByPath(action.filePath);
						if (file instanceof TFile) {
							await this.app.fileManager.trashFile(file);
						}
						this.syncStateManager.unregisterTracked(action.filePath);
						result.deleted++;
					} else {
						// skip-* actions are intentional no-ops.
						continue;
					}

					processedCount++;
					if (processedCount % 3 === 0) {
						await yieldToMainThread();
					}
				} catch (error) {
					const label =
						action.kind === "create" || action.kind === "update"
							? action.event.url
							: action.kind === "delete"
								? action.objectHref
								: action.kind;
					const errorMsg = `Failed to sync event ${label}: ${error}`;
					console.error(`[CalDAV Sync] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}

			// Only advance the token on a fully clean apply. If any action
			// failed — especially a delete — we can't advance, because the
			// server won't resend that tombstone under a newer token and the
			// local note would stay orphaned forever. Reusing the old token
			// means the next sync replays the batch; creates/updates are
			// idempotent via etag, and the failed delete gets another shot.
			if (!this.destroyed && result.errors.length === 0) {
				this.saveCalendarSyncState({
					syncToken: newSyncToken,
					lastSuccessfulSyncAt: Date.now(),
				});
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

		const file = await this.createNoteFromImportedEvent(importedEvent, this.account.timezone, {
			[caldavProp]: syncMeta,
		});
		this.syncStateManager.registerTracked(file.path, syncMeta);
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

		const { wasUpdated, filePath: newFilePath } = await this.updateNoteFromImportedEvent(
			filePath,
			importedEvent,
			this.account.timezone,
			{ [caldavProp]: syncMeta }
		);
		// Drop the stale entry before re-registering — otherwise the global
		// UID index's duplicate-detection guard trashes the new file when a
		// rename moves the note to a different path.
		if (newFilePath !== filePath) {
			this.syncStateManager.unregisterTracked(filePath);
		}
		this.syncStateManager.registerTracked(newFilePath, syncMeta);
		return wasUpdated;
	}

	override destroy(): void {
		super.destroy();
		this.client.destroy();
	}
}
