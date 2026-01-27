import { SyncStore } from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { NotificationModal } from "../components/notification-modal";
import { MAX_PAST_NOTIFICATION_THRESHOLD } from "../constants";
import type { Frontmatter, PrismaSyncDataSchema } from "../types";
import type { SingleCalendarConfig } from "../types/settings";
import { toSafeString } from "../utils/format";
import { getFileByPathOrThrow, openFileInNewTab } from "../utils/obsidian";
import { parseAsLocalDate } from "../utils/time-formatter";
import type { Indexer, IndexerEvent } from "./indexer";

interface NotificationEntry {
	eventId: string;
	filePath: string;
	title: string;
	notifyAt: Date;
	startDate: Date;
	isAllDay: boolean;
	frontmatter: Frontmatter;
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
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private indexer: Indexer,
		private syncStore: SyncStore<typeof PrismaSyncDataSchema> | null
	) {
		this.settings = settingsStore.value;

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
			// When settings change, rebuild the notification queue
			this.rebuildNotificationQueue();
		});
	}

	async start(): Promise<void> {
		// Request notification permission if notifications are enabled
		if (this.settings.enableNotifications) {
			await this.requestNotificationPermission();
		}

		// Listen to indexer events
		this.indexerSubscription = this.indexer.events$.subscribe((event) => {
			this.handleIndexerEvent(event);
		});

		// Start periodic check (every minute)
		this.startPeriodicCheck();
	}

	private async requestNotificationPermission(): Promise<void> {
		if ("Notification" in window && Notification.permission === "default") {
			try {
				await Notification.requestPermission();
			} catch (error) {
				console.warn("Could not request notification permission:", error);
			}
		}
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
					this.processEventSource(event.source.filePath, event.source.frontmatter, event.source.isAllDay);
				}
				break;
			case "file-deleted":
				this.removeNotification(event.filePath);
				break;
		}
	}

	private processEventSource(filePath: string, frontmatter: Frontmatter, isAllDay: boolean): void {
		if (frontmatter[this.settings.skipProp] === true) {
			this.removeNotification(filePath);
			return;
		}

		const alreadyNotified = frontmatter[this.settings.alreadyNotifiedProp];
		if (alreadyNotified === true || alreadyNotified === "true") {
			this.removeNotification(filePath);
			return;
		}

		const dateProp = isAllDay ? this.settings.dateProp : this.settings.startProp;
		const dateValue = frontmatter[dateProp];
		const dateString = toSafeString(dateValue);

		if (!dateString) {
			this.removeNotification(filePath);
			return;
		}

		const startDate = parseAsLocalDate(dateString);
		if (!startDate) {
			this.removeNotification(filePath);
			return;
		}

		const notificationProp = isAllDay ? this.settings.daysBeforeProp : this.settings.minutesBeforeProp;
		const defaultValue = isAllDay ? this.settings.defaultDaysBefore : this.settings.defaultMinutesBefore;
		const notificationValue = frontmatter[notificationProp];
		const notificationAmount =
			notificationValue !== undefined && notificationValue !== null ? Number(notificationValue) : defaultValue;

		if (notificationAmount === undefined) {
			this.removeNotification(filePath);
			return;
		}

		const notificationMinutes = isAllDay ? notificationAmount * 24 * 60 : notificationAmount;
		const notifyAt = new Date(startDate);
		notifyAt.setMinutes(notifyAt.getMinutes() - notificationMinutes);

		if (isAllDay) {
			notifyAt.setHours(0, 0, 0, 0);
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		const title =
			(frontmatter[this.settings.titleProp || ""] as string) || (file instanceof TFile ? file.basename : filePath);

		const entry: NotificationEntry = {
			eventId: filePath,
			filePath,
			title,
			notifyAt,
			startDate,
			isAllDay,
			frontmatter,
		};

		// Check if notification is due
		const now = new Date();
		if (notifyAt <= now) {
			// Don't notify for events that are too far in the past
			const timeSinceEvent = now.getTime() - startDate.getTime();
			const maxPastThreshold = isAllDay
				? MAX_PAST_NOTIFICATION_THRESHOLD.ALL_DAY_EVENTS_MS
				: MAX_PAST_NOTIFICATION_THRESHOLD.TIMED_EVENTS_MS;

			if (timeSinceEvent > maxPastThreshold) {
				return;
			}

			void this.triggerNotification(entry);
		} else {
			this.addOrUpdateNotification(entry);
		}
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
			void this.triggerNotification(entry);
		}
	}

	private async triggerNotification(entry: NotificationEntry): Promise<void> {
		try {
			this.removeNotification(entry.filePath);
			await this.markAsNotified(entry.filePath);
			await this.showSystemNotification(entry);
			this.showNotificationModal(entry);
		} catch (error) {
			console.error(`[NotificationManager] ❌ Error triggering notification for ${entry.filePath}:`, error);
		}
	}

	private async showSystemNotification(entry: NotificationEntry): Promise<void> {
		// Check if Web Notifications API is available (Electron/Browser)
		if (!("Notification" in window)) {
			return;
		}

		try {
			// Request permission if not already granted
			if (Notification.permission === "default") {
				const permission = await Notification.requestPermission();
				if (permission !== "granted") {
					return;
				}
			}

			// Only show notification if permission is granted
			if (Notification.permission === "granted") {
				const eventTime = entry.isAllDay
					? "All-day event"
					: entry.startDate.toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						});

				const notification = new Notification("🔔 Prisma Calendar", {
					body: `${entry.title}\n${eventTime}`,
					icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='75' font-size='75'>📅</text></svg>",
					tag: entry.filePath, // Prevents duplicate notifications for the same event
					requireInteraction: false, // Auto-dismiss after a few seconds
					silent: !this.settings.notificationSound, // Play system sound based on setting
				});

				// Handle notification click - focus Obsidian and open the event
				notification.onclick = () => {
					window.focus();
					notification.close();
					void openFileInNewTab(this.app, entry.filePath);
				};
			}
		} catch (error) {
			console.error("Error showing system notification:", error);
		}
	}

	private async markAsNotified(filePath: string): Promise<void> {
		if (this.syncStore?.data.readOnly) {
			return;
		}

		try {
			const file = getFileByPathOrThrow(this.app, filePath);
			await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
				fm[this.settings.alreadyNotifiedProp] = true;
			});
		} catch (error) {
			console.error(`Error marking event as notified: ${filePath}:`, error);
		}
	}

	private showNotificationModal(entry: NotificationEntry): void {
		const eventData = {
			title: entry.title,
			filePath: entry.filePath,
			startDate: entry.startDate,
			isAllDay: entry.isAllDay,
			frontmatter: entry.frontmatter,
		};

		const onSnooze = () => {
			void this.snoozeNotification(entry);
		};

		new NotificationModal(this.app, eventData, this.settings, onSnooze).open();
	}

	private rebuildNotificationQueue(): void {
		// Clear existing queue
		this.notificationQueue = [];

		// Re-scan all files and rebuild notifications
		// This will be handled naturally by indexer events when settings change triggers re-index
	}

	private async snoozeNotification(entry: NotificationEntry): Promise<void> {
		try {
			const file = getFileByPathOrThrow(this.app, entry.filePath);

			if (entry.isAllDay) {
				console.warn(`[NotificationManager] ⚠️ Cannot snooze all-day event: ${entry.filePath}`);
				return;
			}

			await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
				fm[this.settings.alreadyNotifiedProp] = false;

				// Calculate minutesBefore so notification triggers exactly snoozeMinutes from NOW
				// Formula: We want notification at (now + snoozeMinutes)
				// minutesBefore = eventStart - desiredNotificationTime (in minutes)
				// minutesBefore = eventStart - (now + snoozeMinutes)
				// minutesBefore = (eventStart - now) - snoozeMinutes
				// minutesBefore = -(now - eventStart) - snoozeMinutes

				const now = new Date();
				const minutesFromEventStartToNow = (now.getTime() - entry.startDate.getTime()) / 60000;

				// If event hasn't started yet, calculate from event start
				// If event has started, calculate from now (will be negative)
				const snoozeMinutes: number = this.settings.snoozeMinutes;
				const newMinutesBefore = -minutesFromEventStartToNow - snoozeMinutes;

				fm[this.settings.minutesBeforeProp] = newMinutesBefore;
			});
		} catch (error) {
			console.error(`[NotificationManager] ❌ Error snoozing notification for ${entry.filePath}:`, error);
		}
	}
}
