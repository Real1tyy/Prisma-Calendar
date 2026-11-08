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
	try {
		const response = await fetch(url);
		// Electron can expose a readable CORS image with status 0. Unlike an opaque
		// failure, it still has nonempty, typed image bytes; validate those below.
		if (!response.ok && response.status !== 0) return null;
		const blob = await response.blob();
		if (blob.size === 0 || !blob.type.startsWith("image/")) return null;
		if (cache) {
			await cache.put(url, new Response(blob, { headers: { "content-type": blob.type } })).catch(() => undefined);
		}
		return blob;
	} catch {
		return null;
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
 * cached bytes, or — when neither the cache nor `fetch` produced any (no Cache Storage,
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
