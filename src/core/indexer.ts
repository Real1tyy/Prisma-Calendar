import {
	type FrontmatterDiff,
	Indexer as GenericIndexer,
	type IndexerEvent as GenericIndexerEvent,
	type IndexerConfig,
} from "@real1ty-obsidian-plugins/utils";
import { type App, TFile } from "obsidian";
import { BehaviorSubject, type Observable, Subject, type Subscription } from "rxjs";
import { SCAN_CONCURRENCY } from "../constants";
import type { Frontmatter, SingleCalendarConfig } from "../types/index";
import { type NodeRecurringEvent, parseRRuleFromFrontmatter } from "../types/recurring-event";
import { generateUniqueRruleId, getRecurringInstanceExcludedProps } from "../utils/calendar-events";
import { intoDate } from "../utils/format";
import { areSetsEqual } from "../utils/list-utils";
import { getFrontmatterWithRetry } from "../utils/obsidian";

export interface RawEventSource {
	filePath: string;
	mtime: number;
	frontmatter: Frontmatter;
	folder: string;
	isAllDay: boolean;
}

type IndexerEventType = "file-changed" | "file-deleted" | "recurring-event-found";

export interface IndexerEvent {
	type: IndexerEventType;
	filePath: string;
	oldPath?: string;
	source?: RawEventSource;
	recurringEvent?: NodeRecurringEvent;
	oldFrontmatter?: Frontmatter;
	frontmatterDiff?: FrontmatterDiff;
}

/**
 * Wrapper around the generic Indexer from utils that adds calendar-specific functionality.
 * Listens to generic indexer events and enhances them with recurring event tracking.
 */
export class Indexer {
	private settings: SingleCalendarConfig;
	private genericIndexer: GenericIndexer;
	private settingsSubscription: Subscription | null = null;
	private scanEventsSubject = new Subject<IndexerEvent>();
	private lastDirectory: string;
	private lastExcludedDiffProps: Set<string>;
	private readonly includeFile = (filePath: string): boolean => {
		const directory = this.settings.directory;
		if (!directory) return true;
		return filePath === directory || filePath.startsWith(`${directory}/`);
	};

	public readonly events$: Observable<IndexerEvent>;
	public readonly indexingComplete$: Observable<boolean>;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this.settings = settingsStore.value;
		this.lastDirectory = this.settings.directory;
		this.lastExcludedDiffProps = getRecurringInstanceExcludedProps(this.settings);

		const configStore = new BehaviorSubject<IndexerConfig>(this.buildIndexerConfig());
		this.genericIndexer = new GenericIndexer(app, configStore);

		this.genericIndexer.events$.subscribe((genericEvent) => {
			void this.handleGenericEvent(genericEvent);
		});

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
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
				void this.genericIndexer.resync();
			}
		});

		this.events$ = this.scanEventsSubject.asObservable();
		this.indexingComplete$ = this.genericIndexer.indexingComplete$;
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
		await this.genericIndexer.start();
	}

	stop(): void {
		this.genericIndexer.stop();
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
	}

	resync(): void {
		void this.genericIndexer.resync();
	}

	private async handleGenericEvent(genericEvent: GenericIndexerEvent): Promise<void> {
		if (genericEvent.type === "file-deleted") {
			this.scanEventsSubject.next({
				type: "file-deleted",
				filePath: genericEvent.filePath,
				oldFrontmatter: genericEvent.oldFrontmatter,
			});
			return;
		}

		if (genericEvent.type === "file-changed" && genericEvent.source) {
			const { filePath, source, oldPath, oldFrontmatter, frontmatterDiff } = genericEvent;
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) return;
			const frontmatter = await getFrontmatterWithRetry(this.app, file, source.frontmatter);
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
				frontmatter = { ...frontmatter, [this.settings.rruleIdProp]: recurring.rRuleId };
			}
		}

		// Always emit file-changed events for files with start property OR date property
		// Let EventStore/Parser handle filtering - this ensures cached events
		// get invalidated when properties change and no longer pass filters
		// This allows recurring source files to ALSO appear as regular events on the calendar
		const hasTimedEvent = frontmatter[this.settings.startProp];
		const hasAllDayEvent = frontmatter[this.settings.dateProp];

		if (hasTimedEvent || hasAllDayEvent) {
			if (this.settings.markPastInstancesAsDone) {
				void this.markPastEventAsDone(file, frontmatter).catch((error) => {
					console.error(`Error in background marking of past event ${file.path}:`, error);
				});
			}

			const allDayProp = frontmatter[this.settings.allDayProp];
			const isAllDay = allDayProp === true || allDayProp === "true" || !!hasAllDayEvent;

			const source: RawEventSource = {
				filePath: file.path,
				mtime: file.stat.mtime,
				frontmatter,
				folder: file.parent?.path || "",
				isAllDay,
			};

			events.push({
				...eventBase,
				type: "file-changed",
				source,
			});
		}

		return events;
	}

	private async tryParseRecurring(file: TFile, frontmatter: Frontmatter): Promise<NodeRecurringEvent | null> {
		const rrules = parseRRuleFromFrontmatter(frontmatter, this.settings);
		if (!rrules) return null;

		let rRuleId: string = frontmatter[this.settings.rruleIdProp] as string;
		const frontmatterCopy = { ...frontmatter };

		if (!rRuleId) {
			rRuleId = generateUniqueRruleId();
			await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
				fm[this.settings.rruleIdProp] = rRuleId;
			});
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

	private async markPastEventAsDone(file: TFile, frontmatter: Frontmatter): Promise<void> {
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

		// Check if event is in the past
		const allDayValue = frontmatter[this.settings.allDayProp];
		const isAllDay = allDayValue === true || allDayValue === "true";

		if (isAllDay) {
			// For all-day events, check the date property
			const rawDate = frontmatter[this.settings.dateProp];
			const date = intoDate(rawDate);
			if (date) {
				// Set to end of day for comparison
				date.setHours(23, 59, 59, 999);
				isPastEvent = date < now;
			}
		} else {
			// For timed events, check the end date
			const endValue = frontmatter[this.settings.endProp];
			const endDate = intoDate(endValue);
			if (endDate) {
				isPastEvent = endDate < now;
			}
		}

		// If event is in the past, mark it as done
		if (isPastEvent) {
			const currentStatus = frontmatter[this.settings.statusProperty];
			const doneValue = this.settings.doneValue;

			// Only update if status is not already the done value
			if (currentStatus !== doneValue) {
				try {
					await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
						fm[this.settings.statusProperty] = doneValue;
					});
				} catch (error) {
					console.error(`Error marking event as done in file ${file.path}:`, error);
				}
			}
		}
	}
}
