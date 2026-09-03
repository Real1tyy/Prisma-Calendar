import type { App, CachedMetadata, TFile } from "obsidian";

const DEFAULT_FILE_CACHE_TIMEOUT_MS = 5_000;

export interface WaitForFileCacheOptions {
	/** Upper bound on the wait. On expiry the current cache (possibly `null`) is returned. */
	timeoutMs?: number;
	/**
	 * Ignore the cache that exists right now and wait for the *next* `changed`
	 * event for this file. Use after a write you know Obsidian has not indexed
	 * yet — `vault.modify` resolves before the metadata cache catches up, so the
	 * existing entry is stale, not absent.
	 */
	afterChange?: boolean;
}

/**
 * Resolves with the file's `CachedMetadata` once Obsidian has indexed it —
 * the per-file counterpart of {@link waitForCacheReady}.
 *
 * Subscribes to `metadataCache.changed` for this path and then re-checks the
 * cache, so an entry that lands between the first probe and the subscription
 * is never missed. Pattern borrowed from obsidian-local-rest-api's
 * `waitForFileCache`. Always bounded: never returns a rejected promise, and on
 * timeout hands back whatever the cache holds so callers decide how to degrade.
 */
export function waitForFileCache(
	app: App,
	file: TFile,
	options: WaitForFileCacheOptions = {}
): Promise<CachedMetadata | null> {
	const { timeoutMs = DEFAULT_FILE_CACHE_TIMEOUT_MS, afterChange = false } = options;
	const { metadataCache } = app;

	if (!afterChange) {
		const existing = metadataCache.getFileCache(file);
		if (existing) return Promise.resolve(existing);
	}

	return new Promise((resolve) => {
		let settled = false;
		const finish = (): void => {
			if (settled) return;
			settled = true;
			metadataCache.offref(ref);
			window.clearTimeout(timer);
			resolve(metadataCache.getFileCache(file));
		};

		const ref = metadataCache.on("changed", (changed: TFile) => {
			if (changed.path === file.path) finish();
		});
		const timer = window.setTimeout(finish, timeoutMs);

		if (!afterChange && metadataCache.getFileCache(file)) finish();
	});
}
