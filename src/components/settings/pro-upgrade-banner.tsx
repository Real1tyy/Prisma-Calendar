import { renderReactInline } from "@real1ty/obsidian-plugins-react";
import { Component, type App } from "obsidian";

import { CSS_PREFIX } from "../../constants";
import type { ProFeatureKey } from "../../core/pro-feature-previews";
import { ProUpgradeBanner } from "../../react/settings/pro-upgrade-banner";

// The bridge for imperative views (Bases view, AI chat view) — they show the same React
// banner as the settings tabs, so the preview image, its cache and its enlarge-on-click
// live in one place. The gate is a child Component of the view that shows it, so the
// view's own unload tears it down; hosts track nothing.
const gates = new WeakMap<HTMLElement, { owner: Component; gate: Component }>();

export interface ProUpgradeBannerContent {
	featureName: string;
	description: string;
	previewKey?: ProFeatureKey | undefined;
}

export function renderProUpgradeBanner(
	owner: Component,
	app: App,
	containerEl: HTMLElement,
	content: ProUpgradeBannerContent
): void {
	// The Bases view re-renders the gate into the same container on every data update.
	clearProUpgradeBanner(containerEl);
	const host = containerEl.createDiv();
	const gate = new Component();
	gate.register(renderReactInline(host, <ProUpgradeBanner {...content} />, app, { cssPrefix: CSS_PREFIX }));
	gate.register(() => host.remove());
	gates.set(containerEl, { owner, gate });
	owner.addChild(gate);
}

/** Removes the gate before a host replaces it with real content (the user went Pro). */
export function clearProUpgradeBanner(containerEl: HTMLElement): void {
	const mounted = gates.get(containerEl);
	if (!mounted) return;
	gates.delete(containerEl);
	mounted.owner.removeChild(mounted.gate);
}
