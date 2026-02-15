import {
	type FrontmatterDiff,
	Indexer as GenericIndexer,
	type IndexerEvent as GenericIndexerEvent,
	type IndexerConfig,
	areSetsEqual,
	removeMarkdownExtension,
	SyncStore,
} from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";
import { BehaviorSubject, type Observable, Subject, Subscription } from "rxjs";
import { filter, take } from "rxjs/operators";
import { SCAN_CONCURRENCY } from "../constants";
import type { Frontmatter, PrismaSyncDataSchema, SingleCalendarConfig } from "../types/index";
import { type NodeRecurringEvent, parseRRuleFromFrontmatter } from "../types/recurring-event";
import { cleanupTitle, generateUniqueRruleId, getRecurringInstanceExcludedProps } from "../utils/calendar-events";
import { intoDate, toSafeString } from "../utils/format";

export interface RawEventSource {
	filePath: string;
	mtime: number;
	frontmatter: Frontmatter;
	folder: string;
	isAllDay: boolean;
	isUntracked: boolean;
}

type IndexerEventType = "file-changed" | "file-deleted" | "recurring-event-found" | "untracked-file-changed";

export interface IndexerEvent {
	type: IndexerEventType;
	filePath: string;
	oldPath?: string;
	source?: RawEventSource;
	recurringEvent?: NodeRecurringEvent;
	oldFrontmatter?: Frontmatter;
	frontmatterDiff?: FrontmatterDiff;
	/**
	 * True if this deletion event is part of a rename operation.
	 * Only present on "file-deleted" events.
	 */
	isRename?: boolean;
}

/**
 * Wrapper around the generic Indexer from utils that adds calendar-specific functionality.
 * Listens to generic indexer events and enhances them with recurring event tracking.
 */
export class Indexer {
	private settings: SingleCalendarConfig;
	private genericIndexer: GenericIndexer;
	private subs = new Subscription();
	private scanEventsSubject = new Subject<IndexerEvent>();
	private indexingCompleteSubject = new BehaviorSubject<boolean>(false);
	private lastDirectory: string;
	private lastExcludedDiffProps: Set<string>;
	private initialScanHandlers: Promise<void>[] | null = [];
	private handlerCollector: Promise<void>[] | null = null;
	/** Paths currently being written to by processFrontMatter — suppress re-indexing */
	private inFlightWrites = new Set<string>();
	/** Per-file queue to serialize processFrontMatter calls */
	private fmLocks = new Map<string, Promise<void>>();
	private readonly includeFile = (filePath: string): boolean => {
		const directory = this.settings.directory;
		if (!directory) return true;
		return filePath === directory || filePath.startsWith(`${directory}/`);
	};

