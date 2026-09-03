import {
	TFile,
	type App,
	type CachedMetadata,
	type EventRef,
	type MetadataCache,
	type TAbstractFile,
	type Vault,
} from "obsidian";
import {
	EMPTY,
	from,
	fromEventPattern,
	lastValueFrom,
	merge,
	Observable,
	of,
	BehaviorSubject as RxBehaviorSubject,
	Subject,
	type BehaviorSubject,
	type Subscription,
} from "rxjs";
import { filter, map, mergeMap, toArray } from "rxjs/operators";

import { perf } from "../perf";
import { getMetadataCacheInternals, isParsingIdle, waitForCacheReady } from "../utils/async/wait-for-cache-ready";
import { compareFrontmatter, type FrontmatterDiff } from "./frontmatter/frontmatter-diff";

/**
 * Generic frontmatter object type for indexer
 */
export type IndexerFrontmatter = Record<string, unknown>;

const DEFAULT_SCAN_CONCURRENCY = 10;
const DEFAULT_DEBOUNCE_MS = 100;

/**
 * How long the scan waits for Obsidian to cache a file it found uncached before
 * completing without it. Measured from the last pending file that settled, not
 * from scan start, so a slow-but-progressing cold index is never cut short —
 * only a genuinely stuck one.
 */
const PENDING_CACHE_INACTIVITY_MS = 30_000;

/**
 * Obsidian-internal properties on FrontMatterCache that are not real
 * frontmatter and must be excluded from diff comparison and caching.
 */
const OBSIDIAN_INTERNAL_FM_PROPS = new Set(["position"]);

/**
 * Configuration for the generic indexer
 */
export interface IndexerConfig {
	/**
	 * Function that determines whether a file should be included in the indexer.
	 * Returns true if the file should be indexed, false otherwise.
	 * If not provided, all files are included.
	 */
	includeFile?: (path: string) => boolean;

	/**
	 * Properties to exclude when comparing frontmatter diffs
	 */
	excludedDiffProps?: Set<string>;

	/**
	 * Concurrency limit for file scanning operations
	 */
	scanConcurrency?: number;

	/**
	 * Debounce time in milliseconds for file change events
	 */
	debounceMs?: number;

	/**
	 * When true, renames emit a single "file-renamed" event instead of
	 * the default "file-deleted" + "file-changed" pair.
	 */
	emitRenameEvents?: boolean;

	/**
	 * When provided, scanAllFiles() uses these instead of vault.getMarkdownFiles().
	 * Used by child tables that receive pre-filtered files from their parent.
	 */
	preloadedFiles?: TFile[];

	/**
	 * Directory prefix for this indexer's scope. Files under this prefix
	 * that fail includeFile() are stored as descendant files for child indexers.
	 */
	directoryPrefix?: string;
}

/**
 * Raw file source with frontmatter and metadata
 */
export interface FileSource {
	file: TFile;
	filePath: string;
	mtime: number;
	frontmatter: IndexerFrontmatter;
	folder: string;
}

/**
 * Types of indexer events
 */
export type IndexerEventType = "file-changed" | "file-deleted" | "file-renamed";

/**
 * Generic indexer event
 */
export interface IndexerEvent {
	type: IndexerEventType;
	filePath: string;
	oldPath?: string;
	source?: FileSource;
	oldFrontmatter?: IndexerFrontmatter;
	frontmatterDiff?: FrontmatterDiff;
	/**
	 * True if this deletion event is part of a rename operation.
	 * Only present on "file-deleted" events.
	 */
	isRename?: boolean;
}

type NormalizedIndexerConfig = Required<
	Pick<IndexerConfig, "includeFile" | "excludedDiffProps" | "scanConcurrency" | "debounceMs" | "emitRenameEvents">
> &
	Pick<IndexerConfig, "preloadedFiles" | "directoryPrefix">;

