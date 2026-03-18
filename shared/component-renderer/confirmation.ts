import type { App } from "obsidian";

import { showModal } from "./modal";

export interface ConfirmationButton {
	text: string;
	cls?: string;
	warning?: boolean;
}

export interface ConfirmationModalConfig {
	title: string;
	message: string | ((el: HTMLElement) => void);
	confirmButton?: string | ConfirmationButton;
	cancelButton?: string | ConfirmationButton;
	cls?: string;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void | Promise<void>;
}

function resolveButton(
	input: string | ConfirmationButton | undefined,
	defaultText: string,
	defaultCls?: string
): { text: string; cls: string } {
	if (!input) return { text: defaultText, cls: defaultCls ?? "" };
	if (typeof input === "string") return { text: input, cls: defaultCls ?? "" };
	const cls = input.warning ? "mod-warning" : (input.cls ?? defaultCls ?? "");
	return { text: input.text, cls };
}

function renderConfirmation(el: HTMLElement, config: ConfirmationModalConfig, close: () => void): void {
	el.createEl("h2", { text: config.title });

	if (typeof config.message === "string") {
		el.createEl("p", { text: config.message });
	} else {
		config.message(el);
	}

	const confirm = resolveButton(config.confirmButton, "Confirm", "mod-cta");
	const cancel = resolveButton(config.cancelButton, "Cancel");

	const buttonRow = el.createDiv("confirmation-modal-buttons");

	const cancelButton = buttonRow.createEl("button", { text: cancel.text });
	if (cancel.cls) cancelButton.addClass(cancel.cls);
	cancelButton.addEventListener("click", () => {
		const result = config.onCancel?.();
		if (result instanceof Promise) {
			void result.catch((error) => console.error("[ConfirmationModal] onCancel error:", error));
		}
		close();
	});

	const confirmButton = buttonRow.createEl("button", { text: confirm.text });
	if (confirm.cls) confirmButton.addClass(confirm.cls);
	confirmButton.addEventListener("click", () => {
		void Promise.resolve(config.onConfirm())
			.then(() => close())
			.catch((error) => {
				console.error("[ConfirmationModal] onConfirm error:", error);
				close();
			});
	});
}

export function showConfirmationModal(app: App, config: ConfirmationModalConfig): void {
	showModal({
		app,
		cls: config.cls ?? "confirmation-modal",
		render: (el, ctx) => renderConfirmation(el, config, ctx.close),
	});
}

export function confirmAction(
	app: App,
	config: Omit<ConfirmationModalConfig, "onConfirm" | "onCancel">
): Promise<boolean> {
	let resolved = false;
	return new Promise<boolean>((resolve) => {
		const safeResolve = (value: boolean): void => {
			if (resolved) return;
			resolved = true;
			resolve(value);
		};

		showConfirmationModal(app, {
			...config,
			onConfirm: () => safeResolve(true),
			onCancel: () => safeResolve(false),
		});
	});
}
