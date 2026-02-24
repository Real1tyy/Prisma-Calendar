import { Modal, type App } from "obsidian";
import { createModalButtons, registerSubmitHotkey } from "../../utils/dom-utils";

export class UntrackedEventCreateModal extends Modal {
	private titleInput!: HTMLInputElement;

	constructor(
		app: App,
		private readonly onSubmit: (title: string) => void | Promise<void>
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("prisma-untracked-event-modal");

		contentEl.createEl("h2", { text: "Create Untracked Event" });

		contentEl.createEl("div", {
			text: "Event Name",
			cls: "prisma-untracked-event-label",
		});

		this.titleInput = contentEl.createEl("input", {
			type: "text",
			placeholder: "My event",
			cls: "prisma-untracked-event-input",
		});

		createModalButtons(contentEl, {
			submitText: "Create",
			onSubmit: () => void this.submit(),
			onCancel: () => this.close(),
		});

		registerSubmitHotkey(this.scope, () => void this.submit());

		requestAnimationFrame(() => this.titleInput.focus());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async submit(): Promise<void> {
		const title = this.titleInput.value.trim();
		if (!title) {
			return;
		}

		this.close();
		await this.onSubmit(title);
	}
}