type FileIntent =
	| { kind: "changed"; file: TFile; path: string; oldPath?: string }
	| { kind: "deleted"; path: string; isRename?: boolean }
	| { kind: "renamed"; file: TFile; path: string; oldPath: string };

/**
 * Generic indexer that listens to Obsidian vault events and emits
 * RxJS observables with frontmatter diffs and metadata.
 *
 * This indexer is framework-agnostic and can be used by any plugin
 * that needs to track file changes with frontmatter.
 */
export class Indexer {
	private config: NormalizedIndexerConfig;
	private fileSub: Subscription | null = null;
	private configSubscription: Subscription | null = null;
	private readonly app: App;
	private vault: Vault;
	private metadataCache: MetadataCache;
	private scanEventsSubject = new Subject<IndexerEvent>();
	private indexingCompleteSubject = new RxBehaviorSubject<boolean>(false);
	private frontmatterCache: Map<string, IndexerFrontmatter> = new Map();
	private effectiveExcludedProps: Set<string> = new Set();
	private _descendantFiles: TFile[] = [];
	/**
	 * In-scope files whose `getFileCache()` was `null` when the scan visited
	 * them. Obsidian fills its cache progressively on a cold or lagging start,
	 * so `null` means "not indexed yet", not "no frontmatter". The scan is not
	 * complete until every one of these has settled — see {@link finishScan}.
	 */
	private pendingCacheFiles: Map<string, TFile> = new Map();
	private pendingCacheTimer: number | null = null;
	private pendingCacheResolvedRef: EventRef | null = null;

	public readonly events$: Observable<IndexerEvent>;
	public readonly indexingComplete$: Observable<boolean>;

	get descendantFiles(): ReadonlyArray<TFile> {
		return this._descendantFiles;
	}

	constructor(app: App, configStore: BehaviorSubject<IndexerConfig>) {
		this.app = app;
		this.vault = app.vault;
		this.metadataCache = app.metadataCache;
		this.config = this.normalizeConfig(configStore.value);
		this.rebuildExcludedProps();

		this.configSubscription = configStore.subscribe((newConfig) => {
			const includeFileChanged = this.config.includeFile !== this.normalizeConfig(newConfig).includeFile;
			this.config = this.normalizeConfig(newConfig);
			this.rebuildExcludedProps();

			if (includeFileChanged) {
				this.indexingCompleteSubject.next(false);
				void this.scanAllFiles();
			}
		});

		this.events$ = this.scanEventsSubject.asObservable();
		this.indexingComplete$ = this.indexingCompleteSubject.asObservable();
	}

	private rebuildExcludedProps(): void {
		this.effectiveExcludedProps = new Set([...this.config.excludedDiffProps, ...OBSIDIAN_INTERNAL_FM_PROPS]);
	}

	private normalizeConfig(config: IndexerConfig): NormalizedIndexerConfig {
		return {
			includeFile: config.includeFile || (() => true),
			excludedDiffProps: config.excludedDiffProps || new Set(),
			scanConcurrency: config.scanConcurrency || DEFAULT_SCAN_CONCURRENCY,
			debounceMs: config.debounceMs || DEFAULT_DEBOUNCE_MS,
			emitRenameEvents: config.emitRenameEvents || false,
			...(config.preloadedFiles !== undefined ? { preloadedFiles: config.preloadedFiles } : {}),
			...(config.directoryPrefix !== undefined ? { directoryPrefix: config.directoryPrefix } : {}),
		};
	}

	async start(): Promise<void> {
		await waitForCacheReady(this.app);

		this.indexingCompleteSubject.next(false);

		const fileSystemEvents$ = this.buildFileSystemEvents$();

		this.fileSub = fileSystemEvents$.subscribe((event) => {
			this.emit(event);
		});

		await this.scanAllFiles();
	}

