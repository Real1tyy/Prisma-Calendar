import { type App, TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { EventPreviewModal } from "../components/event-preview-modal";
import type { SingleCalendarConfig } from "../types/settings";
import type { Indexer, IndexerEvent } from "./indexer";

interface NotificationEntry {
	eventId: string;
	filePath: string;
	title: string;
	notifyAt: Date;
	startDate: Date;
	isAllDay: boolean;
}

/**
 * Manages event notifications by:
 * - Listening to indexer events
 * - Calculating notification times based on settings and per-event overrides
 * - Maintaining sorted in-memory cache of pending notifications
 * - Periodically checking for notifications to trigger
 * - Marking events as already notified in frontmatter
 */
export class NotificationManager {
	private settings: SingleCalendarConfig;
	private settingsSubscription: Subscription | null = null;
	private indexerSubscription: Subscription | null = null;
	private checkInterval: number | null = null;

	// Sorted array of notification entries (sorted by notifyAt time)
	private notificationQueue: NotificationEntry[] = [];

	constructor(
		private app: App,
		private settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private indexer: Indexer
	) {
		this.settings = settingsStore.value;

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
			// When settings change, rebuild the notification queue
			this.rebuildNotificationQueue();
		});
	}

	async start(): Promise<void> {
		// Listen to indexer events
		this.indexerSubscription = this.indexer.events$.subscribe((event) => {
			this.handleIndexerEvent(event);
		});

		// Start periodic check (every minute)
		this.startPeriodicCheck();
	}

	stop(): void {
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;

		this.indexerSubscription?.unsubscribe();
		this.indexerSubscription = null;

		this.stopPeriodicCheck();
		this.notificationQueue = [];
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		if (!this.settings.enableNotifications) {
			return;
		}

		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.processEventSource(event.source.filePath, event.source.frontmatter);
				}
				break;
			case "file-deleted":
				this.removeNotification(event.filePath);
				break;
		}
	}

	private async processEventSource(filePath: string, frontmatter: Record<string, unknown>): Promise<void> {
		// Check if already notified
		const alreadyNotified = frontmatter[this.settings.alreadyNotifiedProp];
		if (alreadyNotified === true || alreadyNotified === "true") {
			this.removeNotification(filePath);
			return;
		}

		// Determine if this is a timed event or all-day event
		const startProp = frontmatter[this.settings.startProp];
		const dateProp = frontmatter[this.settings.dateProp];
		const allDayProp = frontmatter[this.settings.allDayProp];

		const isAllDay = allDayProp === true || allDayProp === "true" || !!dateProp;

		let startDate: Date | null = null;
		let minutesBefore: number | null = null;
		let daysBefore: number | null = null;

		if (isAllDay && dateProp) {
			// All-day event
			startDate = new Date(String(dateProp));

			// Check for per-event override
			const daysBeforePropValue = frontmatter[this.settings.daysBeforeProp];
			if (daysBeforePropValue !== undefined && daysBeforePropValue !== null) {
				daysBefore = Number(daysBeforePropValue);
			} else if (this.settings.defaultDaysBefore !== undefined) {
				daysBefore = this.settings.defaultDaysBefore;
			}
		} else if (!isAllDay && startProp) {
			// Timed event
			startDate = new Date(String(startProp));

			// Check for per-event override
			const minutesBeforePropValue = frontmatter[this.settings.minutesBeforeProp];
			if (minutesBeforePropValue !== undefined && minutesBeforePropValue !== null) {
				minutesBefore = Number(minutesBeforePropValue);
			} else if (this.settings.defaultMinutesBefore !== undefined) {
				minutesBefore = this.settings.defaultMinutesBefore;
			}
		}

		// If we don't have a notification time, remove from queue
		if (!startDate || (minutesBefore === null && daysBefore === null)) {
			this.removeNotification(filePath);
			return;
		}

		// Calculate notification time
		const notifyAt = new Date(startDate);
		if (daysBefore !== null) {
			notifyAt.setDate(notifyAt.getDate() - daysBefore);
			// For all-day events, notify at 9 AM on the notification day
			notifyAt.setHours(9, 0, 0, 0);
		} else if (minutesBefore !== null) {
			notifyAt.setMinutes(notifyAt.getMinutes() - minutesBefore);
		}

		// Get title from frontmatter or file name
		const file = this.app.vault.getAbstractFileByPath(filePath);
		const title =
			(frontmatter[this.settings.titleProp || ""] as string) || (file instanceof TFile ? file.basename : filePath);

		// Add or update in notification queue
		this.addOrUpdateNotification({
			eventId: filePath,
			filePath,
			title,
			notifyAt,
			startDate,
			isAllDay,
		});
	}

	private addOrUpdateNotification(entry: NotificationEntry): void {
		// Remove existing notification for this file
		this.removeNotification(entry.filePath);

		// Only add if notification time is in the future
		if (entry.notifyAt <= new Date()) {
			return;
		}

		// Insert in sorted position
		const index = this.notificationQueue.findIndex((e) => e.notifyAt > entry.notifyAt);
		if (index === -1) {
			this.notificationQueue.push(entry);
		} else {
			this.notificationQueue.splice(index, 0, entry);
		}
	}

	private removeNotification(filePath: string): void {
		this.notificationQueue = this.notificationQueue.filter((e) => e.filePath !== filePath);
	}

	private startPeriodicCheck(): void {
		this.stopPeriodicCheck();

		// Check immediately
		this.checkPendingNotifications();

		// Check every minute
		this.checkInterval = window.setInterval(() => {
			this.checkPendingNotifications();
		}, 60000);
	}

	private stopPeriodicCheck(): void {
		if (this.checkInterval !== null) {
			window.clearInterval(this.checkInterval);
			this.checkInterval = null;
		}
	}

	private checkPendingNotifications(): void {
		if (!this.settings.enableNotifications) {
			return;
		}

		const now = new Date();
		const toNotify: NotificationEntry[] = [];

		// Find all notifications that should be triggered
		for (const entry of this.notificationQueue) {
			if (entry.notifyAt <= now) {
				toNotify.push(entry);
			} else {
				// Since queue is sorted, we can break early
				break;
			}
		}

		// Trigger notifications and mark as notified
		for (const entry of toNotify) {
			this.triggerNotification(entry);
		}
	}

	private async triggerNotification(entry: NotificationEntry): Promise<void> {
		try {
			// Remove from queue immediately
			this.removeNotification(entry.filePath);

			// Mark as notified in frontmatter
			await this.markAsNotified(entry.filePath);

			// Show notification modal
			this.showNotificationModal(entry);
		} catch (error) {
			console.error(`Error triggering notification for ${entry.filePath}:`, error);
		}
	}

	private async markAsNotified(filePath: string): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) {
			return;
		}

		try {
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm[this.settings.alreadyNotifiedProp] = true;
			});
		} catch (error) {
			console.error(`Error marking event as notified: ${filePath}:`, error);
		}
	}

	private showNotificationModal(entry: NotificationEntry): void {
		const file = this.app.vault.getAbstractFileByPath(entry.filePath);
		if (!(file instanceof TFile)) {
			return;
		}

		// Create a mock event object for EventPreviewModal
		const mockEvent = {
			title: entry.title,
			start: entry.startDate,
			end: entry.isAllDay ? null : entry.startDate,
			allDay: entry.isAllDay,
			extendedProps: {
				filePath: entry.filePath,
				frontmatterDisplayData: {},
			},
		};

		// Create custom modal that extends EventPreviewModal with custom title
		class NotificationModal extends EventPreviewModal {
			getModalTitle(): string {
				return "Event Notification";
			}

			async onOpen(): Promise<void> {
				await super.onOpen();
				// Override the title after rendering
				const titleEl = this.contentEl.querySelector(".event-preview-header h2");
				if (titleEl) {
					const originalTitle = titleEl.textContent || "";
					titleEl.textContent = `🔔 ${originalTitle}`;
				}
			}
		}

		// Show the notification modal
		new NotificationModal(this.app, this.getBundleStub(), mockEvent).open();
	}

	// Create a minimal bundle stub for EventPreviewModal
	private getBundleStub(): any {
		return {
			settingsStore: this.settingsStore,
		};
	}

	private async rebuildNotificationQueue(): Promise<void> {
		// Clear existing queue
		this.notificationQueue = [];

		// Re-scan all files and rebuild notifications
		// This will be handled naturally by indexer events when settings change triggers re-index
	}
}
