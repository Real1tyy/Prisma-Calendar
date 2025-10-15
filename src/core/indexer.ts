import { isFileInConfiguredDirectory } from "@real1ty-obsidian-plugins/utils/file-utils";
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
import { SCAN_CONCURRENCY } from "../constants";
import type { SingleCalendarConfig } from "../types/index";
import { type NodeRecurringEvent, parseRRuleFromFrontmatter } from "../types/recurring-event";
import { generateUniqueRruleId } from "../utils/calendar-events";

export interface RawEventSource {
	filePath: string;
	mtime: number;
	frontmatter: Record<string, unknown>;
	folder: string;
}

export type IndexerEventType = "file-changed" | "file-deleted" | "recurring-event-found";

export interface IndexerEvent {
	type: IndexerEventType;
	filePath: string;
	source?: RawEventSource;
	recurringEvent?: NodeRecurringEvent;
}

type VaultEvent = "create" | "modify" | "delete" | "rename";
type FileIntent = { kind: "changed"; file: TFile; path: string } | { kind: "deleted"; path: string };

export class Indexer {
	private _settings: SingleCalendarConfig;
	private fileSub: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private vault: Vault;
	private metadataCache: MetadataCache;
	private scanEventsSubject = new Subject<IndexerEvent>();
	private indexingCompleteSubject = new RxBehaviorSubject<boolean>(false);

	public readonly events$: Observable<IndexerEvent>;
	public readonly indexingComplete$: Observable<boolean>;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this.vault = app.vault;
		this.metadataCache = app.metadataCache;
		this._settings = settingsStore.value;

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const filtersChanged =
				JSON.stringify(this._settings.filterExpressions) !== JSON.stringify(newSettings.filterExpressions);
			this._settings = newSettings;

