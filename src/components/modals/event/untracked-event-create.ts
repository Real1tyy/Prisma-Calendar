import { showModal } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import { createModalButtons, registerSubmitHotkey } from "../../../utils/dom-utils";

function renderUntrackedEventForm(
	el: HTMLElement,
	onSubmit: (title: string) => void | Promise<void>,
	close: () => void
): void {
	el.createEl("h2", { text: "Create Untracked Event" });

	el.createEl("div", {
		text: "Event Name",
		cls: "prisma-untracked-event-label",
	});

	const titleInput = el.createEl("input", {
		type: "text",
		placeholder: "My event",
		cls: "prisma-untracked-event-input",
	});

	async function submit(): Promise<void> {
		const title = titleInput.value.trim();
		if (!title) return;
		close();
		await onSubmit(title);
	}

	createModalButtons(el, {
		submitText: "Create",
		onSubmit: () => void submit(),
		onCancel: close,
	});

	requestAnimationFrame(() => titleInput.focus());
}

export function showUntrackedEventCreateModal(app: App, onSubmit: (title: string) => void | Promise<void>): void {
	showModal({
		app,
		cls: "prisma-untracked-event-modal",
		render: (el, ctx) => {
			renderUntrackedEventForm(el, onSubmit, ctx.close);
			if (ctx.type === "modal") {
				registerSubmitHotkey(ctx.scope, () => {
					const titleInput = el.querySelector<HTMLInputElement>("input");
					const title = titleInput?.value.trim();
					if (!title) return;
					ctx.close();
					void onSubmit(title);
				});
			}
		},
	});
}
