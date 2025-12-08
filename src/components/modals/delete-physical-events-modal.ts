import { cls } from "@real1ty-obsidian-plugins/utils";
import type { App } from "obsidian";
import { Modal } from "obsidian";

export class DeletePhysicalEventsModal extends Modal {
	private onConfirm: () => void | Promise<void>;
	private onCancel?: () => void;

	constructor(app: App, onConfirm: () => void | Promise<void>, onCancel?: () => void) {
		super(app);
		this.onConfirm = onConfirm;
		this.onCancel = onCancel;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass(cls("delete-physical-events-modal"));

		contentEl.createEl("h2", { text: "Delete associated events?" });

		const messageEl = contentEl.createDiv({ cls: cls("modal-message") });
		messageEl.createEl("p", {
			text: "This recurring event has physical instances. Do you want to delete all associated physical events?",
		});

		const buttonRow = contentEl.createDiv({ cls: cls("modal-buttons") });

		const cancelButton = buttonRow.createEl("button", { text: "No" });
		cancelButton.addEventListener("click", () => {
			this.onCancel?.();
			this.close();
		});

		const confirmButton = buttonRow.createEl("button", {
			text: "Yes, delete all",
			cls: "mod-cta",
		});
		confirmButton.addEventListener("click", async () => {
			await this.onConfirm();
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
