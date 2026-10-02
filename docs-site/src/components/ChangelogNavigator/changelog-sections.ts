// Docs-site-safe: no Obsidian, React or Docusaurus imports. Synced verbatim into
// every */docs-site/src/components/ChangelogNavigator by `mise run
// sync-docs-site-theme` ([[decision-docs-sites-share-theme-code-through-a-synced-canonical-copy]]).

/** `?version=` value for the section above every release. */
export const UNRELEASED_KEY = "unreleased";

const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const VERSION_HEADING = /^v?(\d+\.\d+\.\d+)/;

export interface ChangelogSection {
	/** `"unreleased"` or `X.Y.Z`. */
	key: string;
	heading: HTMLElement;
	/** The heading and everything under it up to the next `h2`. */
	elements: HTMLElement[];
}

export interface ChangelogLayout {
	/** Page chrome before the first `h2` other than the title (intro prose, rules). */
	intro: HTMLElement[];
	sections: ChangelogSection[];
}

/** The Docusaurus heading text minus its hash-link: `"2.24.0 - 9/10/2026"` → `"2.24.0"`. */
export function sectionKeyFromHeading(text: string): string | null {
	const visible = text.replaceAll(ZERO_WIDTH_SPACE, "").replaceAll("#", "").trim();
	if (visible.toLowerCase() === UNRELEASED_KEY) return UNRELEASED_KEY;
	return VERSION_HEADING.exec(visible)?.[1] ?? null;
}

/** Group the rendered changelog's top-level elements by their `h2` section. */
export function readChangelogLayout(markdown: HTMLElement): ChangelogLayout {
	const intro: HTMLElement[] = [];
	const sections: ChangelogSection[] = [];
	let current: ChangelogSection | null = null;

	for (const child of Array.from(markdown.children) as HTMLElement[]) {
		if (child.tagName === "H2") {
			const key = sectionKeyFromHeading(child.textContent ?? "");
			current = key === null ? null : { key, heading: child, elements: [child] };
			if (current !== null) sections.push(current);
			continue;
		}
		if (current !== null) current.elements.push(child);
		else if (child.tagName !== "HEADER") intro.push(child);
	}
	return { intro, sections };
}

/**
 * Show only the selected section (or everything when `selected` is null) and
 * return the ids of the headings that are now hidden, so the table of
 * contents can follow.
 */
export function applySectionFilter(layout: ChangelogLayout, selected: string | null): Set<string> {
	const hiddenIds = new Set<string>();
	for (const el of layout.intro) el.hidden = selected !== null;
	for (const section of layout.sections) {
		const hide = selected !== null && section.key !== selected;
		for (const el of section.elements) el.hidden = hide;
		if (hide && section.heading.id) hiddenIds.add(section.heading.id);
	}
	return hiddenIds;
}

/**
 * The changelog page's query parameter. The plugins deep-link with it (a
 * settings button opening `?version=unreleased`), so it is part of the public
 * URL contract: renaming it breaks links in every released plugin.
 */
export const CHANGELOG_VERSION_PARAM = "version";

/** A missing or unknown `?version=` means "all releases". */
export function selectedSectionFromSearch(search: string, keys: readonly string[]): string | null {
	const raw = new URLSearchParams(search).get(CHANGELOG_VERSION_PARAM)?.trim().replace(/^v/i, "").toLowerCase();
	if (!raw) return null;
	return keys.includes(raw) ? raw : null;
}

/** Link to one section of a published changelog page, keeping its existing query (UTM). */
export function changelogSectionUrl(changelogUrl: string, sectionKey: string): string {
	const url = new URL(changelogUrl);
	url.searchParams.set(CHANGELOG_VERSION_PARAM, sectionKey);
	return url.toString();
}
