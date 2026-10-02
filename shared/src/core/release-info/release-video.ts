import { requestUrl } from "obsidian";

import type { PluginSlug } from "../../utils/utm";
import { resolveApiBaseUrl } from "../submission/api-base-url";

/**
 * Release videos are served by the worker rather than bundled, so a video
 * published after a release still reaches every installed version. The wire
 * contract the worker honours is
 * [[report-release-videos-endpoint-the-cloudflare-worker-must-serve]].
 */
export const RELEASE_VIDEOS_ENDPOINT = "/api/release-videos";

export interface ReleaseVideo {
	/** The URL the worker returned — what "Watch on YouTube" opens. */
	videoUrl: string;
	youtubeId: string;
}

export interface ReleaseInfoResponse {
	status: number;
	body?: string;
}

/** Injectable GET seam — defaults to Obsidian's `requestUrl` (no CORS, works on mobile). */
export type ReleaseInfoTransport = (url: string) => Promise<ReleaseInfoResponse>;

export const defaultReleaseInfoTransport: ReleaseInfoTransport = async (url) => {
	const response = await requestUrl({ url, method: "GET", throw: false });
	return { status: response.status, body: response.text };
};

export interface ReleaseVideoLookupOptions {
	baseUrl?: string;
	transport?: ReleaseInfoTransport;
}

export type ReleaseVideoLookup = (version: string) => Promise<ReleaseVideo | null>;

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

function parseReleaseVideo(body: string | undefined): ReleaseVideo | null {
	if (body === undefined) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return null;
	}
	if (typeof parsed !== "object" || parsed === null) return null;
	const { videoUrl } = parsed as { videoUrl?: unknown };
	if (typeof videoUrl !== "string") return null;
	const youtubeId = parseYouTubeVideoId(videoUrl);
	return youtubeId === null ? null : { videoUrl, youtubeId };
}

/**
 * A video is an enhancement, never a requirement: every failure — 404, a 5xx,
 * offline, a body we can't read — resolves to `null` so the changelog renders
 * exactly as it would without the lookup.
 */
export async function fetchReleaseVideo(
	slug: PluginSlug,
	version: string,
	options: ReleaseVideoLookupOptions = {}
): Promise<ReleaseVideo | null> {
	const transport = options.transport ?? defaultReleaseInfoTransport;
	const path = `${RELEASE_VIDEOS_ENDPOINT}/${encodeURIComponent(slug)}/${encodeURIComponent(version)}`;
	try {
		const response = await transport(new URL(path, resolveApiBaseUrl(options.baseUrl)).toString());
		if (response.status !== 200) return null;
		return parseReleaseVideo(response.body);
	} catch {
		return null;
	}
}

/** One request per version per lookup — navigating back and forth never re-asks. */
export function createReleaseVideoLookup(
	slug: PluginSlug,
	options: ReleaseVideoLookupOptions = {}
): ReleaseVideoLookup {
	const cache = new Map<string, Promise<ReleaseVideo | null>>();
	return (version) => {
		const cached = cache.get(version);
		if (cached !== undefined) return cached;
		const pending = fetchReleaseVideo(slug, version, options);
		cache.set(version, pending);
		return pending;
	};
}
