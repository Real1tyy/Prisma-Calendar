import {
	createDefaultSeparator,
	isNotEmpty,
	type PropertyRendererConfig,
	renderPropertyValue as renderPropertyValueUtil,
} from "@real1ty-obsidian-plugins/utils";
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
			const link = document.createElement("a");
			if (options.linkClassName) {
				link.className = options.linkClassName;
			}
			link.textContent = text;
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
				return document.createTextNode(prefixedText);
			}
			return document.createTextNode(text);
		},
		createSeparator: createDefaultSeparator,
	};

	renderPropertyValueUtil(container, value, config);
}
