import type { SyncStore } from "@real1ty-obsidian-plugins";
import {
	areSetsEqual,
	type FrontmatterDiff,
	Indexer as GenericIndexer,
	type IndexerConfig,
	type IndexerEvent as GenericIndexerEvent,
	intoDate,
	isFolderNote,
	PENDING_WRITE_SENTINEL_FM_KEY,
	removeMarkdownExtension,
	toSafeString,
} from "@real1ty-obsidian-plugins";
import { type App, TFile } from "obsidian";
import { BehaviorSubject, type Observable, Subject, Subscription } from "rxjs";
import { filter, take } from "rxjs/operators";

import { SCAN_CONCURRENCY } from "../constants";
import { type EventMetadata, parseEventMetadata } from "../types/event";
import type { Frontmatter, PrismaSyncDataSchema, SingleCalendarConfig } from "../types/index";
import { type NodeRecurringEvent, parseRRuleFromFrontmatter } from "../types/recurring-event";
import { getExcludedProps } from "../utils/event-frontmatter";
import { cleanupTitle, ensureFileHasZettelId, generateUniqueRruleId, hasTimestamp } from "../utils/event-naming";

export interface RawEventSource {
	filePath: string;
	mtime: number;
	frontmatter: Frontmatter;
	folder: string;
	isAllDay: boolean;
	isUntracked: boolean;
	metadata: EventMetadata;
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
	/** Per-file queue to serialize processFrontMatter calls */
	private fmLocks = new Map<string, Promise<void>>();
	/** Tracks files currently being renamed for ZettelID to prevent re-entrant triggers */
	private zettelIdRenamesInFlight = new Set<string>();
	private readonly includeFile = (filePath: string): boolean => {
		const directory = this.settings.directory;
		if (!directory) return false;
		return filePath === directory || filePath.startsWith(`${directory}/`);
	};

