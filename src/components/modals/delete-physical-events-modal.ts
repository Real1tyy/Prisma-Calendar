import { cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { Modal } from "obsidian";

export interface DeleteConfirmationModalOptions {
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
}

export class DeletePhysicalEventsModal extends Modal {
	private options: DeleteConfirmationModalOptions;

	constructor(app: App, options: DeleteConfirmationModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("delete-physical-events-modal"));

		contentEl.createEl("h2", { text: this.options.title });

		const messageEl = contentEl.createDiv({ cls: cls("modal-message") });
		messageEl.createEl("p", {
			text: this.options.message,
		});

		const buttonRow = contentEl.createDiv({ cls: cls("modal-buttons") });

		const cancelButton = buttonRow.createEl("button", {
			text: this.options.cancelText || "No",
		});
		cancelButton.addEventListener("click", () => {
			const result = this.options.onCancel?.();
			if (result instanceof Promise) {
				void result.catch((error) => {
					console.error("Error in onCancel callback:", error);
				});
			}
			this.close();
		});

		const confirmButton = buttonRow.createEl("button", {
			text: this.options.confirmText || "Yes, delete all",
			cls: "mod-cta",
		});
		confirmButton.addEventListener("click", () => {
			void Promise.resolve(this.options.onConfirm())
				.then(() => {
					this.close();
				})
				.catch((error) => {
					console.error("Error in onConfirm callback:", error);
					this.close();
				});
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}

export class DeleteRecurringEventsModal extends DeletePhysicalEventsModal {
	constructor(app: App, onConfirm: () => void | Promise<void>, onCancel?: () => void) {
		super(app, {
			title: "Delete associated events?",
			message: "This recurring event has physical instances. Do you want to delete all associated physical events?",
			confirmText: "Yes, delete all",
			cancelText: "No",
			onConfirm,
			onCancel,
		});
	}
}

export interface CalendarIntegrationDeleteEventsModalOptions {
	accountName?: string;
	calendarIdentifier?: string;
	eventCount: number;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
}

export class CalendarIntegrationDeleteEventsModal extends DeletePhysicalEventsModal {
	constructor(app: App, options: CalendarIntegrationDeleteEventsModalOptions) {
		const title = options.accountName ? "Delete account?" : "Remove calendar?";

		const message = options.accountName
			? `The account "${options.accountName}" has ${options.eventCount} event(s). Do you want to delete the account and all associated events, or just the account (keeping events)?`
			: `The calendar "${options.calendarIdentifier}" has ${options.eventCount} event(s). Do you want to remove the calendar and delete all associated events, or just remove the calendar (keeping events)?`;

		const confirmText = options.accountName ? "Delete account and events" : "Remove calendar and delete events";
		const cancelText = options.accountName ? "Delete account only" : "Remove calendar only";

		super(app, {
			title,
			message,
			confirmText,
			cancelText,
			onConfirm: options.onConfirm,
			onCancel: options.onCancel,
		});
	}
}
