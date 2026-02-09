import { requestUrl, TFile } from "obsidian";
import type { CustomCalendarSettings } from "../../../types/settings";
import { BaseSyncService, type BaseSyncServiceOptions, yieldToMainThread } from "../base-sync-service";
import { type ImportedEvent, parseICSContent } from "../ics-import";
import type { ICSSubscriptionSyncStateManager } from "./sync-state-manager";
import type { ICSSubscription, ICSSubscriptionSyncMetadata, ICSSubscriptionSyncResult } from "./types";

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

		if (!this.subscription.enabled) {
			return {
				...defaultResult,
				success: false,
				errors: ["Subscription is disabled"],
			};
		}

		const result: ICSSubscriptionSyncResult = { ...defaultResult };

		try {
			const response = await requestUrl({
				url: this.subscription.url,
				method: "GET",
			});

			const icsContent = response.text;
			const parsed = parseICSContent(icsContent);

			if (!parsed.success) {
				throw new Error(parsed.error?.message || "Failed to parse ICS content");
			}

			const remoteUids = new Set<string>();

			let processedCount = 0;
			for (const event of parsed.events) {
				const uid = event.uid;
				if (!uid) continue;

				remoteUids.add(uid);

				try {
					const existingEvent = this.syncStateManager.findByUid(this.subscription.id, uid);

					if (existingEvent) {
						if (
							existingEvent.metadata.lastModified !== undefined &&
							event.lastModified !== undefined &&
							existingEvent.metadata.lastModified === event.lastModified
						) {
							continue;
						}
						await this.updateNoteFromEvent(existingEvent.filePath, event, uid);
						result.updated++;
					} else {
						await this.createNoteFromEvent(event, uid);
						result.created++;
					}

					processedCount++;
					if (processedCount % 3 === 0) {
						await yieldToMainThread();
					}
				} catch (error) {
					const errorMsg = `Failed to sync event "${event.title}": ${error}`;
					console.error(`[ICS Subscription] ${errorMsg}`);
					result.errors.push(errorMsg);
				}
			}

			const trackedEvents = this.syncStateManager.getAllForSubscription(this.subscription.id);
			for (const tracked of trackedEvents) {
				if (!remoteUids.has(tracked.metadata.uid)) {
					try {
						const file = this.app.vault.getAbstractFileByPath(tracked.filePath);
						if (file instanceof TFile) {
							await this.app.fileManager.trashFile(file);
							result.deleted++;
						}
					} catch (error) {
						const errorMsg = `Failed to delete event "${tracked.filePath}": ${error}`;
						console.error(`[ICS Subscription] ${errorMsg}`);
						result.errors.push(errorMsg);
					}
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

		await this.createNoteFromImportedEvent(event, this.subscription.timezone, {
			[icsSubscriptionProp]: syncMeta,
		});
	}

	private async updateNoteFromEvent(filePath: string, event: ImportedEvent, uid: string): Promise<void> {
		const icsSubscriptionProp = this.bundle.settingsStore.currentSettings.icsSubscriptionProp;

		const syncMeta: ICSSubscriptionSyncMetadata = {
			subscriptionId: this.subscription.id,
			uid,
			lastModified: event.lastModified,
			lastSyncedAt: Date.now(),
		};

		await this.updateNoteFromImportedEvent(filePath, event, this.subscription.timezone, {
			[icsSubscriptionProp]: syncMeta,
		});
	}
}
