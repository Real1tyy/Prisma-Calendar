import { type App, type MetadataCache, type TAbstractFile, TFile, type Vault } from "obsidian";
import {
	type BehaviorSubject,
	from,
	fromEventPattern,
	lastValueFrom,
	merge,
	type Observable,
	of,
	BehaviorSubject as RxBehaviorSubject,
	Subject,
	type Subscription,
} from "rxjs";
import { debounceTime, filter, groupBy, map, mergeMap, switchMap, toArray } from "rxjs/operators";
import { compareFrontmatter, type FrontmatterDiff } from "../file/frontmatter-diff";

/**
 * Generic frontmatter object type for indexer
 */
export type IndexerFrontmatter = Record<string, unknown>;

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
}

/**
 * Raw file source with frontmatter and metadata
 */
export interface FileSource {
	filePath: string;
	mtime: number;
	frontmatter: IndexerFrontmatter;
	folder: string;
}

/**
 * Types of indexer events
 */
export type IndexerEventType = "file-changed" | "file-deleted";

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

type VaultEvent = "create" | "modify" | "delete" | "rename";

type FileIntent =
	| { kind: "changed"; file: TFile; path: string; oldPath?: string }
	| { kind: "deleted"; path: string; isRename?: boolean };

/**
 * Generic indexer that listens to Obsidian vault events and emits
 * RxJS observables with frontmatter diffs and metadata.
 *
 * This indexer is framework-agnostic and can be used by any plugin
 * that needs to track file changes with frontmatter.
 */
export class Indexer {
	private config: Required<IndexerConfig>;
	private fileSub: Subscription | null = null;
	private configSubscription: Subscription | null = null;
	private vault: Vault;
	private metadataCache: MetadataCache;
	private scanEventsSubject = new Subject<IndexerEvent>();
	private indexingCompleteSubject = new RxBehaviorSubject<boolean>(false);
	private frontmatterCache: Map<string, IndexerFrontmatter> = new Map();

	public readonly events$: Observable<IndexerEvent>;
	public readonly indexingComplete$: Observable<boolean>;

	constructor(app: App, configStore: BehaviorSubject<IndexerConfig>) {
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

	private normalizeConfig(config: IndexerConfig): Required<IndexerConfig> {
		return {
			includeFile: config.includeFile || (() => true),
			excludedDiffProps: config.excludedDiffProps || new Set(),
			scanConcurrency: config.scanConcurrency || 10,
			debounceMs: config.debounceMs || 100,
		};
	}

	async start(): Promise<void> {
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
		this.indexingCompleteSubject.complete();
	}

	resync(): void {
		this.frontmatterCache.clear();
		this.indexingCompleteSubject.next(false);
		void this.scanAllFiles();
	}

	/**
	 * Scan all markdown files in the configured directory
	 */
	private async scanAllFiles(): Promise<void> {
		const allFiles = this.vault.getMarkdownFiles();
		const relevantFiles = allFiles.filter((file) => this.config.includeFile(file.path));

		const events$ = from(relevantFiles).pipe(
			mergeMap(async (file) => {
				try {
					return await this.buildEvent(file);
				} catch (error) {
					console.error(`Error processing file ${file.path}:`, error);
					return null;
				}
			}, this.config.scanConcurrency),
			filter((event): event is IndexerEvent => event !== null),
			toArray()
		);

		try {
			const allEvents = await lastValueFrom(events$);

			for (const event of allEvents) {
				this.scanEventsSubject.next(event);
			}

			this.indexingCompleteSubject.next(true);
		} catch (error) {
			console.error("❌ Error during file scanning:", error);
			this.indexingCompleteSubject.next(true);
		}
	}

	/**
	 * Create an observable from a vault event
	 */
	private fromVaultEvent(eventName: VaultEvent): Observable<TAbstractFile> {
		if (eventName === "create") {
			return fromEventPattern<TAbstractFile>(
				(handler) => this.vault.on("create", handler),
				(handler) => this.vault.off("create", handler)
			);
		}

		if (eventName === "modify") {
			return fromEventPattern<TAbstractFile>(
				(handler) => this.vault.on("modify", handler),
				(handler) => this.vault.off("modify", handler)
			);
		}

		if (eventName === "delete") {
			return fromEventPattern<TAbstractFile>(
				(handler) => this.vault.on("delete", handler),
				(handler) => this.vault.off("delete", handler)
			);
		}

		// eventName === "rename"
		return fromEventPattern<[TAbstractFile, string]>(
			(handler) => this.vault.on("rename", handler),
			(handler) => this.vault.off("rename", handler)
		).pipe(map(([file]) => file));
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
	 * Build the file system events observable stream
	 */
	private buildFileSystemEvents$(): Observable<IndexerEvent> {
		const created$ = this.fromVaultEvent("create").pipe(this.toRelevantFiles());
		const modified$ = this.fromVaultEvent("modify").pipe(this.toRelevantFiles());
		const deleted$ = this.fromVaultEvent("delete").pipe(this.toRelevantFiles());

		const renamed$ = fromEventPattern<[TAbstractFile, string]>(
			(handler) => this.vault.on("rename", handler),
			(handler) => this.vault.off("rename", handler)
		);

		const changedIntents$ = merge(created$, modified$).pipe(
			this.debounceByPath(this.config.debounceMs, (f) => f.path),
			map((file): FileIntent => ({ kind: "changed", file, path: file.path }))
		);

		const deletedIntents$ = deleted$.pipe(map((file): FileIntent => ({ kind: "deleted", path: file.path })));

		const renamedIntents$ = renamed$.pipe(
			map(([f, oldPath]) => [f, oldPath] as const),
			filter(([f]) => Indexer.isMarkdownFile(f) && this.config.includeFile(f.path)),
			mergeMap(([f, oldPath]) => [
				{ kind: "deleted", path: oldPath, isRename: true } as FileIntent,
				{ kind: "changed", file: f, path: f.path, oldPath } as FileIntent,
			])
		);

		const intents$ = merge(changedIntents$, deletedIntents$, renamedIntents$);

		return intents$.pipe(
			switchMap((intent) => {
				if (intent.kind === "deleted") {
					this.frontmatterCache.delete(intent.path);
					return of<IndexerEvent>({
						type: "file-deleted",
						filePath: intent.path,
						isRename: intent.isRename,
					});
				}

				return from(this.buildEvent(intent.file, intent.oldPath)).pipe(filter((e): e is IndexerEvent => e !== null));
			})
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
			filePath: file.path,
			mtime: file.stat.mtime,
			frontmatter,
			folder: file.parent?.path || "",
		};

		const event: IndexerEvent = {
			type: "file-changed",
			filePath: file.path,
			oldPath,
			source,
			oldFrontmatter,
			frontmatterDiff: oldFrontmatter
				? compareFrontmatter(oldFrontmatter, frontmatter, this.config.excludedDiffProps)
				: undefined,
		};

		// Update cache
		this.frontmatterCache.set(file.path, { ...frontmatter });

		return event;
	}
}
