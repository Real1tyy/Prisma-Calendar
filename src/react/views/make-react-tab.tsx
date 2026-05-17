import { type TabDefinition } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import type { ReactElement } from "react";

import { cls } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type CustomCalendarPlugin from "../../main";
import { BundleContext } from "../contexts/bundle-context";
import { PluginContext } from "../contexts/plugin-context";

export interface ReactTabOptions {
	id: string;
	label: string;
	icon?: string;
	color?: string;
	testId?: string;
	render: () => ReactElement;
	keyHandlers?: TabDefinition["keyHandlers"];
}

export interface TabContext {
	app: App;
	plugin: CustomCalendarPlugin;
	bundle: CalendarBundle;
}

/**
 * Wraps a React component as a Prisma TabDefinition. The plugin/bundle providers
 * are re-planted at every tab boundary because the React `TabbedContainer` may
 * mount each panel into its own subtree. The `prisma-tab-body` wrapper is
 * required by `_gantt.scss` / `_timeline.scss` for height fill behaviour.
 */
export function makeReactTab(ctx: TabContext, opts: ReactTabOptions): TabDefinition {
	const def: TabDefinition = {
		id: opts.id,
		label: opts.label,
		content: () => (
			<PluginContext value={ctx.plugin}>
				<BundleContext value={ctx.bundle}>
					<div className={cls("tab-body")} data-testid={opts.testId}>
						{opts.render()}
					</div>
				</BundleContext>
			</PluginContext>
		),
	};

	if (opts.icon !== undefined) def.icon = opts.icon;
	if (opts.color !== undefined) def.color = opts.color;
	if (opts.keyHandlers !== undefined) def.keyHandlers = opts.keyHandlers;

	return def;
}
