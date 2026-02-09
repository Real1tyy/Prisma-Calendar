import { type App, Modal, Setting } from "obsidian";

export class ConfirmDeleteModal extends Modal {
	constructor(
		app: App,
		private entityName: string,
		private entityType: string,
		private onConfirm: () => void
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl("h2", { text: `Delete ${this.entityType}` });
		contentEl.createEl("p", {
			text: `Are you sure you want to delete the ${this.entityType} "${this.entityName}"?`,
		});

		new Setting(contentEl)
			.addButton((button) => {
				button.setButtonText("Cancel").onClick(() => {
					this.close();
				});
			})
			.addButton((button) => {
				button
					.setButtonText("Delete")
					.setWarning()
					.onClick(() => {
						this.onConfirm();
						this.close();
					});
			});
	}

	onClose(): void {
		const { contentEl } = this;
		contentEl.empty();
	}
}
