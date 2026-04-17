import type { ModalButtonOptions } from "./types";

export function createModalButtons(
	container: HTMLElement,
	{ prefix, submitText, submitCls, submitTestId, cancelTestId, onSubmit, onCancel }: ModalButtonOptions
): { submitButton: HTMLButtonElement; cancelButton: HTMLButtonElement } {
	const buttonContainer = container.createDiv(`${prefix}modal-button-container`);

	const cancelButton = buttonContainer.createEl("button", { text: "Cancel" });
	if (cancelTestId) cancelButton.setAttribute("data-testid", cancelTestId);
	cancelButton.addEventListener("click", onCancel);

	const submitButton = buttonContainer.createEl("button", {
		text: submitText,
		cls: submitCls ?? "mod-cta",
	});
	if (submitTestId) submitButton.setAttribute("data-testid", submitTestId);
	submitButton.addEventListener("click", onSubmit);

	return { submitButton, cancelButton };
}

export function registerSubmitHotkey(scope: { register: CallableFunction }, onSubmit: () => void): void {
	scope.register([], "Enter", (e: KeyboardEvent) => {
		// Ignore Enter presses inside text inputs / textareas / contenteditable —
		// those fields have their own Enter handling (e.g., commit a participant
		// chip, a chip-list entry, or submit an assignment-modal search pick).
		// Firing onSubmit here also would close the parent modal mid-entry.
		const target = e.target as HTMLElement | null;
		if (target) {
			const tag = target.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable) return;
		}
		e.preventDefault();
		onSubmit();
		return false;
	});
}
