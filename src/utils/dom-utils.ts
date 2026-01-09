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

/**
 * Checks if a point (x, y) is inside an element's bounding box.
 *
 * @param x - The x coordinate (clientX)
 * @param y - The y coordinate (clientY)
 * @param el - The element to check against
 * @returns True if the point is inside the element's bounding box, false otherwise
 */
export function isPointInsideElement(x: number, y: number, el: Element | null | undefined): boolean {
	if (!el) return false;
	const rect = el.getBoundingClientRect();
	return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}
