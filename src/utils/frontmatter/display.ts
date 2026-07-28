import {
	createDefaultSeparator,
	isNotEmpty,
	renderPropertyValue as renderPropertyValueUtil,
	type PropertyRendererConfig,
} from "@real1ty/obsidian-plugins";
import type { App } from "obsidian";

export function getDisplayProperties(
	frontmatter: Record<string, unknown>,
	displayPropertiesList: string[]
): [string, unknown][] {
	return displayPropertiesList
		.map((prop) => [prop, frontmatter[prop]] as [string, unknown])
		.filter(([, value]) => isNotEmpty(value));
}

export interface PropertyRendererOptions {
	app: App;
	linkClassName?: string;
	addSpacePrefixToText?: boolean;
	onLinkClick?: () => void;
}

export function renderPropertyValue(container: HTMLElement, value: unknown, options: PropertyRendererOptions): void {
	const config: PropertyRendererConfig = {
		createLink: (text: string, path: string) => {
			const link = createEl("a", { text });
			if (options.linkClassName) {
				link.className = options.linkClassName;
			}
			link.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				void options.app.workspace.openLinkText(path, "", false);
				if (options.onLinkClick) {
					options.onLinkClick();
				}
			};
			return link;
		},
		createText: (text: string) => {
			if (options.addSpacePrefixToText) {
				const isFirstChild = container.childNodes.length === 0;
				const prefixedText = isFirstChild && text.trim() ? ` ${text}` : text;
				return activeDocument.createTextNode(prefixedText);
			}
			return activeDocument.createTextNode(text);
		},
		createSeparator: createDefaultSeparator,
	};

	renderPropertyValueUtil(container, value, config);
}

/**
 * Extract plain text representation of a property value for tooltips.
 * Uses the same rendering logic as renderPropertyValue but returns text only.
 */
export function extractPropertyText(value: unknown): string {
	if (value == null) return "";

	const tempContainer = createDiv();
	const config: PropertyRendererConfig = {
		createLink: (text: string, _path: string, _isObsidianLink: boolean) => createSpan({ text }),
		createText: (text: string) => createSpan({ text }),
		createSeparator: () => createSpan({ text: ", " }),
	};

	renderPropertyValueUtil(tempContainer, value, config);
	return tempContainer.textContent || "";
}
