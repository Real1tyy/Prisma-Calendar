// Docs-site-safe: no Obsidian, React or Docusaurus imports. Synced verbatim into
// every */docs-site/src/components/ChangelogNavigator by `mise run
// sync-docs-site-theme`, so the plugins and the docs sites read the releases
// endpoint identically ([[report-release-videos-endpoint-the-cloudflare-worker-must-serve]]).

import { parseYouTubeVideoId } from "./youtube";

export const RELEASES_API_BASE_URL = "https://api.matejvavroproductivity.com";

export interface ReleaseVideo {
	/** The URL the worker returned — what "Watch on YouTube" opens. */
	videoUrl: string;
	youtubeId: string;
}

/** Every release of one plugin that has something to show, in one request. */
export function releasesPath(slug: string): string {
	return `/api/plugins/${encodeURIComponent(slug)}/releases`;
}

/**
 * `{ releases: [{ version, videoUrl }, …] }` → version → video. Anything
 * malformed is skipped rather than failing the whole list: one bad row must
 * not hide every other release's video.
 */
export function parseReleasesPayload(body: unknown): Map<string, ReleaseVideo> {
	const videos = new Map<string, ReleaseVideo>();
	if (typeof body !== "object" || body === null) return videos;
	const { releases } = body as { releases?: unknown };
	if (!Array.isArray(releases)) return videos;
	for (const release of releases) {
		if (typeof release !== "object" || release === null) continue;
		const { version, videoUrl } = release as { version?: unknown; videoUrl?: unknown };
		if (typeof version !== "string" || typeof videoUrl !== "string") continue;
		const youtubeId = parseYouTubeVideoId(videoUrl);
		if (youtubeId !== null) videos.set(version, { videoUrl, youtubeId });
	}
	return videos;
}
