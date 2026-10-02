// Docs-site-safe: no Obsidian, React or Docusaurus imports. Synced verbatim into
// every */docs-site/src/components/ChangelogNavigator by `mise run
// sync-docs-site-theme`, so the plugins and the docs sites parse release-video
// links identically ([[decision-docs-sites-share-theme-code-through-a-synced-canonical-copy]]).

const YOUTUBE_ID = /^[\w-]{11}$/;
const YOUTUBE_HOSTS = new Set(["youtube.com", "m.youtube.com", "youtube-nocookie.com"]);
const YOUTUBE_PATH_PREFIXES = ["/embed/", "/shorts/", "/live/"];

/**
 * Thumbnail URLs sharpest first. `maxresdefault` (1280×720) only exists when
 * the video was uploaded in HD. Otherwise YouTube answers with a 120×90 grey
 * placeholder rather than an error, so a caller steps down the list when the
 * loaded image is that small (see {@link isYouTubePlaceholder}).
 */
export function youTubeThumbnailUrls(youtubeId: string): string[] {
	return ["maxresdefault", "sddefault", "hqdefault"].map((size) => `https://i.ytimg.com/vi/${youtubeId}/${size}.jpg`);
}

const PLACEHOLDER_MAX_WIDTH = 120;

export function isYouTubePlaceholder(naturalWidth: number): boolean {
	return naturalWidth <= PLACEHOLDER_MAX_WIDTH;
}

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
