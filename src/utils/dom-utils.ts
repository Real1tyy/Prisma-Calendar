export function createTextDiv(parent: HTMLElement, text: string, cls: string): HTMLDivElement {
	return parent.createEl("div", { text, cls });
}

/**
 * Toggles a CSS class on all DOM elements matching a data attribute selector.
 *
 * @param eventId - The event ID to match against the data-event-id attribute
 * @param className - The CSS class name to toggle (without prefix)
 * @param add - Whether to add (true) or remove (false) the class
 */
export function toggleEventHighlight(eventId: string, className: string, add: boolean): void {
	const elements = Array.from(document.querySelectorAll(`[data-event-id="${eventId}"]`));
	for (const element of elements) {
		if (element instanceof HTMLElement) {
			element.classList.toggle(className, add);
		}
	}
}