	public readonly events$: Observable<IndexerEvent>;
	public readonly indexingComplete$: Observable<boolean>;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private syncStore: SyncStore<typeof PrismaSyncDataSchema> | null
	) {
		this.settings = settingsStore.value;
		this.lastDirectory = this.settings.directory;
		this.lastExcludedDiffProps = getRecurringInstanceExcludedProps(this.settings);

		const configStore = new BehaviorSubject<IndexerConfig>(this.buildIndexerConfig());
		this.genericIndexer = new GenericIndexer(app, configStore);

		// CRITICAL: Catch async handler errors to prevent unhandled promise rejections
		// during live events (after initial scan completes)
		this.subs.add(
			this.genericIndexer.events$.subscribe((genericEvent) => {
				const handler = this.handleGenericEvent(genericEvent).catch((error) => {
					console.error("Indexer handleGenericEvent error:", error);
				});
				// Push to whichever collector is active (initialScanHandlers during start, handlerCollector during resync)
				if (this.initialScanHandlers) {
					this.initialScanHandlers.push(handler);
				} else if (this.handlerCollector) {
					this.handlerCollector.push(handler);
				}
			})
		);

		this.subs.add(
			settingsStore.subscribe((newSettings) => {
				const filtersChanged =
					JSON.stringify(this.settings.filterExpressions) !== JSON.stringify(newSettings.filterExpressions);
				const directoryChanged = this.lastDirectory !== newSettings.directory;
				const nextExcludedDiffProps = getRecurringInstanceExcludedProps(newSettings);
				const excludedDiffPropsChanged = !areSetsEqual(this.lastExcludedDiffProps, nextExcludedDiffProps);
				this.settings = newSettings;

				const shouldResync = filtersChanged || directoryChanged;
				if (shouldResync || excludedDiffPropsChanged) {
					// Keep the generic indexer's config up to date.
					// IMPORTANT: includeFile is a stable function reference; changing only excludedDiffProps
					// must not trigger an expensive full scan.
					configStore.next(this.buildIndexerConfig());
					this.lastDirectory = newSettings.directory;
					this.lastExcludedDiffProps = nextExcludedDiffProps;
				}

				if (shouldResync) {
					this.resync();
				}
			})
		);

		this.events$ = this.scanEventsSubject.asObservable();
		this.indexingComplete$ = this.indexingCompleteSubject.asObservable();
	}

	/**
	 * Serialize processFrontMatter calls per file to prevent interleaving writes
	 * and suppress the resulting file-changed events from our own writebacks.
	 */
	private enqueueFrontmatterWrite(file: TFile, fn: (fm: Frontmatter) => void): Promise<void> {
		const path = file.path;
		const prev = this.fmLocks.get(path) ?? Promise.resolve();
		const next = prev
			.then(async () => {
				this.inFlightWrites.add(path);
				try {
					await this.app.fileManager.processFrontMatter(file, fn);
				} finally {
					this.inFlightWrites.delete(path);
				}
			})
			.finally(() => {
				if (this.fmLocks.get(path) === next) this.fmLocks.delete(path);
			});
		this.fmLocks.set(path, next);
		return next;
	}

	private buildIndexerConfig(): IndexerConfig {
		return {
			includeFile: this.includeFile,
			excludedDiffProps: getRecurringInstanceExcludedProps(this.settings),
			scanConcurrency: SCAN_CONCURRENCY,
			debounceMs: 100,
		};
	}

	async start(): Promise<void> {
		this.indexingCompleteSubject.next(false);
		await this.genericIndexer.start();

		// CRITICAL: Freeze the handler list before awaiting to prevent race conditions
		// Events arriving during Promise.all would otherwise be pushed but not awaited
		const handlers = this.initialScanHandlers;
		this.initialScanHandlers = null;

		// Wait for all async event handlers from initial scan to complete
		// The generic indexer has emitted all scan events synchronously during start()
		if (handlers && handlers.length > 0) {
			await Promise.all(handlers);
		}

		this.indexingCompleteSubject.next(true);
	}

	stop(): void {
		this.genericIndexer.stop();
		this.subs.unsubscribe();
		this.scanEventsSubject.complete();
		this.indexingCompleteSubject.complete();
	}

	resync(): void {
		this.indexingCompleteSubject.next(false);
		this.handlerCollector = [];

		// Subscribe to generic indexer's completion to know when scan finishes,
		// then await collected handlers before emitting our own completion
		const sub = this.genericIndexer.indexingComplete$
			.pipe(
				filter((complete) => complete),
				take(1)
			)
			.subscribe(() => {
				const handlers = this.handlerCollector;
				this.handlerCollector = null;

				const finalize = async () => {
					if (handlers && handlers.length > 0) {
						await Promise.all(handlers);
					}
					this.indexingCompleteSubject.next(true);
				};

				void finalize();
				sub.unsubscribe();
			});

		this.genericIndexer.resync();
	}

	/**
	 * Wait for the metadata cache to emit a 'changed' event for this specific file,
	 * then return the fresh frontmatter. Used when vault events arrive before the
	 * metadata cache has finished async re-parsing.
	 *
	 * Times out after `timeoutMs` and returns the stale frontmatter as fallback.
	 */
	private awaitFreshFrontmatter(file: TFile, stale: Frontmatter, timeoutMs = 500): Promise<Frontmatter> {
		return new Promise((resolve) => {
			const ref = this.app.metadataCache.on("changed", (changedFile) => {
				if (changedFile.path !== file.path) return;
				this.app.metadataCache.offref(ref);
				clearTimeout(timer);
				const cache = this.app.metadataCache.getFileCache(file);
				resolve(cache?.frontmatter ? { ...cache.frontmatter } : stale);
			});
			const timer = setTimeout(() => {
				this.app.metadataCache.offref(ref);
				resolve(stale);
			}, timeoutMs);
		});
	}

	/**
	 * Check whether the frontmatter has at least one of the required calendar properties
	 * (startProp or dateProp) with a non-null value. Frontmatter that's missing both is
	 * likely stale — the metadata cache hasn't caught up to the file on disk yet.
	 */
	private hasCoreProps(fm: Frontmatter): boolean {
		return fm[this.settings.startProp] != null || fm[this.settings.dateProp] != null;
	}

	private async handleGenericEvent(genericEvent: GenericIndexerEvent): Promise<void> {
		if (genericEvent.type === "file-deleted") {
			this.scanEventsSubject.next({
				type: "file-deleted",
				filePath: genericEvent.filePath,
				oldFrontmatter: genericEvent.oldFrontmatter,
				isRename: genericEvent.isRename,
			});
			return;
		}

		if (genericEvent.type === "file-changed" && genericEvent.source) {
			const { filePath, source, oldPath, oldFrontmatter, frontmatterDiff } = genericEvent;

			// Suppress events caused by our own processFrontMatter writebacks
			if (this.inFlightWrites.has(filePath)) return;

			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return;

			// Clone immediately — source.frontmatter may be a reference owned by the generic indexer
			let frontmatter = { ...(source.frontmatter as Frontmatter) };

			// The generic indexer listens to vault events, which fire BEFORE the metadata
			// cache finishes async re-parsing. If the frontmatter looks incomplete (missing
			// both startProp and dateProp), wait for the metadataCache 'changed' event
			// to get fresh data. This handles external modifications (git sync, other plugins)
			// where the debounce alone isn't enough.
			if (!this.hasCoreProps(frontmatter)) {
				frontmatter = await this.awaitFreshFrontmatter(file, frontmatter);
			}

			const events = await this.buildCalendarEvents(file, frontmatter, oldPath, oldFrontmatter, frontmatterDiff);
			for (const event of events) {
				this.scanEventsSubject.next(event);
			}
		}
	}

	private async buildCalendarEvents(
		file: TFile,
		frontmatter: Frontmatter,
		oldPath?: string,
		oldFrontmatter?: Frontmatter,
		frontmatterDiff?: FrontmatterDiff
	): Promise<IndexerEvent[]> {
		const events: IndexerEvent[] = [];

		const eventBase = {
			filePath: file.path,
			oldPath,
			oldFrontmatter,
			frontmatterDiff,
		};

		const recurring = await this.tryParseRecurring(file, frontmatter);
		if (recurring) {
			// Always add recurring events even if skipped - this allows navigation
			// to source from physical instances and viewing recurring event lists.
			// The RecurringEventManager will check skip property and not generate new instances.
			events.push({
				...eventBase,
				type: "recurring-event-found",
				recurringEvent: recurring,
			});

			// CRITICAL: Update frontmatter object with rRuleId from the recurring event
			// tryParseRecurring returns a NodeRecurringEvent with the rRuleId (either existing or newly generated)
			// We update the frontmatter object directly to ensure file-changed events have the correct data
			if (!frontmatter[this.settings.rruleIdProp]) {
				frontmatter = {
					...frontmatter,
					[this.settings.rruleIdProp]: recurring.rRuleId,
				};
			}
		}

		// Always emit file-changed events for files with start property OR date property OR neither (untracked)
		// Let EventStore/Parser handle filtering - this ensures cached events
		// get invalidated when properties change and no longer pass filters
		// This allows recurring source files to ALSO appear as regular events on the calendar
		const hasTimedEvent = frontmatter[this.settings.startProp];
		const hasAllDayEvent = frontmatter[this.settings.dateProp];
		const hasDateOrTime = hasTimedEvent || hasAllDayEvent;
		const isUntracked = !hasDateOrTime;

		if (hasDateOrTime || isUntracked) {
			if (this.settings.markPastInstancesAsDone && hasDateOrTime) {
				void this.markPastEventAsDone(file, frontmatter).catch((error) => {
					console.error(`Error in background marking of past event ${file.path}:`, error);
				});
			}

			void this.updateCalendarTitleProperty(file, frontmatter).catch((error) => {
				console.error(`Error updating calendar title for ${file.path}:`, error);
			});

			const allDayProp = frontmatter[this.settings.allDayProp];
			const isAllDay = allDayProp === true || allDayProp === "true";

			const source: RawEventSource = {
				filePath: file.path,
				mtime: file.stat.mtime,
				frontmatter,
				folder: file.parent?.path || "",
				isAllDay,
				isUntracked,
			};

			// Emit separate event types for tracked vs untracked
			events.push({
				...eventBase,
				type: isUntracked ? "untracked-file-changed" : "file-changed",
				source,
			});
		}

		return events;
	}

	private async tryParseRecurring(file: TFile, frontmatter: Frontmatter): Promise<NodeRecurringEvent | null> {
		const rrules = parseRRuleFromFrontmatter(frontmatter, this.settings);
		if (!rrules) return null;

		let rRuleId = toSafeString(frontmatter[this.settings.rruleIdProp]);
		const frontmatterCopy = { ...frontmatter };

		if (!rRuleId) {
			// The rruleId might already exist on disk but the metadata cache could be stale.
			// Wait for a fresh cache read before deciding to generate a new ID.
			const freshFm = await this.awaitFreshFrontmatter(file, frontmatter, 200);
			const cachedId = toSafeString(freshFm[this.settings.rruleIdProp]);

			if (cachedId) {
				rRuleId = cachedId;
			} else {
				rRuleId = generateUniqueRruleId();
				await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
					fm[this.settings.rruleIdProp] = rRuleId;
				});
			}
		}

		frontmatterCopy[this.settings.rruleIdProp] = rRuleId;

		// Defer content reading - we'll read it lazily when needed
		// This avoids blocking I/O during the initial scan
		return {
			sourceFilePath: file.path,
			title: file.basename,
			rRuleId,
			rrules,
			frontmatter: frontmatterCopy,
			content: undefined, // Empty initially - will be loaded on-demand by RecurringEventManager
		};
	}

	private async updateCalendarTitleProperty(file: TFile, frontmatter: Frontmatter): Promise<void> {
		if (this.syncStore?.data.readOnly) return;

		const { calendarTitleProp } = this.settings;
		if (!calendarTitleProp) return;

		const pathWithoutExt = removeMarkdownExtension(file.path);
		const displayName = cleanupTitle(file.basename);
		const titleLink = `[[${pathWithoutExt}|${displayName}]]`;

		const currentTitle = frontmatter[calendarTitleProp];
		if (currentTitle === titleLink) return;

		await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
			fm[calendarTitleProp] = titleLink;
		});
	}

	private async markPastEventAsDone(file: TFile, frontmatter: Frontmatter): Promise<void> {
		if (this.syncStore?.data.readOnly) {
			return;
		}

		// CRITICAL PROTECTION: Don't mark source recurring events as done
		// Source recurring events (identified by the presence of rruleProp) are templates
		// that generate virtual and physical instances. Marking them as done would:
		// 1. Break the recurring event system
		// 2. Prevent generation of future instances
		// 3. Cause all instances to appear as "done" since they inherit from the source
		const isSourceRecurringEvent = !!frontmatter[this.settings.rruleProp];
		if (isSourceRecurringEvent) {
			return;
		}

		const now = new Date();
		let isPastEvent = false;

		const allDayValue = frontmatter[this.settings.allDayProp];
		const isAllDay = allDayValue === true || allDayValue === "true";

		if (isAllDay) {
			const rawDate = frontmatter[this.settings.dateProp];
			const date = intoDate(rawDate);
			if (date) {
				date.setHours(23, 59, 59, 999);
				isPastEvent = date < now;
			}
		} else {
			const endValue = frontmatter[this.settings.endProp];
			const endDate = intoDate(endValue);
			if (endDate) {
				isPastEvent = endDate < now;
			}
		}

		if (isPastEvent) {
			const currentStatus = frontmatter[this.settings.statusProperty];
			const doneValue = this.settings.doneValue;

			if (currentStatus !== doneValue) {
				try {
					await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
						fm[this.settings.statusProperty] = doneValue;
					});
				} catch (error) {
					console.error(`Error marking event as done in file ${file.path}:`, error);
				}
			}
		}
	}
}
