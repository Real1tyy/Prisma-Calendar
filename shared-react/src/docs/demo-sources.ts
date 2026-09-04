// Pure URL resolution for the docs-site <DemoVideo />. Kept free of React and
// of any Docusaurus import so it is unit-testable in isolation and so the
// component can be copied verbatim into a standalone Docusaurus site (which has
// no access to this workspace). A published demo always lands under
// `<site>/static/demos/<id>.{mp4,webm,poster.png}` (see
// [[spec-showrunner-docs-publishing]] R2), so an `id` alone resolves to every
// source.

export interface DemoVideoProps {
	/** Scenario id — resolves to `<baseUrl>demos/<id>.{mp4,poster.png}` (and webm when requested). */
	id?: string;
	/** Explicit mp4 URL, overriding the id-derived path. */
	mp4?: string;
	/** Explicit webm URL, or `true` to derive `<id>.webm` (mp4-only demos omit it). */
	webm?: string | boolean;
	/** Explicit poster URL; defaults to the id-derived `<id>.poster.png`. Pass `false` to omit. */
	poster?: string | false;
	/** Optional caption rendered under the video. */
	caption?: string;
	/** Site base URL for non-root deployments (Docusaurus `baseUrl`). Defaults to `/`. */
	baseUrl?: string;
}

export interface ResolvedDemoSources {
	mp4: string;
	webm?: string;
	poster?: string;
}

/** The static subdirectory every published demo lives in, under a site's `static/`. */
export const DEMOS_DIR = "demos";

/** Join a base URL and path segments into a single clean URL, collapsing slashes. */
export function joinUrl(base: string, ...segments: string[]): string {
	const trimmedBase = base.replace(/\/+$/, "");
	const path = segments
		.map((segment) => segment.replace(/^\/+|\/+$/g, ""))
		.filter(Boolean)
		.join("/");
	return `${trimmedBase}/${path}`;
}

/**
 * Resolve a {@link DemoVideoProps} into concrete `<source>`/`poster` URLs.
 * `mp4` is mandatory — either explicit or derived from `id`; webm and poster
 * are optional. Throws when neither `id` nor `mp4` is supplied so a misauthored
 * embed fails loudly rather than rendering a sourceless `<video>`.
 */
export function resolveDemoSources(props: DemoVideoProps): ResolvedDemoSources {
	const baseUrl = props.baseUrl ?? "/";
	const id = props.id?.trim();
	const demoPath = (suffix: string): string => joinUrl(baseUrl, DEMOS_DIR, `${id}.${suffix}`);

	const mp4 = props.mp4 ?? (id ? demoPath("mp4") : undefined);
	if (!mp4) {
		throw new Error("DemoVideo: provide an `id` or an explicit `mp4` source");
	}

	let webm: string | undefined;
	if (typeof props.webm === "string") {
		webm = props.webm;
	} else if (props.webm === true && id) {
		webm = demoPath("webm");
	}

	let poster: string | undefined;
	if (typeof props.poster === "string") {
		poster = props.poster;
	} else if (props.poster !== false && id) {
		poster = demoPath("poster.png");
	}

	return {
		mp4,
		...(webm ? { webm } : {}),
		...(poster ? { poster } : {}),
	};
}
