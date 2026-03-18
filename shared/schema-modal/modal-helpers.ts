import type { ModalButtonOptions } from "./types";

export function createModalButtons(
	container: HTMLElement,
	{ prefix, submitText, submitCls, onSubmit, onCancel }: ModalButtonOptions
): { submitButton: HTMLButtonElement; cancelButton: HTMLButtonElement } {
	const buttonContainer = container.createDiv(`${prefix}modal-button-container`);

	const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
	cancelButton.addEventListener("click", onCancel);

	const submitButton = buttonContainer.createEl("button", {
		text: submitText,
		cls: submitCls ?? "mod-cta",
	});
	submitButton.addEventListener("click", onSubmit);

	return { submitButton, cancelButton };
}

export function registerSubmitHotkey(scope: { register: CallableFunction }, onSubmit: () => void): void {
	scope.register([], "Enter", (e: KeyboardEvent) => {
		e.preventDefault();
		onSubmit();
		return false;
	});
}
