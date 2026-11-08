import { renderReactInline } from "@real1ty/obsidian-plugins-react";
import type { App } from "obsidian";

import { CSS_PREFIX } from "../../constants";
import type { ProFeatureKey } from "../../core/pro-feature-previews";
import { ProUpgradeBanner } from "../../react/settings/pro-upgrade-banner";

// The bridge for imperative hosts (Bases view, AI chat view, the heatmap gate modal) —
// they show the same React banner as the settings tabs, so the preview image, its cache
// and its enlarge-on-click live in one place.
const mounted = new WeakMap<HTMLElement, () => void>();

export function renderProUpgradeBanner(
	containerEl: HTMLElement,
	app: App,
	featureName: string,
	description: string,
	previewKey?: ProFeatureKey
): () => void {
	// Hosts re-render the gate into the same container (the Bases view does so on every
	// data update); the previous root is unmounted rather than left behind.
	mounted.get(containerEl)?.();
	const host = containerEl.createDiv();
	const unmountRoot = renderReactInline(
		host,
		<ProUpgradeBanner featureName={featureName} description={description} previewKey={previewKey} />,
		app,
		{ cssPrefix: CSS_PREFIX }
	);
	let unmounted = false;
	const unmount = (): void => {
		if (unmounted) return;
		unmounted = true;
		if (mounted.get(containerEl) === unmount) mounted.delete(containerEl);
		unmountRoot();
		host.remove();
	};
	mounted.set(containerEl, unmount);
	return unmount;
}
