import { requestUrl } from "obsidian";
import { useEffect, useState } from "react";

/**
 * Remote images (docs-site screenshots, the brand logo) are served rather than bundled,
 * to keep a plugin's main.js under Obsidian Sync's size cap. Cache Storage keeps the last
 * good copy, so an image seen once still shows offline and paints without a round trip.
 */
export const REMOTE_IMAGE_CACHE = "real1ty-remote-images-v1";

const inflight = new Map<string, Promise<Blob | null>>();
const revalidated = new Set<string>();

async function openCache(): Promise<Cache | null> {
	try {
		return typeof caches === "undefined" ? null : await caches.open(REMOTE_IMAGE_CACHE);
	} catch {
		return null;
	}
}

async function fetchAndStore(url: string, cache: Cache | null): Promise<Blob | null> {
	let timeout: number | undefined;
	try {
		// Native Obsidian requests bypass renderer routes; the e2e fixture provides
		// a loopback server, while cache keys remain the original public URLs.
		const base = (window as Window & { __remoteImageBaseUrl?: string }).__remoteImageBaseUrl;
		const request = requestUrl({ url: base ? `${base}/${encodeURIComponent(url)}` : url, throw: false });
		// requestUrl has no abort API. Stop waiting without allowing a late response
		// to overwrite the cache after startup has already fallen back.
		const response = await Promise.race([
			request,
			new Promise<null>((resolve) => {
				timeout = window.setTimeout(() => resolve(null), 5000);
			}),
		]);
		if (!response || response.status < 200 || response.status >= 300) return null;
		const contentType =
			Object.entries(response.headers).find(([key]) => key.toLowerCase() === "content-type")?.[1] ?? "";
		const blob = new Blob([response.arrayBuffer], { type: contentType });
		if (blob.size === 0 || !blob.type.startsWith("image/")) return null;
		if (cache) {
			await cache.put(url, new Response(blob, { headers: { "content-type": blob.type } })).catch(() => undefined);
		}
		return blob;
	} catch {
		return null;
	} finally {
		if (timeout !== undefined) window.clearTimeout(timeout);
	}
}

async function readThroughCache(url: string): Promise<Blob | null> {
	const cache = await openCache();
	const hit = cache ? await cache.match(url).catch(() => undefined) : undefined;
	if (!hit) return fetchAndStore(url, cache);
	// Stale-while-revalidate, once per session per URL: a replaced image on the server
	// reaches the cache for next time without delaying what shows now.
	if (!revalidated.has(url)) {
		revalidated.add(url);
		void fetchAndStore(url, cache);
	}
	return hit.blob();
}

/** One load per URL at a time, however many components show the same image. */
export function loadCachedImage(url: string): Promise<Blob | null> {
	const pending = inflight.get(url);
	if (pending) return pending;
	const load = readThroughCache(url).finally(() => inflight.delete(url));
	inflight.set(url, load);
	return load;
}

/**
 * Resolves a remote image URL to something an `<img>` can show: an object URL for the
 * cached bytes, or — when neither the cache nor the request produced any (no Cache Storage,
 * a refused request) — the URL itself, so the `<img>` makes the final call and its
 * `onError` decides whether the image is really unavailable. `null` while loading.
 */
export function useCachedImageSrc(url: string): string | null {
	const [loaded, setLoaded] = useState<{ url: string; src: string } | null>(null);

	useEffect(() => {
		let cancelled = false;
		let objectUrl: string | null = null;
		void loadCachedImage(url).then((blob) => {
			if (cancelled) return;
			if (!blob) {
				setLoaded({ url, src: url });
				return;
			}
			objectUrl = URL.createObjectURL(blob);
			setLoaded({ url, src: objectUrl });
		});
		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [url]);

	return loaded?.url === url ? loaded.src : null;
}

/** Test seam: forget in-flight loads and per-session revalidation between cases. */
export function resetCachedImageStateForTests(): void {
	inflight.clear();
	revalidated.clear();
}
