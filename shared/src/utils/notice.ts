/**
 * A destination shown to the user by its NAME, never by its URL. Notices carry
 * UTM-tagged marketing links, and pasting a raw
 * `…?utm_campaign=…&utm_source=…` string into a toast is both unreadable and
 * unclickable — the label is what the user sees, the href is what they follow.
 */
export interface NoticeLink {
	label: string;
	href: string;
}

export interface LinkNoticeOptions {
	message: string;
	links?: readonly NoticeLink[];
	/** `0` keeps the notice up until the user dismisses it. */
	durationMs?: number;
}

/**
 * Port implemented by `showLinkNotice` in `@real1ty/obsidian-plugins-react`.
 * Core code composes the copy plus its labelled links and hands them to an
 * injected renderer, because `shared` sits *below* `shared-react` and cannot
 * import React — see [[decision-react-full-adoption]].
 */
export type ShowLinkNotice = (options: LinkNoticeOptions) => void;
