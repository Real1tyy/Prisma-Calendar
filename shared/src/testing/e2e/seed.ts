import { expect, type Page } from "@playwright/test";

import type { ObsidianWindow } from "./types";

/**
 * Create a markdown file in the vault through Obsidian's `app.vault.create`
 * (so the metadata cache observes it), then poll `metadataCache.getFileCache`
 * until it returns a non-null entry. Returns once the file is fully indexed
 * and any handler that reads the metadata cache will see it.
 *
 * Why not `writeFileSync`: writing directly to disk bypasses Obsidian's
 * vault adapter and the metadata cache only catches up on the next filesystem
 * scan. Tests that seed a file and immediately invoke an action which reads
 * frontmatter via `metadataCache.getFileCache` race the cache and surface as
 * "MacroCommand: All 1 operations failed" or similar half-state errors.
 *
 * Use from any spec that seeds a fresh markdown file before invoking a
 * window-API action or command that depends on the metadata cache.
 */
export async function seedMarkdownNote(page: Page, relativePath: string, content: string): Promise<void> {
	await page.evaluate(
		async ({ path, body }) => {
			const w = window as unknown as ObsidianWindow;
			const vault = w.app.vault;
			if (!vault || typeof vault.create !== "function") throw new Error("app.vault.create not available");
			// Must call through the vault instance — `vault.create` uses
			// `this.checkPath` internally, so extracting it to a free variable
			// drops the binding and crashes with "Cannot read properties of
			// undefined (reading 'checkPath')".
			await vault.create(path, body);
		},
		{ path: relativePath, body: content }
	);

	await expect
		.poll(
			() =>
				page.evaluate((path) => {
					const w = window as unknown as ObsidianWindow;
					const vault = w.app.vault;
					const metadataCache = w.app.metadataCache;
					if (!vault || !metadataCache) return false;
					if (typeof vault.getAbstractFileByPath !== "function" || typeof metadataCache.getFileCache !== "function")
						return false;
					// Call through the instance — both methods reference `this`
					// (`vault.fileMap`, `metadataCache.fileCache`) internally.
					const file = vault.getAbstractFileByPath(path);
					if (!file) return false;
					return metadataCache.getFileCache(file) !== null;
				}, relativePath),
			{ message: `seedMarkdownNote: ${relativePath} never appeared in the metadata cache` }
		)
		.toBe(true);
}
