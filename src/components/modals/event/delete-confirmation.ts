import { cls, showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

interface DeleteConfirmationConfig {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
}

function renderDeleteConfirmation(el: HTMLElement, config: DeleteConfirmationConfig, close: () => void): void {
	el.createEl("h2", { text: config.title });

	const messageEl = el.createDiv({ cls: cls("modal-message") });
	messageEl.createEl("p", { text: config.message });

	const buttonRow = el.createDiv({ cls: cls("modal-buttons") });

	const cancelButton = buttonRow.createEl("button", {
		text: config.cancelText || "No",
	});
	cancelButton.addEventListener("click", () => {
		const result = config.onCancel?.();
		if (result instanceof Promise) {
			void result.catch((error) => {
				console.error("[DeleteEvents] Error in onCancel callback:", error);
			});
		}
		close();
	});

	const confirmButton = buttonRow.createEl("button", {
		text: config.confirmText || "Yes, delete all",
		cls: "mod-cta",
	});
	confirmButton.addEventListener("click", () => {
		void Promise.resolve(config.onConfirm())
			.then(() => close())
			.catch((error) => {
				console.error("[DeleteEvents] Error in onConfirm callback:", error);
				close();
			});
	});
}

function showDeleteConfirmationModal(app: App, config: DeleteConfirmationConfig): void {
	showModal({
		app,
		cls: cls("delete-physical-events-modal"),
		render: (el, ctx) => renderDeleteConfirmation(el, config, ctx.close),
	});
}

export function showDeleteRecurringEventsModal(
	app: App,
	onConfirm: () => void | Promise<void>,
	onCancel?: () => void
): void {
	showDeleteConfirmationModal(app, {
		title: "Delete associated events?",
		message: "This recurring event has physical instances. Do you want to delete all associated physical events?",
		confirmText: "Yes, delete all",
		cancelText: "No",
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

	showDeleteConfirmationModal(app, {
		title,
		message,
		confirmText,
		cancelText,
		onConfirm: options.onConfirm,
		...(options.onCancel ? { onCancel: options.onCancel } : {}),
	});
}
