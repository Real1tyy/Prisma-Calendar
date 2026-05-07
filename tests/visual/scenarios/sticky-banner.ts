import { createMockApp } from "@real1ty-obsidian-plugins/testing";
import { makeContainer, type Scenario } from "@real1ty-obsidian-plugins/testing/visual";
import type { App } from "obsidian";

import { createStickyBanner } from "../../../src/components/sticky-banner";

const bannerCleanups = new WeakMap<HTMLElement, () => void>();

function mountStickyBanner(container: HTMLElement, message: string): void {
	const app = createMockApp() as unknown as App;
	const handle = createStickyBanner(container, app, message, () => {});
	bannerCleanups.set(container, () => {
		handle.destroy();
	});
}

export const scenarios: Scenario[] = [
	{
		name: "sticky-banner-default",
		width: "640px",
		render(): HTMLElement {
			const container = makeContainer();
			mountStickyBanner(container, "Select an event to assign as prerequisite");
			return container;
		},
		teardown(root): void {
			bannerCleanups.get(root)?.();
		},
	},
	{
		name: "sticky-banner-long-message",
		width: "640px",
		render(): HTMLElement {
			const container = makeContainer();
			mountStickyBanner(
				container,
				"This is a much longer banner message that should wrap gracefully across multiple lines to test text layout behavior when the content exceeds the available single-line width"
			);
			return container;
		},
		teardown(root): void {
			bannerCleanups.get(root)?.();
		},
	},
];
