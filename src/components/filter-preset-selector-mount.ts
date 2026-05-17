import { cls } from "../constants";
import { renderReactInline } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { createElement } from "react";

import { CSS_PREFIX } from "../constants";
import type { CalendarBundle } from "../core/calendar-bundle";
import { BundleContext } from "../react/contexts/bundle-context";
import { FilterPresetSelector } from "../react/views/filter-preset-selector";

export interface FilterPresetSelectorMount {
	open: () => void;
	destroy: () => void;
}

interface MountOptions {
	app: App;
	bundle: CalendarBundle;
	container: HTMLElement;
	onPresetSelected: (expression: string) => void;
}

/**
 * Mirrors the imperative DOM contract:
 * `.fc-toolbar-chunk > .prisma-fc-filter-preset-wrapper > select.prisma-fc-filter-preset-select`.
 * The wrapper is the mount root so SCSS rules targeting it for mobile collapse
 * and FilterBar flex sizing keep working unchanged.
 */
export function mountFilterPresetSelector(opts: MountOptions): FilterPresetSelectorMount | null {
	const toolbarLeft = opts.container.querySelector(".fc-toolbar-chunk:first-child");
	if (!toolbarLeft) return null;

	const wrapper = activeDocument.createElement("div");
	wrapper.className = cls("fc-filter-preset-wrapper");

	const zoomButton = toolbarLeft.querySelector(".fc-zoomLevel-button");
	if (zoomButton?.parentNode) {
		zoomButton.parentNode.insertBefore(wrapper, zoomButton.nextSibling);
	} else {
		toolbarLeft.appendChild(wrapper);
	}

	const unmountReact = renderReactInline(
		wrapper,
		createElement(
			BundleContext,
			{ value: opts.bundle },
			createElement(FilterPresetSelector, { onPresetSelected: opts.onPresetSelected })
		),
		opts.app,
		{ cssPrefix: CSS_PREFIX }
	);

	return {
		open: () => {
			const select = wrapper.querySelector<HTMLSelectElement>(`.${cls("fc-filter-preset-select")}`);
			if (!select) return;
			select.focus();
			if ("showPicker" in select) {
				try {
					(select as unknown as { showPicker: () => void }).showPicker();
					return;
				} catch {
					// showPicker can throw without a user gesture; fall through to mousedown.
				}
			}
			select.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }));
		},
		destroy: () => {
			unmountReact();
			wrapper.parentElement?.removeChild(wrapper);
		},
	};
}
