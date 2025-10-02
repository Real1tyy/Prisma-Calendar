import { getObsidianLinkAlias, getObsidianLinkPath, isObsidianLink } from "./obsidian-link-utils";

export interface PropertyRendererConfig {
	createLink: (text: string, path: string, isObsidianLink: boolean) => HTMLElement;
	createText: (text: string) => HTMLElement | Text;
	createSeparator?: () => HTMLElement | Text;
}

export function renderPropertyValue(container: HTMLElement, value: any, config: PropertyRendererConfig): void {
	// Handle arrays - render each item separately
	if (Array.isArray(value)) {
		const hasClickableLinks = value.some(isObsidianLink);

		if (hasClickableLinks) {
			value.forEach((item, index) => {
				if (index > 0 && config.createSeparator) {
					container.appendChild(config.createSeparator());
				}
				renderSingleValue(container, item, config);
			});
		} else {
			// Plain array - just join with commas
			const textNode = config.createText(value.join(", "));
			container.appendChild(textNode);
		}
		return;
	}
	renderSingleValue(container, value, config);
}

function renderSingleValue(container: HTMLElement, value: any, config: PropertyRendererConfig): void {
	const stringValue = String(value).trim();

	if (isObsidianLink(stringValue)) {
		const displayText = getObsidianLinkAlias(stringValue);
		const linkPath = getObsidianLinkPath(stringValue);
		const link = config.createLink(displayText, linkPath, true);
		container.appendChild(link);
		return;
	}

	// Regular text
	const textNode = config.createText(stringValue);
	container.appendChild(textNode);
}

export function createTextNode(text: string): Text {
	return document.createTextNode(text);
}

export function createDefaultSeparator(): Text {
	return document.createTextNode(", ");
}
