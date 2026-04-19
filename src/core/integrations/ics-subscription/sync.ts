import { requestUrl, TFile } from "obsidian";

import type { ICSSubscription } from "../../../types/integrations";
import type { CustomCalendarSettings } from "../../../types/settings";
import { BaseSyncService, type BaseSyncServiceOptions, yieldToMainThread } from "../base-sync-service";
import { type ImportedEvent, parseICSContent } from "../ics-import";
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

		if (!this.subscription.enabled) {
			return {
				...defaultResult,
				success: false,
				errors: ["Subscription is disabled"],
			};
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

			const plan = computeIcsSubscriptionSyncPlan({
				subscriptionId: this.subscription.id,
				remoteEvents: parsed.events,
				trackedBySubscription: this.syncStateManager.getAllForSubscription(this.subscription.id),
				findByUidGlobal: (uid) => this.syncStateManager.findByUidGlobal(uid),
			});

			let processedCount = 0;
			for (const action of plan.actions) {
				if (this.destroyed) break;

				try {
					if (action.kind === "create") {
						await this.createNoteFromEvent(action.event, action.uid);
						result.created++;
					} else if (action.kind === "update") {
						const wasUpdated = await this.updateNoteFromEvent(action.filePath, action.event, action.uid);
						if (wasUpdated) result.updated++;
					} else if (action.kind === "delete") {
						const file = this.app.vault.getAbstractFileByPath(action.filePath);
						if (file instanceof TFile) {
							await this.app.fileManager.trashFile(file);
							this.syncStateManager.unregisterTracked(action.filePath);
							result.deleted++;
						}
					}
					// skip-* actions are intentional no-ops.
					if (action.kind === "create" || action.kind === "update") {
						processedCount++;
						if (processedCount % 3 === 0) {
							await yieldToMainThread();
						}
					}
				} catch (error) {
					const label =
						"event" in action ? action.event.title : action.kind === "delete" ? action.filePath : action.kind;
					const errorMsg = `Failed to sync "${label}": ${error}`;
					console.error(`[ICS Subscription] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}

			this.showSyncNotification(result);
		} catch (error) {
			result.success = false;
			const errorMsg = error instanceof Error ? error.message : String(error);
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
			lastSyncedAt: Date.now(),
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
			lastSyncedAt: Date.now(),
		};

		const { wasUpdated, filePath: newFilePath } = await this.updateNoteFromImportedEvent(
			filePath,
			event,
			this.subscription.timezone,
			{ [icsSubscriptionProp]: syncMeta }
		);
		// File may have been renamed when the title changed. Drop the stale
		// entry so `tryTrackInGlobalIndex` doesn't flag the new path as a dup
		// of its own predecessor and trash it.
		if (newFilePath !== filePath) {
			this.syncStateManager.unregisterTracked(filePath);
		}
		this.syncStateManager.registerTracked(newFilePath, syncMeta);
		return wasUpdated;
	}
}
