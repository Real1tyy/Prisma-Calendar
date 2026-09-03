import type { App, MetadataCache } from "obsidian";

/**
 * Undocumented `MetadataCache` members Obsidian uses for its own "Indexing
 * complete" notice (read out of `obsidian.asar`, see
 * [[knowledge-obsidian-metadata-cache-startup-internals]]). Boot order is
 * `await metadataCache.initialize()` → `workspace.loadLayout()`, so by
 * `onLayoutReady` `initialized` is always true and the only thing left to wait
 * for is the parse worker + link resolver draining — which is exactly
 * `isCacheClean()`. Feature-detected on every call, never assumed.
 */
export interface MetadataCacheInternals {
	initialized: boolean;
	inProgressTaskCount: number;
	isCacheClean: () => boolean;
	onCleanCache: (callback: () => void) => void;
}

export function getMetadataCacheInternals(cache: MetadataCache): MetadataCacheInternals | null {
	const candidate = cache as unknown as Partial<MetadataCacheInternals>;
	if (typeof candidate.isCacheClean !== "function" || typeof candidate.onCleanCache !== "function") return null;
	return candidate as MetadataCacheInternals;
}

/** Fallback (no internals): give up after this long even if `resolved` never fires. */
const CACHE_READY_TIMEOUT_MS = 30_000;
/**
 * Stall watchdog for the internals path. `onCleanCache` is Obsidian's own
 * promise that the callback fires once indexing drains; the one way it never
 * fires is a wedged worker whose `inProgressTaskCount` stops moving. Sample it
 * and only give up when it has not changed for a full window — a slow vault
 * that is still making progress waits as long as it needs.
 */
const STALL_SAMPLE_MS = 5_000;
const STALL_GIVE_UP_MS = 60_000;

/**
 * Resolves once Obsidian's metadata cache is fully ready: layout loaded, every
 * queued parse finished, link resolution drained. The single startup gate every
 * plugin in this repo sits behind before it scans, reads, or writes anything.
 *
 * With Obsidian's internals available this is the same condition Obsidian uses
 * for its "Indexing complete" notice. Without them (tests, a future build that
 * renames them) it falls back to "every markdown file has a cache entry, else
 * wait for `resolved`" with a hard timeout — weaker, because a file modified
 * since the last session serves its stale entry until reparsed.
 */
export function waitForCacheReady(app: App): Promise<void> {
	return new Promise<void>((resolve) => {
		app.workspace.onLayoutReady(() => {
			const internals = getMetadataCacheInternals(app.metadataCache);
			if (internals) {
				waitForCleanCache(internals, resolve);
			} else {
				waitForCacheReadyHeuristic(app, resolve);
			}
		});
	});
}

function waitForCleanCache(internals: MetadataCacheInternals, resolve: () => void): void {
	if (internals.isCacheClean()) {
		resolve();
		return;
	}

	let settled = false;
	let lastCount = internals.inProgressTaskCount;
	let lastProgressAt = Date.now();
	const finish = (): void => {
		if (settled) return;
		settled = true;
		window.clearInterval(watchdog);
		resolve();
	};
	const watchdog = window.setInterval(() => {
		if (internals.isCacheClean()) {
			finish();
			return;
		}
		if (internals.inProgressTaskCount !== lastCount) {
			lastCount = internals.inProgressTaskCount;
			lastProgressAt = Date.now();
			return;
		}
		if (Date.now() - lastProgressAt >= STALL_GIVE_UP_MS) {
			console.error(
				`[waitForCacheReady] Obsidian's metadata indexing has made no progress for ${STALL_GIVE_UP_MS}ms (${lastCount} task(s) in flight); proceeding with a partial cache.`
			);
			finish();
		}
	}, STALL_SAMPLE_MS);

	internals.onCleanCache(finish);
}

function waitForCacheReadyHeuristic(app: App, resolve: () => void): void {
	const files = app.vault.getMarkdownFiles();
	const hasUncachedFile = files.some((file) => app.metadataCache.getFileCache(file) === null);
	if (!hasUncachedFile) {
		resolve();
		return;
	}

	let settled = false;
	const finish = (): void => {
		if (settled) return;
		settled = true;
		window.clearTimeout(timeout);
		app.metadataCache.offref(ref);
		resolve();
	};
	const timeout = window.setTimeout(finish, CACHE_READY_TIMEOUT_MS);
	const ref = app.metadataCache.on("resolved", finish);
}
