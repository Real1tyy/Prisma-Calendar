import { type App, type CachedMetadata, type MetadataCache, type TAbstractFile, TFile, type Vault } from "obsidian";
import {
	type BehaviorSubject,
	BehaviorSubject as RxBehaviorSubject,
	from,
	fromEventPattern,
	lastValueFrom,
	merge,
	Observable,
	of,
	Subject,
	type Subscription,
} from "rxjs";
import { debounceTime, filter, groupBy, map, mergeMap, toArray } from "rxjs/operators";

import { waitForCacheReady } from "../async/wait-for-cache-ready";
import { compareFrontmatter, type FrontmatterDiff } from "../file/frontmatter-diff";

/**
 * Generic frontmatter object type for indexer
 */
export type IndexerFrontmatter = Record<string, unknown>;

const DEFAULT_SCAN_CONCURRENCY = 10;
const DEFAULT_DEBOUNCE_MS = 100;

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
	private _descendantFiles: TFile[] = [];

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

		this.configSubscription = configStore.subscribe((newConfig) => {
			const includeFileChanged = this.config.includeFile !== this.normalizeConfig(newConfig).includeFile;
			this.config = this.normalizeConfig(newConfig);

			if (includeFileChanged) {
				this.indexingCompleteSubject.next(false);
				void this.scanAllFiles();
			}
		});

		this.events$ = this.scanEventsSubject.asObservable();
		this.indexingComplete$ = this.indexingCompleteSubject.asObservable();
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
			this.scanEventsSubject.next(event);
		});

		await this.scanAllFiles();
	}

	stop(): void {
		this.fileSub?.unsubscribe();
		this.fileSub = null;
		this.configSubscription?.unsubscribe();
		this.configSubscription = null;
		this._descendantFiles = [];
		this.indexingCompleteSubject.complete();
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
				mergeMap(async (file) => {
					try {
						return await this.buildEvent(file);
					} catch (error) {
						console.error(`Error processing file ${file.path}:`, error);
						return null;
					}
				}, this.config.scanConcurrency),
				toArray()
			);

			const results = await lastValueFrom(results$, { defaultValue: [] });

			for (const event of results) {
				if (event) {
					this.scanEventsSubject.next(event);
				}
			}
		} catch (error) {
			console.error("❌ Error during file scanning:", error);
		}

		this.indexingCompleteSubject.next(true);
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
	 * Debounce events by file path
	 */
	private debounceByPath<T>(ms: number, key: (x: T) => string) {
		return (source: Observable<T>) =>
			source.pipe(
				groupBy(key),
				mergeMap((g$) => g$.pipe(debounceTime(ms)))
			);
	}

	/**
	 * Build the file system events observable stream.
	 *
	 * Listens to four events (see docs/obsidian/event-firing-order.md):
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
			filter(([f]) => Indexer.isMarkdownFile(f) && this.config.includeFile(f.path)),
			mergeMap(([f, oldPath]): FileIntent[] => {
				const file = f as TFile;
				return this.config.emitRenameEvents
					? [{ kind: "renamed", file, path: file.path, oldPath }]
					: [
							{ kind: "deleted", path: oldPath, isRename: true },
							{ kind: "changed", file, path: file.path, oldPath },
						];
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

				return from(this.buildEvent(intent.file, intent.oldPath)).pipe(filter((e): e is IndexerEvent => e !== null));
			}, this.config.scanConcurrency)
		);
	}

	/**
	 * Build an indexer event from a file
	 */
	private async buildEvent(file: TFile, oldPath?: string): Promise<IndexerEvent | null> {
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

		const effectiveExcludedProps = new Set([...this.config.excludedDiffProps, ...OBSIDIAN_INTERNAL_FM_PROPS]);
		const frontmatterDiff = oldFrontmatter
			? compareFrontmatter(oldFrontmatter, frontmatter, effectiveExcludedProps)
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
