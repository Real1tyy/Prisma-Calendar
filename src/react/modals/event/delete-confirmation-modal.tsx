import { ConfirmationModalContent, openConfirmation, openReactModal } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";

export function openDeleteRecurringEventsModal(app: App): Promise<boolean> {
	return openConfirmation(app, {
		title: "Delete associated events?",
		message: "This recurring event has physical instances. Do you want to delete all associated physical events?",
		confirmLabel: "Yes, delete all",
		cancelLabel: "No",
		destructive: true,
		testIdPrefix: "prisma-delete-recurring-",
	});
}

export interface CalendarIntegrationDeleteEventsOptions {
	accountName?: string;
	calendarIdentifier?: string;
	eventCount: number;
}

export function openCalendarIntegrationDeleteEventsModal(
	app: App,
	options: CalendarIntegrationDeleteEventsOptions
): Promise<"confirm" | "cancel" | null> {
	const title = options.accountName ? "Delete account?" : "Remove calendar?";

	const message = options.accountName
		? `The account "${options.accountName}" has ${options.eventCount} event(s). Do you want to delete the account and all associated events, or just the account (keeping events)?`
		: `The calendar "${options.calendarIdentifier}" has ${options.eventCount} event(s). Do you want to remove the calendar and delete all associated events, or just remove the calendar (keeping events)?`;

	const confirmText = options.accountName ? "Delete account and events" : "Remove calendar and delete events";
	const cancelText = options.accountName ? "Delete account only" : "Remove calendar only";

	return openReactModal<"confirm" | "cancel">({
		app,
		title,
		testId: "prisma-modal-integration-delete",
		render: (submit) => (
			<ConfirmationModalContent
				title={title}
				message={message}
				confirmLabel={confirmText}
				cancelLabel={cancelText}
				destructive
				testIdPrefix="prisma-integration-delete-"
				onConfirm={() => submit("confirm")}
				onCancel={() => submit("cancel")}
			/>
		),
	});
}

export function openConfirmDeleteModal(app: App, props: { entityName: string; entityType: string }): Promise<boolean> {
	return openConfirmation(app, {
		title: `Delete ${props.entityType}`,
		message: `Are you sure you want to delete the ${props.entityType} "${props.entityName}"?`,
		confirmLabel: "Delete",
		cancelLabel: "Cancel",
		destructive: true,
	});
}
