import { requestUrl } from "obsidian";

import { parseReleasesPayload, releasesPath, type ReleaseVideo } from "../../docs-site/releases";
import type { PluginSlug } from "../../utils/utm";
import { resolveApiBaseUrl } from "../submission/api-base-url";

/**
 * Release videos are served by the worker rather than bundled, so a video
 * published after a release still reaches every installed version. One request
 * returns every release's video; the wire contract the worker honours is
 * [[report-release-videos-endpoint-the-cloudflare-worker-must-serve]].
 */
export type { ReleaseVideo };

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

/**
 * A video is an enhancement, never a requirement: every failure — a 404, a
 * 5xx, offline, a body we can't read — yields an empty map, so the changelog
 * renders exactly as it would without the lookup.
 */
export async function fetchReleaseVideos(
	slug: PluginSlug,
	options: ReleaseVideoLookupOptions = {}
): Promise<Map<string, ReleaseVideo>> {
	const transport = options.transport ?? defaultReleaseInfoTransport;
	try {
		const response = await transport(new URL(releasesPath(slug), resolveApiBaseUrl(options.baseUrl)).toString());
		if (response.status !== 200 || response.body === undefined) return new Map();
		return parseReleasesPayload(JSON.parse(response.body));
	} catch {
		return new Map();
	}
}

/**
 * One request per lookup, made on first use: stepping through twenty versions
 * reads the same list twenty times rather than asking the server twenty times.
 */
export function createReleaseVideoLookup(
	slug: PluginSlug,
	options: ReleaseVideoLookupOptions = {}
): ReleaseVideoLookup {
	let videos: Promise<Map<string, ReleaseVideo>> | null = null;
	return async (version) => {
		videos ??= fetchReleaseVideos(slug, options);
		return (await videos).get(version) ?? null;
	};
}
