import type { App } from "obsidian";

const CACHE_READY_TIMEOUT_MS = 30_000;

/**
 * Waits for Obsidian's workspace layout to be ready and the metadata cache
 * to be fully resolved before resolving.
 *
 * This is the correct startup pattern for any plugin that needs to access
 * `vault.getMarkdownFiles()` or `metadataCache.getFileCache()` reliably.
 *
 * Handles hot reload: if the cache is already populated (no pending batch),
 * the `resolved` event will never fire, so we detect that and resolve immediately.
 *
 * Includes a safety timeout to prevent hanging indefinitely if the cache
 * never resolves (e.g., Obsidian internal issue or empty vault edge case).
 */
export function waitForCacheReady(app: App): Promise<void> {
	return new Promise<void>((resolve) => {
		const timeout = setTimeout(() => {
			resolve();
		}, CACHE_READY_TIMEOUT_MS);

		app.workspace.onLayoutReady(() => {
			const files = app.vault.getMarkdownFiles();
			if (files.length === 0 || app.metadataCache.getFileCache(files[0]) !== null) {
				clearTimeout(timeout);
				resolve();
				return;
			}

			const ref = app.metadataCache.on("resolved", () => {
				clearTimeout(timeout);
				app.metadataCache.offref(ref);
				resolve();
			});
		});
	});
}
