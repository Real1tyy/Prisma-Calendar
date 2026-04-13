import { makeContainer, type Scenario } from "@real1ty-obsidian-plugins/testing/visual";

import { createStickyBanner } from "../../../src/components/sticky-banner";

export const scenarios: Scenario[] = [
	{
		name: "sticky-banner-default",
		width: "640px",
		render(): HTMLElement {
			const container = makeContainer();
			createStickyBanner(container, "Select an event to assign as prerequisite", () => {});
			return container;
		},
	},
	{
		name: "sticky-banner-long-message",
		width: "640px",
		render(): HTMLElement {
			const container = makeContainer();
			createStickyBanner(
				container,
				"This is a much longer banner message that should wrap gracefully across multiple lines to test text layout behavior when the content exceeds the available single-line width",
				() => {}
			);
			return container;
		},
	},
];
