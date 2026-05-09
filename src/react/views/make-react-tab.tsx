import { type TabDefinition } from "@real1ty-obsidian-plugins";
import { renderReactInline } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import type { ReactElement } from "react";

export interface ReactTabOptions {
	id: string;
	label: string;
	icon?: string;
	color?: string;
	testId?: string;
	render: () => ReactElement;
	keyHandlers?: TabDefinition["keyHandlers"];
}

/** Wraps a React component as a TabDefinition: mounts on render, unmounts on cleanup. */
export function makeReactTab(app: App, opts: ReactTabOptions): TabDefinition {
	let unmount: (() => void) | null = null;

	const def: TabDefinition = {
		id: opts.id,
		label: opts.label,
		render: (container) => {
			if (opts.testId) container.setAttribute("data-testid", opts.testId);
			unmount = renderReactInline(container, opts.render(), app);
		},
		cleanup: () => {
			unmount?.();
			unmount = null;
		},
	};

	if (opts.icon !== undefined) def.icon = opts.icon;
	if (opts.color !== undefined) def.color = opts.color;
	if (opts.keyHandlers !== undefined) def.keyHandlers = opts.keyHandlers;

	return def;
}
