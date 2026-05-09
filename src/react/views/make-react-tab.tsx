import type { TabDefinition } from "@real1ty-obsidian-plugins";
import { renderReactInline } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import type { ReactElement } from "react";

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
 * Wraps a React component as a Prisma TabDefinition.
 *
 * Each tab body is mounted as its own React root via `renderReactInline`, so we re-plant
 * the plugin/bundle providers at every tab boundary — context does not cross root boundaries.
 * App context is supplied by `renderReactInline` itself.
 *
 * The `prisma-tab-body` wrapper is required by `_gantt.scss` / `_timeline.scss` for height
 * fill behaviour.
 */
export function makeReactTab(ctx: TabContext, opts: ReactTabOptions): TabDefinition {
	let unmount: (() => void) | null = null;

	const def: TabDefinition = {
		id: opts.id,
		label: opts.label,
		render: (container) => {
			unmount = renderReactInline(
				container,
				<PluginContext value={ctx.plugin}>
					<BundleContext value={ctx.bundle}>
						<div className="prisma-tab-body" data-testid={opts.testId}>
							{opts.render()}
						</div>
					</BundleContext>
				</PluginContext>,
				ctx.app
			);
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
