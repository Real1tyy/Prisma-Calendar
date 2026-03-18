import { showConfirmationModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

export function showDeleteRecurringEventsModal(
	app: App,
	onConfirm: () => void | Promise<void>,
	onCancel?: () => void
): void {
	showConfirmationModal(app, {
		title: "Delete associated events?",
		message: "This recurring event has physical instances. Do you want to delete all associated physical events?",
		confirmButton: "Yes, delete all",
		cancelButton: "No",
		onConfirm,
		...(onCancel ? { onCancel } : {}),
	});
}

export interface CalendarIntegrationDeleteEventsOptions {
	accountName?: string;
	calendarIdentifier?: string;
	eventCount: number;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
}

export function showCalendarIntegrationDeleteEventsModal(
	app: App,
	options: CalendarIntegrationDeleteEventsOptions
): void {
	const title = options.accountName ? "Delete account?" : "Remove calendar?";

	const message = options.accountName
		? `The account "${options.accountName}" has ${options.eventCount} event(s). Do you want to delete the account and all associated events, or just the account (keeping events)?`
		: `The calendar "${options.calendarIdentifier}" has ${options.eventCount} event(s). Do you want to remove the calendar and delete all associated events, or just remove the calendar (keeping events)?`;

	const confirmText = options.accountName ? "Delete account and events" : "Remove calendar and delete events";
	const cancelText = options.accountName ? "Delete account only" : "Remove calendar only";

	showConfirmationModal(app, {
		title,
		message,
		confirmButton: confirmText,
		cancelButton: cancelText,
		onConfirm: options.onConfirm,
		...(options.onCancel ? { onCancel: options.onCancel } : {}),
	});
}