	stop(): void {
		this.fileSub?.unsubscribe();
		this.fileSub = null;
		this.configSubscription?.unsubscribe();
		this.configSubscription = null;
		this._descendantFiles = [];
		this.clearPendingCacheWait();
		this.indexingCompleteSubject.next(false);
	}

	resync(): void {
		this.frontmatterCache.clear();
		this._descendantFiles = [];
		this.indexingCompleteSubject.next(false);
		void this.scanAllFiles();
	}

	/**
	 * Scan all markdown files in the configured directory.
	 */
	private async scanAllFiles(): Promise<void> {
		const scanStart = performance.now();
		this.clearPendingCacheWait();
		try {
			const allFiles = this.config.preloadedFiles ?? this.vault.getMarkdownFiles();
			const files: TFile[] = [];
			const descendants: TFile[] = [];
			const dirPrefix = this.config.directoryPrefix ? this.config.directoryPrefix + "/" : undefined;

			for (const file of allFiles) {
				if (this.config.includeFile(file.path)) {
					files.push(file);
				} else if (dirPrefix && file.path.startsWith(dirPrefix)) {
					descendants.push(file);
				}
			}

			this._descendantFiles = descendants;

			const results$ = from(files).pipe(
				mergeMap((file): Observable<IndexerEvent> => {
					try {
						// `null` is "Obsidian has not indexed this file yet", not "no
						// frontmatter" — park it and let finishScan() hold completion.
						if (this.metadataCache.getFileCache(file) === null) {
							this.pendingCacheFiles.set(file.path, file);
							return EMPTY;
						}
						const event = this.buildEvent(file);
						return event ? of(event) : EMPTY;
					} catch (error) {
						console.error(`Error processing file ${file.path}:`, error);
						return EMPTY;
					}
				}, this.config.scanConcurrency),
				toArray()
			);

			const results = await lastValueFrom(results$, { defaultValue: [] });

			for (const event of results) {
				this.scanEventsSubject.next(event);
			}
		} catch (error) {
			console.error("❌ Error during file scanning:", error);
		}

		perf.record("index.scanVault", performance.now() - scanStart);
		this.finishScan();
	}

	/**
	 * Declares the scan complete only once every file it found uncached has
	 * settled: arrived through the live `changed` pipeline, been deleted, or
	 * become cached by the time Obsidian reports `resolved`. Until then the
	 * scan is a partial view, and downstream consumers that gate on
	 * `indexingComplete$` (sync services above all) must keep waiting — a
	 * partial map is exactly what re-creates every already-synced note.
	 */
	private finishScan(): void {
		if (this.pendingCacheFiles.size === 0) {
			this.indexingCompleteSubject.next(true);
			return;
		}
		if (this.dropUnparseableIfCacheClean()) return;
		this.pendingCacheResolvedRef = this.metadataCache.on("resolved", () => this.retryPendingCache());
		this.armPendingCacheTimer();
	}

	private retryPendingCache(): void {
		for (const [path, file] of Array.from(this.pendingCacheFiles.entries())) {
			if (this.metadataCache.getFileCache(file) === null) continue;
			const event = this.buildEvent(file);
			if (event) {
				this.emit(event);
			} else {
				this.settlePendingCache(path);
			}
		}
		this.dropUnparseableIfCacheClean();
	}

	/**
	 * Once Obsidian has no parse task in flight, a file that is still uncached
	 * is one Obsidian itself failed to parse ("Metadata failed to parse" in its
	 * console). Nothing will ever cache it, so waiting out the inactivity
	 * window would only delay every consumer for nothing. Drop it with a
	 * warning and complete. Returns true when it completed the scan.
	 */
	private dropUnparseableIfCacheClean(): boolean {
		if (this.pendingCacheFiles.size === 0) return false;
		const internals = getMetadataCacheInternals(this.metadataCache);
		if (!internals || !isParsingIdle(internals)) return false;
		const paths = Array.from(this.pendingCacheFiles.keys());
		console.warn(
			`[Indexer] Obsidian finished indexing but ${paths.length} file(s) have no metadata cache — Obsidian could not parse them (check its console for "Metadata failed to parse"); completing the scan without them:`,
			paths
		);
		this.clearPendingCacheWait();
		this.indexingCompleteSubject.next(true);
		return true;
	}

