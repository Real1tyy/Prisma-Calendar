import { Modal, type App } from "obsidian";

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

		const buttons = contentEl.createDiv({ cls: "prisma-modal-button-container" });
		buttons.createEl("button", { text: "Cancel" }).addEventListener("click", () => this.close());

		buttons.createEl("button", { text: "Create", cls: "mod-cta" }).addEventListener("click", () => void this.submit());

		this.scope.register([], "Enter", (e) => {
			e.preventDefault();
			void this.submit();
			return false;
		});

		setTimeout(() => this.titleInput.focus(), 0);
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
