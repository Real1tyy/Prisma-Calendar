import type { App, MetadataCache } from "obsidian";

/**
 * The one undocumented `MetadataCache` member the startup gate reads (see
 * [[knowledge-obsidian-metadata-cache-startup-internals]]): the number of
 * parse tasks Obsidian still has in flight. Boot order is
 * `await metadataCache.initialize()` → `workspace.loadLayout()`, so by
 * `onLayoutReady` every file is either cached or queued for a parse, and
 * "no parse in flight" is exactly "every file's frontmatter is current".
 *
 * Deliberately NOT `isCacheClean()` / `onCleanCache()`: those also require the
 * link-resolver queue to be empty and idle, and in the wild that half sits
 * false on an idle vault (observed: 0 tasks in flight for a full minute while
 * `isCacheClean()` stayed false). Link resolution says nothing about
 * frontmatter, so waiting on it only ever delays startup. Feature-detected on
 * every call, never assumed.
 */
export interface MetadataCacheInternals {
	inProgressTaskCount: number;
}

export function getMetadataCacheInternals(cache: MetadataCache): MetadataCacheInternals | null {
	const candidate = cache as unknown as Partial<MetadataCacheInternals>;
	return typeof candidate.inProgressTaskCount === "number" ? (candidate as MetadataCacheInternals) : null;
}

/** True when Obsidian has no metadata parse in flight — every file's cache entry is current. */
export function isParsingIdle(internals: MetadataCacheInternals): boolean {
	return internals.inProgressTaskCount === 0;
}

/** Fallback (no internals): give up after this long even if `resolved` never fires. */
const CACHE_READY_TIMEOUT_MS = 30_000;
/** How often the internals path re-reads the in-flight counter. */
const POLL_MS = 250;
/**
 * Stall watchdog for the internals path: the one way the counter never reaches
 * zero is a wedged parse worker, which shows as the counter not moving. Give up
 * only after it has not changed for a full window — a slow vault that is still
 * making progress waits as long as it needs.
 */
const STALL_GIVE_UP_MS = 60_000;

/**
 * Resolves once Obsidian's metadata cache is fully ready: layout loaded and
 * every queued parse finished. The single startup gate every plugin in this
 * repo sits behind before it scans, reads, or writes anything.
 *
 * Without the internals (tests, a future build that renames the member) it
 * falls back to "every markdown file has a cache entry, else wait for
 * `resolved`" with a hard timeout — weaker, because a file modified since the
 * last session serves its stale entry until reparsed.
 */
export function waitForCacheReady(app: App): Promise<void> {
	return new Promise<void>((resolve) => {
		app.workspace.onLayoutReady(() => {
			const internals = getMetadataCacheInternals(app.metadataCache);
			if (internals) {
				waitForParsingIdle(internals, resolve);
			} else {
				waitForCacheReadyHeuristic(app, resolve);
			}
		});
	});
}

function waitForParsingIdle(internals: MetadataCacheInternals, resolve: () => void): void {
	if (isParsingIdle(internals)) {
		resolve();
		return;
	}

	let lastCount = internals.inProgressTaskCount;
	let lastProgressAt = Date.now();
	// Only the stall below is reported: waiting for indexing is the normal path
	// on every launch of a large vault, and Obsidian's review bans logging it
	// ([[decision-obsidian-eslint-release-gate]]). The give-up case stays — that
	// is the one a "stuck on the indexing overlay" report needs.
	const poll = window.setInterval(() => {
		if (isParsingIdle(internals)) {
			window.clearInterval(poll);
			resolve();
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
			window.clearInterval(poll);
			resolve();
		}
	}, POLL_MS);
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
