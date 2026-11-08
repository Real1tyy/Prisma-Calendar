// Docs-site-safe: no Obsidian, React or Docusaurus imports. Synced verbatim into
// every */docs-site/src/config by `mise run sync-docs-site-theme`, where each
// docusaurus.config.ts puts it in `headTags`
// ([[decision-docs-sites-share-theme-code-through-a-synced-canonical-copy]]).
//
// The sites build with `trailingSlash: false`, so GitHub Pages has `changelog.html`
// but nothing at `changelog/`: `/changelog/` answers 404 with the pre-rendered
// "Page Not Found", which stays on screen until the router fetches the page's
// chunk and swaps the content in. Rewriting the URL from <head>, before the body
// paints, turns every such link into one hop to the real page. `?version=`, UTM
// and `#anchor` ride along — the plugins deep-link with them.
//
// Every site serves at baseUrl "/", so "/" is the only legitimate path ending in
// a slash; a site served under a subpath would loop here on its home page.

export const TRAILING_SLASH_REDIRECT_SCRIPT =
	'(function(){var l=window.location,p=l.pathname;if(p.length<2||p.charAt(p.length-1)!=="/")return;' +
	'l.replace((p.replace(/\\/+$/,"")||"/")+l.search+l.hash);})();';

export const trailingSlashRedirectHeadTag = {
	tagName: "script",
	attributes: {},
	innerHTML: TRAILING_SLASH_REDIRECT_SCRIPT,
};
