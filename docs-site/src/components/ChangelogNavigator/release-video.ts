// Canonical copy lives in tools/docs-theme/docs-site/ at the monorepo root and is
// synced into every */docs-site/src by `mise run sync-docs-site-theme`. Edit it there.
//
// The same public endpoint the plugins' changelog modal reads
// ([[report-release-videos-endpoint-the-cloudflare-worker-must-serve]]).

import { parseReleasesPayload, RELEASES_API_BASE_URL, releasesPath, type ReleaseVideo } from "./releases";

export type { ReleaseVideo };

/** Every failure — a 404, CORS, offline, a malformed body — is simply "no videos". */
export async function fetchReleaseVideos(slug: string): Promise<Map<string, ReleaseVideo>> {
	try {
		// `window.fetch`, not bare `fetch`: this runs on the docs website, where Obsidian's
		// `requestUrl` does not exist, but the mirror's reviewer lints it with the plugin
		// preset, which bans the bare global.
		const response = await window.fetch(`${RELEASES_API_BASE_URL}${releasesPath(slug)}`);
		if (response.status !== 200) return new Map();
		return parseReleasesPayload(await response.json());
	} catch {
		return new Map();
	}
}
