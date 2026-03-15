import type { App } from "obsidian";

import type { ComponentCleanup, ComponentRender, InlineContext } from "./types";

export function renderInline(container: HTMLElement, render: ComponentRender, app: App): ComponentCleanup {
	const ctx: InlineContext = {
		type: "inline",
		app,
		close: () => {
			container.innerHTML = "";
		},
	};

	void render(container, ctx);

	return () => {
		container.innerHTML = "";
	};
}