	private settlePendingCache(path: string): void {
		if (!this.pendingCacheFiles.delete(path)) return;
		if (this.pendingCacheFiles.size === 0) {
			this.clearPendingCacheWait();
			this.indexingCompleteSubject.next(true);
			return;
		}
		this.armPendingCacheTimer();
	}

	private armPendingCacheTimer(): void {
		if (this.pendingCacheTimer !== null) window.clearTimeout(this.pendingCacheTimer);
		this.pendingCacheTimer = window.setTimeout(() => {
			const paths = Array.from(this.pendingCacheFiles.keys());
			console.warn(
				`[Indexer] ${paths.length} file(s) never appeared in the metadata cache after ${PENDING_CACHE_INACTIVITY_MS}ms of inactivity; completing the scan without them:`,
				paths
			);
			this.clearPendingCacheWait();
			this.indexingCompleteSubject.next(true);
		}, PENDING_CACHE_INACTIVITY_MS);
	}

	private clearPendingCacheWait(): void {
		this.pendingCacheFiles.clear();
		if (this.pendingCacheTimer !== null) {
			window.clearTimeout(this.pendingCacheTimer);
			this.pendingCacheTimer = null;
		}
		if (this.pendingCacheResolvedRef) {
			this.metadataCache.offref(this.pendingCacheResolvedRef);
			this.pendingCacheResolvedRef = null;
		}
	}

	/**
	 * Single exit for every event after the scan. Settles the pending-cache
	 * entry the event accounts for, so a file that was uncached at scan time
	 * counts as indexed the moment its real event goes out — not a debounce
	 * window earlier, when the raw `changed` notification arrived.
	 */
	private emit(event: IndexerEvent): void {
		this.scanEventsSubject.next(event);
		if (this.pendingCacheFiles.size === 0) return;
		if (event.type === "file-renamed" && event.oldPath !== undefined) {
			const file = this.pendingCacheFiles.get(event.oldPath);
			if (file) {
				this.pendingCacheFiles.delete(event.oldPath);
				this.pendingCacheFiles.set(event.filePath, file);
			}
			return;
		}
		this.settlePendingCache(event.filePath);
	}

	/**
	 * Create an observable from a metadataCache event, extracting the TFile
	 * from the first callback argument.
	 */
	private fromMetadataCacheChanged(): Observable<TFile> {
		return new Observable<TFile>((subscriber) => {
			const ref = this.metadataCache.on("changed", (file: TFile) => {
				subscriber.next(file);
			});
			return () => {
				this.metadataCache.offref(ref);
			};
		});
	}

	/**
	 * Create an observable from metadataCache "deleted" events.
	 * Fires before vault.on("delete"), making vault delete redundant.
	 * The prevCache parameter provides the last known metadata for the file.
	 */
	private fromMetadataCacheDeleted(): Observable<TFile> {
		return new Observable<TFile>((subscriber) => {
			const ref = this.metadataCache.on("deleted", (file: TFile, _prevCache: CachedMetadata | null) => {
				subscriber.next(file);
			});
			return () => {
				this.metadataCache.offref(ref);
			};
		});
	}

	/**
	 * Create an observable from vault "modify" events.
	 * Catches content-only changes that don't trigger metadataCache "changed".
	 */
	private fromVaultModify(): Observable<TFile> {
		return fromEventPattern<TAbstractFile>(
			(handler) => this.vault.on("modify", handler),
			(handler) => this.vault.off("modify", handler)
		).pipe(filter((f): f is TFile => Indexer.isMarkdownFile(f)));
	}

