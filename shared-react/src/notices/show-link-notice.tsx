import type { LinkNoticeOptions, ShowLinkNotice } from "@real1ty/obsidian-plugins";
import { Notice } from "obsidian";
import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";

import { SharedReactThemeProvider } from "../contexts/theme-context";
import { LinkNotice } from "./link-notice";

export const DEFAULT_LINK_NOTICE_MS = 10000;

export interface ShowLinkNoticeOptions extends LinkNoticeOptions {
	cssPrefix?: string | undefined;
	/** Defaults to `cssPrefix`, matching the other mount bridges. */
	testIdPrefix?: string | undefined;
}

function resolveDocument(): Document {
	// Notices render into whichever window is active (a popped-out leaf, the
	// 1.13 settings window), and adopted stylesheets never cross that boundary.
	return typeof activeDocument === "undefined" ? document : activeDocument;
}

/**
 * Unmount once Obsidian drops the notice element — on timeout or on the
 * click-anywhere dismiss. Deferred to a microtask so React never unmounts from
 * inside the MutationObserver callback that observed the removal.
 */
function unmountWhenDetached(noticeEl: HTMLElement, root: Root): void {
	// The observer has to watch the notice CONTAINER, not the notice itself:
	// hiding removes the whole notice element, which fires no childList
	// mutation on any node inside it.
	const parent = noticeEl.parentElement;
	if (!parent) {
		root.unmount();
		return;
	}
	const observer = new MutationObserver(() => {
		if (noticeEl.isConnected) return;
		observer.disconnect();
		queueMicrotask(() => root.unmount());
	});
	observer.observe(parent, { childList: true });
}

/**
 * Show an Obsidian notice whose links are real, clickable anchors labelled by
 * name. Use this instead of interpolating a URL into a notice string: notice
 * text is inert, so a pasted URL can be neither followed nor copied, and the
 * UTM query string we attach to every outbound link turns it into noise.
 */
export function showLinkNotice({
	message,
	links,
	durationMs = DEFAULT_LINK_NOTICE_MS,
	cssPrefix,
	testIdPrefix,
}: ShowLinkNoticeOptions): Notice {
	const doc = resolveDocument();
	const fragment = createFragment();
	const container = fragment.createDiv();
	const root = createRoot(container);
	root.render(
		<StrictMode>
			<SharedReactThemeProvider cssPrefix={cssPrefix} testIdPrefix={testIdPrefix ?? cssPrefix} ownerDocument={doc}>
				<LinkNotice message={message} links={links} />
			</SharedReactThemeProvider>
		</StrictMode>
	);

	const notice = new Notice(fragment, durationMs);
	unmountWhenDetached(notice.containerEl, root);
	return notice;
}

/**
 * Bind a plugin's CSS prefix once so core code can hold the plugin-agnostic
 * {@link ShowLinkNotice} port without knowing about React or the prefix.
 */
export function createLinkNoticeRenderer(cssPrefix: string): ShowLinkNotice {
	return (options) => {
		showLinkNotice({ ...options, cssPrefix });
	};
}
