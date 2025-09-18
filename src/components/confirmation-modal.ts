import { Modal } from "obsidian";

export class ConfirmationModal extends Modal {
	private title: string;
	private message: string;
	private resolve: (confirmed: boolean) => void;

	constructor(app: any, title: string, message: string, resolve: (confirmed: boolean) => void) {
		super(app);
		this.title = title;
		this.message = message;
		this.resolve = resolve;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: this.title });
		contentEl.createEl("p", { text: this.message });

		const buttonContainer = contentEl.createDiv("modal-button-container");

		const confirmButton = buttonContainer.createEl("button", {
			text: "Delete",
			cls: "mod-warning",
		});
		confirmButton.addEventListener("click", () => {
			this.resolve(true);
			this.close();
		});

		const cancelButton = buttonContainer.createEl("button", {
			text: "Cancel",
		});
		cancelButton.addEventListener("click", () => {
			this.resolve(false);
			this.close();
		});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
