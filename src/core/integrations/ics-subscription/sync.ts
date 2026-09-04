import { describeError } from "@real1ty/obsidian-plugins";
import { requestUrl } from "obsidian";

import type { ICSSubscription } from "../../../types/integrations";
import type { CustomCalendarSettings } from "../../../types/settings";
import { BaseSyncService, yieldToMainThread, type BaseSyncServiceOptions } from "../base-sync-service";
import { findImportedEventPathByUid, parseICSContent, type ImportedEvent } from "../ics-import";
import { computeIcsSubscriptionSyncPlan } from "./sync-planner";
import type { ICSSubscriptionSyncStateManager } from "./sync-state-manager";
import type { ICSSubscriptionSyncMetadata, ICSSubscriptionSyncResult } from "./types";

interface ICSSubscriptionSyncServiceOptions extends BaseSyncServiceOptions {
	syncStateManager: ICSSubscriptionSyncStateManager;
	subscription: ICSSubscription;
}

export class ICSSubscriptionSyncService extends BaseSyncService<ICSSubscriptionSyncResult> {
	private syncStateManager: ICSSubscriptionSyncStateManager;
	private subscription: ICSSubscription;

	constructor(options: ICSSubscriptionSyncServiceOptions) {
		super(options);
		this.syncStateManager = options.syncStateManager;
		this.subscription = options.subscription;

		this.subscribeToSettingsChanges();
	}

	protected getSyncName(): string {
		return this.subscription.name;
	}

	protected shouldNotifyOnSync(): boolean {
		return this.mainSettingsStore.currentSettings.icsSubscriptions.notifyOnSync;
	}

	private subscribeToSettingsChanges(): void {
		this.settingsSubscription = this.mainSettingsStore.settings$.subscribe((settings: CustomCalendarSettings) => {
			const updatedSubscription = settings.icsSubscriptions.subscriptions.find(
				(s: ICSSubscription) => s.id === this.subscription.id
			);
			if (updatedSubscription) {
				this.subscription = updatedSubscription;
			}
		});
	}

	async sync(): Promise<ICSSubscriptionSyncResult> {
		const defaultResult: ICSSubscriptionSyncResult = {
			success: true,
			subscriptionId: this.subscription.id,
			created: 0,
			updated: 0,
			deleted: 0,
			errors: [],
		};

		if (this.destroyed) {
			return { ...defaultResult, success: false, errors: ["Sync service destroyed"] };
		}
		// A read-only device performs no automatic writes; a sync is nothing but
		// automatic writes, so it does not even fetch.
		if (this.bundle.fileRepository.isReadOnly) return defaultResult;

		if (!this.subscription.enabled) {
			return {
				...defaultResult,
				success: false,
				errors: ["Subscription is disabled"],
			};
		}

		// Block until the indexer has fed every already-synced note into the
		// tracked-state map. A sync that races hydration (cold start, auto-sync
		// tick, or mid-resync) would see an empty map and re-create every event.
		await this.syncStateManager.whenHydrated();
		// Read through the accessor: TypeScript still carries the `false` narrowing
		// from the pre-await check across the `await`, so a direct `this.destroyed`
		// here reads as dead code — but `destroy()` can land while we wait.
		if (this.isDestroyed()) {
			return { ...defaultResult, success: false, errors: ["Sync service destroyed"] };
		}

		const result: ICSSubscriptionSyncResult = { ...defaultResult };

		try {
			const url = this.app.secretStorage.getSecret(this.subscription.urlSecretName) ?? "";
			if (!url) {
				throw new Error("ICS URL secret is not set or empty");
			}

			const response = await requestUrl({
				url,
				method: "GET",
			});

			const icsContent = response.text;
			const parsed = parseICSContent(icsContent);

			if (!parsed.success) {
				throw new Error(parsed.error?.message || "Failed to parse ICS content");
			}

			if (parsed.skipped.length > 0) {
				console.warn(
					`[ICSSubscription] ${this.subscription.name}: skipped ${parsed.skipped.length} malformed event(s)`,
					parsed.skipped
				);
			}

			const plan = computeIcsSubscriptionSyncPlan({
				subscriptionId: this.subscription.id,
				remoteEvents: parsed.events,
				trackedBySubscription: this.syncStateManager.getAllForSubscription(this.subscription.id),
				findByUidGlobal: (uid) => this.syncStateManager.findByUidGlobal(uid),
				findImportedByUid: (uid) => {
					const filePath = findImportedEventPathByUid(this.bundle, uid);
					return filePath ? { filePath } : null;
				},
				knownSubscriptionIds: this.mainSettingsStore.currentSettings.icsSubscriptions.subscriptions.map((s) => s.id),
			});

			let processedCount = 0;
			for (const action of plan.actions) {
				// destroyed may flip mid-loop via destroy() called from outside this async flow
				if ((this as unknown as { destroyed: boolean }).destroyed) break;

				try {
					if (action.kind === "create") {
						await this.createNoteFromEvent(action.event, action.uid);
						result.created++;
					} else if (action.kind === "update" || action.kind === "adopt") {
						const wasUpdated = await this.updateNoteFromEvent(action.filePath, action.event, action.uid);
						if (wasUpdated) result.updated++;
					} else if (action.kind === "delete") {
						if (await this.bundle.fileRepository.trashByPath(action.filePath)) {
							this.syncStateManager.unregisterTracked(action.filePath);
							result.deleted++;
						}
					}
					// skip-* actions are intentional no-ops.
					if (action.kind === "create" || action.kind === "update" || action.kind === "adopt") {
						processedCount++;
						if (processedCount % 3 === 0) {
							await yieldToMainThread();
						}
					}
				} catch (error) {
					const label =
						"event" in action ? action.event.title : action.kind === "delete" ? action.filePath : action.kind;
					const errorMsg = `Failed to sync "${label}": ${describeError(error)}`;
					console.error(`[ICS Subscription] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}

			this.showSyncNotification(result);
		} catch (error) {
			result.success = false;
			const errorMsg = describeError(error);
			console.error(`[ICS Subscription] Sync failed:`, errorMsg);
			result.errors.push(errorMsg);
			this.showSyncErrorNotification(errorMsg);
		}

		return result;
	}

	private async createNoteFromEvent(event: ImportedEvent, uid: string): Promise<void> {
		const icsSubscriptionProp = this.bundle.settingsStore.currentSettings.icsSubscriptionProp;

		const syncMeta: ICSSubscriptionSyncMetadata = {
			subscriptionId: this.subscription.id,
			uid,
			lastModified: event.lastModified,
		};

		const file = await this.createNoteFromImportedEvent(event, this.subscription.timezone, {
			[icsSubscriptionProp]: syncMeta,
		});
		this.syncStateManager.registerTracked(file.path, syncMeta);
	}

	private async updateNoteFromEvent(filePath: string, event: ImportedEvent, uid: string): Promise<boolean> {
		const icsSubscriptionProp = this.bundle.settingsStore.currentSettings.icsSubscriptionProp;

		const syncMeta: ICSSubscriptionSyncMetadata = {
			subscriptionId: this.subscription.id,
			uid,
			lastModified: event.lastModified,
		};

		const { wasUpdated, filePath: newFilePath } = await this.updateNoteFromImportedEvent(
			filePath,
			event,
			this.subscription.timezone,
			{ [icsSubscriptionProp]: syncMeta }
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
}
