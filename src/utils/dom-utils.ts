/**
 * Creates a div element with text content and CSS class
 */
export function createTextDiv(parent: HTMLElement, text: string, cls: string): HTMLDivElement {
	return parent.createEl("div", { text, cls });
}
