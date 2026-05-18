import { registerComponentView, type ViewActivator, type ViewComponentConfig } from "@real1ty-obsidian-plugins";
import { renderReactInline } from "@real1ty-obsidian-plugins-react";
import type { WorkspaceLeaf } from "obsidian";
import { createElement } from "react";

import { cls, CSS_PREFIX } from "../../constants";
import type { CalendarBundle } from "../../core/calendar-bundle";
import type CustomCalendarPlugin from "../../main";
import { PrismaViewApp, type PrismaViewRef } from "./prisma-view-app";

export type { PrismaViewRef } from "./prisma-view-app";

export function registerPrismaReactView(
	plugin: CustomCalendarPlugin,
	bundle: CalendarBundle,
	ref: PrismaViewRef
): ViewActivator {
	let unmount: (() => void) | null = null;

	const viewConfig: ViewComponentConfig = {
		viewType: bundle.viewType,
		displayText: bundle.settingsStore.currentSettings.name,
		icon: "calendar",
		cls: cls("calendar-view-root"),
		render: (el, ctx) => {
			if (ctx.type !== "view") return;
			unmount?.();
			unmount = renderReactInline(
				el,
				createElement(PrismaViewApp, {
					plugin,
					bundle,
					leaf: ctx.leaf,
					headerEl: ctx.headerEl,
					el,
					viewRef: ref,
				}),
				ctx.app,
				{ cssPrefix: CSS_PREFIX, testIdPrefix: CSS_PREFIX }
			);
		},
		cleanup: () => {
			unmount?.();
			unmount = null;
		},
	};

	ref.viewConfig = viewConfig;
	return registerComponentView(plugin, viewConfig);
}

// Re-export to satisfy any future import sites that need the leaf placement type.
export type { WorkspaceLeaf };
