import { distinctUntilChanged, skip, type Subscription } from "rxjs";

import type { CalendarBundle } from "../../core/calendar-bundle";
import type { ProFeatureKey } from "../../core/pro-feature-previews";
import { renderProUpgradeBanner } from "../settings/pro-upgrade-banner";

export interface ProGatedContentOptions {
	featureName: string;
	description: string;
	previewKey?: ProFeatureKey;
	/** Renders the Pro content. Optionally returns a cleanup function called on re-render / destroy. */
	render: (container: HTMLElement) => void | (() => void);
}

export interface ProGatedContentHandle {
	attach: (container: HTMLElement) => void;
	destroy: () => void;
}

/**
 * Wraps a tab/view's content with Pro-license gating. While free, renders the
 * upgrade banner; when Pro, delegates to the provided renderer. Re-renders
 * automatically on license state changes and tears down the previous content.
 */
export function createProGatedContent(bundle: CalendarBundle, options: ProGatedContentOptions): ProGatedContentHandle {
	let container: HTMLElement | null = null;
	let proContentCleanup: (() => void) | null = null;
	let isProSub: Subscription | null = null;

	function renderOnce(): void {
		if (!container) return;
		proContentCleanup?.();
		proContentCleanup = null;
		container.empty();

		if (!bundle.plugin.licenseManager.isPro) {
			renderProUpgradeBanner(container, options.featureName, options.description, options.previewKey);
			return;
		}

		const cleanup = options.render(container);
		if (typeof cleanup === "function") proContentCleanup = cleanup;
	}

	return {
		attach(el) {
			container = el;
			renderOnce();
			isProSub = bundle.plugin.licenseManager.isPro$
				.pipe(skip(1), distinctUntilChanged())
				.subscribe(() => renderOnce());
		},
		destroy() {
			isProSub?.unsubscribe();
			isProSub = null;
			proContentCleanup?.();
			proContentCleanup = null;
			container = null;
		},
	};
}