	private static isMarkdownFile(f: TAbstractFile): f is TFile {
		return f instanceof TFile && f.extension === "md";
	}

	/**
	 * Filter to only relevant markdown files in configured directory
	 */
	private toRelevantFiles<T extends TAbstractFile>() {
		return (source: Observable<T>) =>
			source.pipe(
				filter((f: TAbstractFile): f is TFile => Indexer.isMarkdownFile(f)),
				filter((f) => this.config.includeFile(f.path))
			);
	}

	/**
	 * Debounce events by file path using a manual Map instead of RxJS groupBy.
	 * groupBy creates inner observables whose per-key groups live until the source
	 * completes. On a long-lived stream like Obsidian file events, that means
	 * unbounded retention of stale key-groups for every file path ever seen.
	 * This manual version only keeps keys with active debounce timers and
	 * cleans them up when the timer fires or the subscription is torn down.
	 */
	private debounceByPath<T>(ms: number, key: (x: T) => string) {
		return (source: Observable<T>) =>
			new Observable<T>((subscriber) => {
				const pending = new Map<string, { timer: number; value: T }>();

				const sub = source.subscribe({
					next: (value) => {
						const k = key(value);
						const existing = pending.get(k);
						if (existing) window.clearTimeout(existing.timer);
						pending.set(k, {
							value,
							timer: window.setTimeout(() => {
								const entry = pending.get(k);
								if (!entry) return;
								pending.delete(k);
								subscriber.next(entry.value);
							}, ms),
						});
					},
					error: (err) => subscriber.error(err),
					complete: () => {
						// Flush pending debounced values on complete instead of dropping them
						for (const { timer, value } of pending.values()) {
							window.clearTimeout(timer);
							subscriber.next(value);
						}
						pending.clear();
						subscriber.complete();
					},
				});

				return () => {
					sub.unsubscribe();
					for (const { timer } of pending.values()) window.clearTimeout(timer);
					pending.clear();
				};
			});
	}

