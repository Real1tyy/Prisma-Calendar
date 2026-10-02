// Docs-site-safe: no Obsidian, React or Docusaurus imports. Synced verbatim into
// every */docs-site/src/components/ChangelogNavigator by `mise run
// sync-docs-site-theme` ([[decision-docs-sites-share-theme-code-through-a-synced-canonical-copy]]).

/** The plugin slug is the docs site's subdomain: `prisma-calendar.matejvavroproductivity.com`. */
export function pluginSlugFromSiteUrl(siteUrl: string): string | null {
	try {
		const [label] = new URL(siteUrl).hostname.split(".");
		return label && label !== "www" ? label : null;
	} catch {
		return null;
	}
}