			if (filtersChanged) {
				this.indexingCompleteSubject.next(false);
				this.scanAllFiles();
			}
		});
		this.events$ = this.scanEventsSubject.asObservable();
		this.indexingComplete$ = this.indexingCompleteSubject.asObservable();
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

		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;

		this.indexingCompleteSubject.complete();
	}

	private async scanAllFiles(): Promise<void> {
		const allFiles = this.vault.getMarkdownFiles();
		const relevantFiles = allFiles.filter((file) => this.isRelevantFile(file));

		const events$ = from(relevantFiles).pipe(
			mergeMap(async (file) => {
				try {
					return await this.buildEvents(file);
				} catch (error) {
					console.error(`Error processing file ${file.path}:`, error);
					return [];
				}
			}, SCAN_CONCURRENCY),
			mergeMap((events) => events),
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

	private fromVaultEvent(eventName: VaultEvent): Observable<any> {
		return fromEventPattern(
			(handler) => this.vault.on(eventName as any, handler),
			(handler) => this.vault.off(eventName as any, handler)
		);
	}

	private static isMarkdownFile(f: TAbstractFile): f is TFile {
		return f instanceof TFile && f.extension === "md";
	}

	private toRelevantFiles<T extends TAbstractFile>() {
		return (source: Observable<T>) =>
			source.pipe(
				filter(Indexer.isMarkdownFile),
				filter((f) => this.isRelevantFile(f))
			);
	}

	private debounceByPath<T>(ms: number, key: (x: T) => string) {
		return (source: Observable<T>) =>
			source.pipe(
				groupBy(key),
				mergeMap((g$) => g$.pipe(debounceTime(ms)))
			);
	}

	private buildFileSystemEvents$(): Observable<IndexerEvent> {
		const created$ = this.fromVaultEvent("create").pipe(this.toRelevantFiles());
		const modified$ = this.fromVaultEvent("modify").pipe(this.toRelevantFiles());
		const deleted$ = this.fromVaultEvent("delete").pipe(this.toRelevantFiles());
		const renamed$ = this.fromVaultEvent("rename");

		const changedIntents$ = merge(created$, modified$).pipe(
			this.debounceByPath(250, (f) => f.path),
			map((file): FileIntent => ({ kind: "changed", file, path: file.path }))
		);

		const deletedIntents$ = deleted$.pipe(map((file): FileIntent => ({ kind: "deleted", path: file.path })));

		const renamedIntents$ = renamed$.pipe(
			map(([f, oldPath]) => [f, oldPath] as const),
			filter(([f]) => Indexer.isMarkdownFile(f) && this.isRelevantFile(f)),
			mergeMap(([f, oldPath]) => [
				{ kind: "deleted", path: oldPath } as FileIntent,
				{ kind: "changed", file: f, path: f.path } as FileIntent,
			])
		);

		const intents$ = merge(changedIntents$, deletedIntents$, renamedIntents$);

		return intents$.pipe(
			switchMap((intent) => {
				if (intent.kind === "deleted") {
					return of<IndexerEvent>({ type: "file-deleted", filePath: intent.path });
				}
				// buildEvents returns an array of events, convert to observable and flatten
				return from(this.buildEvents(intent.file)).pipe(mergeMap((events) => events));
			}),
			filter((e): e is IndexerEvent => e !== null)
		);
	}

	private async buildEvents(file: TFile): Promise<IndexerEvent[]> {
		const cache = this.metadataCache.getFileCache(file);
		if (!cache || !cache.frontmatter) return [];
		const { frontmatter } = cache;

		const events: IndexerEvent[] = [];

		const recurring = await this.tryParseRecurring(file, frontmatter);
		if (recurring) {
			// Always add recurring events even if skipped - this allows navigation
			// to source from physical instances and viewing recurring event lists.
			// The RecurringEventManager will check skip property and not generate new instances.
			events.push({
				type: "recurring-event-found",
				filePath: file.path,
				recurringEvent: recurring,
			});
		}

		// Always emit file-changed events for files with start property OR date property
		// Let EventStore/Parser handle filtering - this ensures cached events
		// get invalidated when properties change and no longer pass filters
		// This allows recurring source files to ALSO appear as regular events on the calendar
		const hasTimedEvent = frontmatter[this._settings.startProp];
		const hasAllDayEvent = frontmatter[this._settings.dateProp];

		if (hasTimedEvent || hasAllDayEvent) {
			if (this._settings.markPastInstancesAsDone) {
				this.markPastEventAsDone(file, frontmatter).catch((error) => {
					console.error(`Error in background marking of past event ${file.path}:`, error);
				});
			}

			const source: RawEventSource = {
				filePath: file.path,
				mtime: file.stat.mtime,
				frontmatter,
				folder: file.parent?.path || "",
			};

			events.push({ type: "file-changed", filePath: file.path, source });
		}

		return events;
	}

	private isRelevantFile(file: TFile): boolean {
		return isFileInConfiguredDirectory(file.path, this._settings.directory);
	}

	private async tryParseRecurring(
		file: TFile,
		frontmatter: Record<string, unknown>
	): Promise<NodeRecurringEvent | null> {
		const rrules = parseRRuleFromFrontmatter(frontmatter, this._settings);
		if (!rrules) return null;

		const existingRRuleId = frontmatter[this._settings.rruleIdProp];
		let rRuleId: string;

		if (typeof existingRRuleId === "string") {
			rRuleId = existingRRuleId;
		} else {
			rRuleId = generateUniqueRruleId();
			await this.app.fileManager.processFrontMatter(file, (fm) => {
				fm[this._settings.rruleIdProp] = rRuleId;
			});
		}

		// Defer content reading - we'll read it lazily when needed
		// This avoids blocking I/O during the initial scan
		return {
			sourceFilePath: file.path,
			title: file.basename,
			rRuleId,
			rrules,
			frontmatter,
			content: undefined, // Empty initially - will be loaded on-demand by RecurringEventManager
		};
	}

	private async markPastEventAsDone(file: TFile, frontmatter: Record<string, unknown>): Promise<void> {
		// Don't mark source recurring events as done - they are templates for future instances
		const isSourceRecurringEvent = !!frontmatter[this._settings.rruleProp];
		if (isSourceRecurringEvent) {
			return;
		}

		const now = new Date();
		let isPastEvent = false;

		// Check if event is in the past
		const allDayValue = frontmatter[this._settings.allDayProp];
		const isAllDay = allDayValue === true || allDayValue === "true";

		if (isAllDay) {
			// For all-day events, check the date property
			const dateValue = frontmatter[this._settings.dateProp];
			if (dateValue) {
				const eventDate = new Date(String(dateValue));
				// Set to end of day for comparison
				eventDate.setHours(23, 59, 59, 999);
				isPastEvent = eventDate < now;
			}
		} else {
			// For timed events, check the end date
			const endValue = frontmatter[this._settings.endProp];
			if (endValue) {
				const eventEnd = new Date(String(endValue));
				isPastEvent = eventEnd < now;
			}
		}

		// If event is in the past, mark it as done
		if (isPastEvent) {
			const currentStatus = frontmatter[this._settings.statusProperty];
			const doneValue = this._settings.doneValue;

			// Only update if status is not already the done value
			if (currentStatus !== doneValue) {
				try {
					await this.app.fileManager.processFrontMatter(file, (fm) => {
						fm[this._settings.statusProperty] = doneValue;
					});
				} catch (error) {
					console.error(`Error marking event as done in file ${file.path}:`, error);
				}
			}
		}
	}
}