	/**
	 * Build the file system events observable stream.
	 *
	 * Listens to four events (see docs/knowledge/2026-08-04-101012-obsidian-event-firing-order.md):
	 *
	 * 1. metadataCache "changed" — covers file creation and frontmatter modifications.
	 *
	 * 2. vault.on("modify") — covers content-only changes that don't trigger
	 *    metadataCache "changed" (e.g., plain text edits with no metadata-relevant
	 *    elements). Merged with metadataCache "changed" and debounced by path so
	 *    that when both fire for the same modification, only the last event
	 *    (metadataCache "changed") within the debounce window is processed.
	 *
	 * 3. metadataCache "deleted" — covers file deletion.
	 *    Fires before vault.on("delete"), making vault delete redundant.
	 *
	 * 4. vault.on("rename") — the only event for renames.
	 *    metadataCache does NOT emit changed/deleted on rename.
	 */
	private buildFileSystemEvents$(): Observable<IndexerEvent> {
		const metadataChanged$ = this.fromMetadataCacheChanged().pipe(this.toRelevantFiles());
		const vaultModified$ = this.fromVaultModify().pipe(this.toRelevantFiles());
		const metadataDeleted$ = this.fromMetadataCacheDeleted().pipe(this.toRelevantFiles());

		const renamed$ = fromEventPattern<[TAbstractFile, string]>(
			(handler) => this.vault.on("rename", handler),
			(handler) => this.vault.off("rename", handler)
		);

		const changed$ = merge(vaultModified$, metadataChanged$);
		const changedIntents$ = changed$.pipe(
			this.debounceByPath(this.config.debounceMs, (f) => f.path),
			map((file): FileIntent => ({ kind: "changed", file, path: file.path }))
		);

		const deletedIntents$ = metadataDeleted$.pipe(map((file): FileIntent => ({ kind: "deleted", path: file.path })));

		const renamedIntents$ = renamed$.pipe(
			filter(
				(pair): pair is [TFile, string] =>
					Indexer.isMarkdownFile(pair[0]) && (this.config.includeFile(pair[0].path) || this.config.includeFile(pair[1]))
			),
			mergeMap(([file, oldPath]): FileIntent[] => {
				const newInScope = this.config.includeFile(file.path);
				const oldInScope = this.config.includeFile(oldPath);

				// emitRenameEvents only applies when the file stays in scope —
				// a move into or out of scope is semantically a create or delete,
				// not a rename, and downstream consumers can't react to an oldPath
				// they never tracked (or a newPath outside their world).
				if (this.config.emitRenameEvents && newInScope && oldInScope) {
					return [{ kind: "renamed", file, path: file.path, oldPath }];
				}

				const intents: FileIntent[] = [];
				if (oldInScope) {
					intents.push({ kind: "deleted", path: oldPath, isRename: true });
				}
				if (newInScope) {
					intents.push({ kind: "changed", file, path: file.path, oldPath });
				}
				return intents;
			})
		);

		const intents$ = merge(changedIntents$, deletedIntents$, renamedIntents$);

		// CRITICAL: Use mergeMap instead of switchMap to prevent cancellation
		// switchMap would cancel in-flight buildEvent() when new intents arrive,
		// causing events to be lost. mergeMap processes all intents concurrently.
		return intents$.pipe(
			mergeMap((intent) => {
				if (intent.kind === "deleted") {
					this.frontmatterCache.delete(intent.path);
					return of<IndexerEvent>({
						type: "file-deleted",
						filePath: intent.path,
						...(intent.isRename !== undefined ? { isRename: intent.isRename } : {}),
					});
				}

				if (intent.kind === "renamed") {
					const cached = this.frontmatterCache.get(intent.oldPath);
					if (cached) {
						this.frontmatterCache.delete(intent.oldPath);
						this.frontmatterCache.set(intent.path, cached);
					}
					return of<IndexerEvent>({
						type: "file-renamed",
						filePath: intent.path,
						oldPath: intent.oldPath,
					});
				}

				try {
					const event = this.buildEvent(intent.file, intent.oldPath);
					return event ? of(event) : EMPTY;
				} catch (error) {
					console.error(`Error building event for ${intent.path}:`, error);
					return EMPTY;
				}
			}, this.config.scanConcurrency)
		);
	}

	/**
	 * Build an indexer event from a file
	 */
	private buildEvent(file: TFile, oldPath?: string): IndexerEvent | null {
		const cache = this.metadataCache.getFileCache(file);
		if (!cache || !cache.frontmatter) return null;

		const { frontmatter } = cache;
		const oldFrontmatter = this.frontmatterCache.get(file.path);

		const source: FileSource = {
			file,
			filePath: file.path,
			mtime: file.stat.mtime,
			frontmatter,
			folder: file.parent?.path || "",
		};

		const frontmatterDiff = oldFrontmatter
			? compareFrontmatter(oldFrontmatter, frontmatter, this.effectiveExcludedProps)
			: undefined;

		const event: IndexerEvent = {
			type: "file-changed",
			filePath: file.path,
			...(oldPath !== undefined ? { oldPath } : {}),
			source,
			...(oldFrontmatter !== undefined ? { oldFrontmatter } : {}),
			...(frontmatterDiff !== undefined ? { frontmatterDiff } : {}),
		};

		// Deep clone to prevent Obsidian metadata cache mutations (e.g. Properties view)
		// from silently corrupting our cached snapshot, and strip internal props.
		const cleanFm: IndexerFrontmatter = {};
		for (const key of Object.keys(frontmatter)) {
			if (!OBSIDIAN_INTERNAL_FM_PROPS.has(key)) {
				cleanFm[key] = frontmatter[key];
			}
		}
		this.frontmatterCache.set(file.path, structuredClone(cleanFm));

		return event;
	}
}
