// Docs-site-safe: no Obsidian, React or Docusaurus imports. Synced verbatim into
// every */docs-site/src/components/ChangelogNavigator by `mise run
// sync-docs-site-theme`, so the plugins and the docs sites parse release-video
// links identically ([[decision-docs-sites-share-theme-code-through-a-synced-canonical-copy]]).

const YOUTUBE_ID = /^[\w-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "youtube-nocookie.com"]);
const YOUTUBE_PATH_PREFIXES = ["/embed/", "/shorts/", "/live/"];

export function parseYouTubeVideoId(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}
	const host = parsed.hostname.replace(/^www\./, "");
	let candidate: string | null = null;
	if (host === "youtu.be") {
		candidate = parsed.pathname.slice(1).split("/")[0] ?? null;
	} else if (YOUTUBE_HOSTS.has(host)) {
		const prefix = YOUTUBE_PATH_PREFIXES.find((p) => parsed.pathname.startsWith(p));
		candidate =
			prefix !== undefined
				? (parsed.pathname.slice(prefix.length).split("/")[0] ?? null)
				: parsed.searchParams.get("v");
	}
	return candidate !== null && YOUTUBE_ID.test(candidate) ? candidate : null;
}