	public readonly events$: Observable<IndexerEvent>;
	public readonly indexingComplete$: Observable<boolean>;

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private syncStore: SyncStore<typeof PrismaSyncDataSchema> | null
	) {
		this.settings = settingsStore.value;
		this.lastDirectory = this.settings.directory;
		this.lastExcludedDiffProps = getExcludedProps(this.settings, this.settings.excludedRecurringInstanceProps);

		const configStore = new BehaviorSubject<IndexerConfig>(this.buildIndexerConfig());
		this.genericIndexer = new GenericIndexer(app, configStore);

		// CRITICAL: Catch async handler errors to prevent unhandled promise rejections
		// during live events (after initial scan completes)
		this.subs.add(
			this.genericIndexer.events$.subscribe((genericEvent) => {
				const handler = this.handleGenericEvent(genericEvent).catch((error) => {
					console.error("[Indexer] handleGenericEvent error:", error);
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
				const nextExcludedDiffProps = getExcludedProps(newSettings, newSettings.excludedRecurringInstanceProps);
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
		// then await collected handlers before emitting our own completion.
		// take(1) auto-unsubscribes after the first emission.
		this.genericIndexer.indexingComplete$
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
			});

		this.genericIndexer.resync();
	}

	// ─── Event Processing ─────────────────────────────────────────

	private async handleGenericEvent(genericEvent: GenericIndexerEvent): Promise<void> {
		if (genericEvent.type === "file-deleted") {
			this.scanEventsSubject.next({
				type: "file-deleted",
				filePath: genericEvent.filePath,
				...(genericEvent.oldFrontmatter ? { oldFrontmatter: genericEvent.oldFrontmatter } : {}),
				...(genericEvent.isRename !== undefined ? { isRename: genericEvent.isRename } : {}),
			});
			return;
		}

		if (genericEvent.type === "file-changed" && genericEvent.source) {
			const { filePath, source, oldPath, oldFrontmatter, frontmatterDiff } = genericEvent;

			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return;

			// Skip files mid-write (sentinel frontmatter set by TemplaterService.createFileAtomic).
			// Uses source.frontmatter (already from metadataCache) — zero extra I/O.
			if (source.frontmatter[PENDING_WRITE_SENTINEL_FM_KEY]) return;

			// Clone immediately — source.frontmatter may be a reference owned by the generic indexer
			const frontmatter = { ...(source.frontmatter as Frontmatter) };

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
			...(oldPath ? { oldPath } : {}),
			...(oldFrontmatter ? { oldFrontmatter } : {}),
			...(frontmatterDiff ? { frontmatterDiff } : {}),
		};

		const recurring = await this.tryParseRecurring(file, frontmatter, oldFrontmatter);
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
			// Auto-assign ZettelID: fire-and-forget. The rename triggers a new indexer
			// event cycle with the updated path, so we don't need to await or update state here.
			void this.autoAssignZettelId(file, isUntracked).catch((error) => {
				console.error(`[Indexer] Error auto-assigning ZettelID for ${file.path}:`, error);
			});

			if (this.settings.markPastInstancesAsDone && hasDateOrTime) {
				void this.markPastEventAsDone(file, frontmatter).catch((error) => {
					console.error(`[Indexer] Error in background marking of past event ${file.path}:`, error);
				});
			}

			void this.updateCalendarTitleProperty(file, frontmatter).catch((error) => {
				console.error(`[Indexer] Error updating calendar title for ${file.path}:`, error);
			});

			const allDayProp = frontmatter[this.settings.allDayProp];
			const isAllDay = allDayProp === true || allDayProp === "true";
			const metadata = parseEventMetadata(frontmatter, this.settings);

			const source: RawEventSource = {
				filePath: file.path,
				mtime: file.stat.mtime,
				frontmatter,
				folder: file.parent?.path || "",
				isAllDay,
				isUntracked,
				metadata,
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

	private async tryParseRecurring(
		file: TFile,
		frontmatter: Frontmatter,
		oldFrontmatter?: Frontmatter
	): Promise<NodeRecurringEvent | null> {
		const rrules = parseRRuleFromFrontmatter(frontmatter, this.settings);
		if (!rrules) return null;

		let rRuleId = toSafeString(frontmatter[this.settings.rruleIdProp]);
		const frontmatterCopy = { ...frontmatter };
		const previousRRuleId = toSafeString(oldFrontmatter?.[this.settings.rruleIdProp]);

		// Guard against accidental ID churn: recurring source rRuleId is immutable once set.
		// If a file suddenly reports a different id, keep the previous one and revert the file.
		if (rRuleId && previousRRuleId && rRuleId !== previousRRuleId) {
			rRuleId = previousRRuleId;
			if (!this.syncStore?.data.readOnly) {
				await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
					fm[this.settings.rruleIdProp] = rRuleId;
				});
			}
		}

		if (!rRuleId) {
			// vault.on("modify") fires BEFORE the metadata cache updates, so the rRuleId
			// might already exist on disk but not be in the cache yet. Wait for the
			// cache to catch up before deciding to generate a new ID — prevents duplicates.
			await new Promise((resolve) => setTimeout(resolve, 200));
			const freshCache = this.app.metadataCache.getFileCache(file);
			const cachedId = toSafeString(freshCache?.frontmatter?.[this.settings.rruleIdProp]);

			if (cachedId) {
				rRuleId = cachedId;
			} else if (this.syncStore?.data.readOnly) {
				// In readOnly mode we can't write an rRuleId — skip this recurring event entirely.
				// Without a stable ID, instances can't be deduplicated across reloads.
				return null;
			} else {
				rRuleId = generateUniqueRruleId();
				await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
					fm[this.settings.rruleIdProp] = rRuleId;
				});
			}
		}

		frontmatterCopy[this.settings.rruleIdProp] = rRuleId;

		const metadata = parseEventMetadata(frontmatterCopy, this.settings);

		// Defer content reading - we'll read it lazily when needed
		// This avoids blocking I/O during the initial scan
		return {
			sourceFilePath: file.path,
			title: file.basename,
			rRuleId,
			rrules,
			frontmatter: frontmatterCopy,
			metadata,
			content: undefined, // Empty initially - will be loaded on-demand by RecurringEventManager
		};
	}

	// ─── Background File Updates ──────────────────────────────────

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

	/**
	 * Auto-assigns a ZettelID to a file if the setting is enabled and the file doesn't have one.
	 * Uses a Set to track in-flight renames and prevent re-entrant triggers from the rename event.
	 * @param isUntracked - true if the file has no date/time properties (untracked event)
	 */
	private async autoAssignZettelId(file: TFile, isUntracked: boolean): Promise<void> {
		const mode = this.settings.autoAssignZettelId;
		if (mode === "disabled") return;
		if (mode === "calendarEvents" && isUntracked) return;
		if (this.syncStore?.data.readOnly) return;
		if (hasTimestamp(file.basename)) return;
		if (isFolderNote(file.path)) return;

		// Prevent re-entrant renames: if we're already renaming this file (by original path),
		// skip. Also check the current path in case the event arrives after rename started.
		if (this.zettelIdRenamesInFlight.has(file.path)) return;

		this.zettelIdRenamesInFlight.add(file.path);
		try {
			await ensureFileHasZettelId(this.app, file, this.settings.zettelIdProp);
		} catch (error) {
			console.error(`[Indexer] Error auto-assigning ZettelID to ${file.path}:`, error);
		} finally {
			this.zettelIdRenamesInFlight.delete(file.path);
		}
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
			if (currentStatus !== this.settings.doneValue) {
				await this.markFileAsDone(file.path);
			}
		}
	}

	async markFileAsDone(filePath: string): Promise<void> {
		if (this.syncStore?.data.readOnly) {
			return;
		}

		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;

		try {
			await this.enqueueFrontmatterWrite(file, (fm: Frontmatter) => {
				fm[this.settings.statusProperty] = this.settings.doneValue;
			});
		} catch (error) {
			console.error(`[Indexer] Error marking event as done in file ${filePath}:`, error);
		}
	}

	// ─── Utilities ────────────────────────────────────────────────

	private buildIndexerConfig(): IndexerConfig {
		return {
			includeFile: this.includeFile,
			excludedDiffProps: getExcludedProps(this.settings, this.settings.excludedRecurringInstanceProps),
			scanConcurrency: SCAN_CONCURRENCY,
			debounceMs: 100,
		};
	}

	/**
	 * Serialize processFrontMatter calls per file to prevent interleaving writes
	 * and suppress the resulting file-changed events from our own writebacks.
	 */
	private enqueueFrontmatterWrite(file: TFile, fn: (fm: Frontmatter) => void): Promise<void> {
		const path = file.path;
		const prev = this.fmLocks.get(path) ?? Promise.resolve();
		const next = prev
			.then(() => this.app.fileManager.processFrontMatter(file, fn))
			.finally(() => {
				if (this.fmLocks.get(path) === next) this.fmLocks.delete(path);
			});
		this.fmLocks.set(path, next);
		return next;
	}
}
