import { createModalButtons as createModalButtonsBase, registerSubmitHotkey } from "@real1ty-obsidian-plugins";

import { CSS_PREFIX } from "../constants";

export function createTextDiv(parent: HTMLElement, text: string, cls: string): HTMLDivElement {
	return parent.createEl("div", { text, cls });
}

export function toggleEventHighlight(
	eventId: string,
	className: string,
	add: boolean,
	scope: ParentNode = document
): void {
	const elements = scope.querySelectorAll<HTMLElement>(`[data-event-id="${eventId}"]`);
	for (let i = 0; i < elements.length; i++) {
		elements[i].classList.toggle(className, add);
	}
}

export function isPointInsideElement(x: number, y: number, el: Element | null | undefined): boolean {
	if (!el) return false;
	const rect = el.getBoundingClientRect();
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// ─── Modal Helpers ──────────────────────────────────────────

interface ModalButtonOptions {
	submitText: string;
	submitCls?: string;
	onSubmit: () => void;
	onCancel: () => void;
}

export function createModalButtons(
	container: HTMLElement,
	options: ModalButtonOptions
): { submitButton: HTMLButtonElement; cancelButton: HTMLButtonElement } {
	return createModalButtonsBase(container, { ...options, prefix: CSS_PREFIX });
}

export { registerSubmitHotkey };
