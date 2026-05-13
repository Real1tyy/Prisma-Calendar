import { addCls } from "@real1ty-obsidian-plugins";
import { renderReactInline } from "@real1ty-obsidian-plugins-react";
import type { App } from "obsidian";
import { createElement } from "react";

import { CSS_PREFIX } from "../constants";
import { StickyBanner } from "../react/views/sticky-banner";

export interface StickyBannerHandle {
	destroy(): void;
}

export function createStickyBanner(
	container: HTMLElement,
	app: App,
	message: string,
	onCancel: () => void
): StickyBannerHandle {
	const mount = container.createDiv();
	addCls(mount, "sticky-banner-mount");

	const unmount = renderReactInline(mount, createElement(StickyBanner, { message, onCancel }), app, {
		cssPrefix: CSS_PREFIX,
	});

	return {
		destroy() {
			unmount();
			mount.remove();
		},
	};
}
