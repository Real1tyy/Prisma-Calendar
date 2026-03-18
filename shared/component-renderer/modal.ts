import { Modal } from "obsidian";

import type { ModalComponentConfig, ModalContext } from "./types";

export function showModal(config: ModalComponentConfig): void {
	class ComponentModal extends Modal {
		override async onOpen(): Promise<void> {
			const { contentEl, modalEl } = this;
			contentEl.addClass(config.cls);
			if (config.title) this.setTitle(config.title);

			const ctx: ModalContext = {
				type: "modal",
				app: this.app,
				close: () => this.close(),
				modalEl,
				scope: this.scope,
			};

			await config.render(contentEl, ctx);
		}

		override onClose(): void {
			config.cleanup?.();
			this.contentEl.empty();
		}
	}

	new ComponentModal(config.app).open();
}
