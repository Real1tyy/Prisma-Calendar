import { makeContainer, type Scenario } from "@real1ty-obsidian-plugins/testing/visual";

import { Stopwatch } from "../../../src/components/stopwatch";

function buildStopwatch(): { container: HTMLElement; stopwatch: Stopwatch } {
	const container = makeContainer();
	const stopwatch = new Stopwatch({
		onStart: () => {},
		onContinueRequested: () => null,
		onStop: () => {},
		onBreakUpdate: () => {},
	});
	stopwatch.render(container);
	return { container, stopwatch };
}

export const scenarios: Scenario[] = [
	{
		name: "stopwatch-idle-collapsed",
		width: "420px",
		render(): HTMLElement {
			const { container } = buildStopwatch();
			return container;
		},
	},
	{
		name: "stopwatch-idle-expanded",
		width: "420px",
		render(): HTMLElement {
			const { container } = buildStopwatch();
			const header = container.querySelector<HTMLElement>(".prisma-collapsible-header");
			if (header) header.click();
			return container;
		},
	},
];
