import type { App } from "obsidian";

/**
 * Waits for Obsidian's workspace layout to be ready and the metadata cache
 * to be fully resolved before resolving.
 *
 * This is the correct startup pattern for any plugin that needs to access
 * `vault.getMarkdownFiles()` or `metadataCache.getFileCache()` reliably.
 *
 * Handles hot reload: if the cache is already populated (no pending batch),
 * the `resolved` event will never fire, so we detect that and resolve immediately.
 */
export function waitForCacheReady(app: App): Promise<void> {
	return new Promise<void>((resolve) => {
		app.workspace.onLayoutReady(() => {
			const files = app.vault.getMarkdownFiles();
			if (files.length === 0 || app.metadataCache.getFileCache(files[0]) !== null) {
				resolve();
				return;
			}

			const ref = app.metadataCache.on("resolved", () => {
				app.metadataCache.offref(ref);
				resolve();
			});
		});
	});
}
