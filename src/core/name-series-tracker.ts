import {
	type FrontmatterDiff,
	FrontmatterPropagationModal,
	FrontmatterPropagationDebouncer,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { CalendarEvent } from "../types/calendar";
import type { Frontmatter, SingleCalendarConfig } from "../types/index";
import {
	applyFrontmatterChangesToInstance,
	filterExcludedPropsFromDiff,
	getEventName,
	getRecurringInstanceExcludedProps,
} from "../utils/calendar-events";
import type { EventStore } from "./event-store";
import type { Indexer, IndexerEvent } from "./indexer";

/**
 * Tracks name-based event series and handles frontmatter propagation
 * for name series only.
 *
 * Name-based grouping: Events sharing the same cleaned/lowercased title.
 */
export class NameSeriesTracker {
	/** Cleaned lowercase title -> file paths */
	private seriesByName = new Map<string, Set<string>>();
	/** Reverse lookup: file path -> name key */
	private fileToNameKey = new Map<string, string>();

	private subscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private _settings: SingleCalendarConfig;

	/** File paths currently being propagated to — prevents infinite loops */
	private propagatingFilePaths = new Set<string>();

	private propagationDebouncer: FrontmatterPropagationDebouncer<{
		sourceFrontmatter: Frontmatter;
		filePath: string;
		nameKey: string;
	}>;

	constructor(
		private app: App,
		private indexer: Indexer,
		private eventStore: EventStore,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this._settings = settingsStore.value;
		this.propagationDebouncer = new FrontmatterPropagationDebouncer({
			debounceMs: this._settings.propagationDebounceMs,
			filterDiff: (diff) =>
				filterExcludedPropsFromDiff(diff, this._settings, getRecurringInstanceExcludedProps(this._settings)),
		});

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const wasEnabled = this._settings.enableNameSeriesTracking;
			this._settings = newSettings;

			if (wasEnabled && !newSettings.enableNameSeriesTracking) {
				this.seriesByName.clear();
				this.fileToNameKey.clear();
			} else if (!wasEnabled && newSettings.enableNameSeriesTracking) {
				this.rebuild();
			}
		});

		this.subscription = this.indexer.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		this.indexingCompleteSubscription = this.indexer.indexingComplete$.subscribe((isComplete) => {
			if (isComplete) {
				this.rebuild();
			}
		});
	}

	private handleIndexerEvent(event: IndexerEvent): void {
		if (!this._settings.enableNameSeriesTracking) return;

		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.updateFile(event.filePath, event.source.frontmatter);

					// Handle name series propagation if there's a frontmatter diff
					if (event.frontmatterDiff?.hasChanges && !this.propagatingFilePaths.has(event.filePath)) {
						this.handleNamePropagation(event.filePath, event.source.frontmatter, event.frontmatterDiff);
					}
				}
				break;
			case "file-deleted":
				this.removeFile(event.filePath);
				break;
		}
	}

	private handleNamePropagation(filePath: string, sourceFrontmatter: Frontmatter, diff: FrontmatterDiff): void {
		const enabled = this._settings.propagateFrontmatterToNameSeries || this._settings.askBeforePropagatingToNameSeries;
		if (!enabled) return;

		const nameKey = this.fileToNameKey.get(filePath);
		if (!nameKey) return;

		const nameFiles = this.seriesByName.get(nameKey);
		if (!nameFiles || nameFiles.size < 2) return;

		const debounceKey = `name:${nameKey}`;
		const context = { sourceFrontmatter, filePath, nameKey };

		this.propagationDebouncer.schedule(debounceKey, diff, context, (filteredDiff, ctx) => {
			const filePaths = this.seriesByName.get(ctx.nameKey);
			if (!filePaths) return;
			const targetFilePaths = Array.from(filePaths).filter((fp) => fp !== ctx.filePath);
			if (targetFilePaths.length === 0) return;

			if (this._settings.propagateFrontmatterToNameSeries) {
				void this.propagateToSeriesMembers(ctx.sourceFrontmatter, filteredDiff, targetFilePaths);
			} else if (this._settings.askBeforePropagatingToNameSeries) {
				new FrontmatterPropagationModal(this.app, {
					eventTitle: `Name series: ${ctx.nameKey}`,
					diff: filteredDiff,
					instanceCount: targetFilePaths.length,
					onConfirm: () => this.propagateToSeriesMembers(ctx.sourceFrontmatter, filteredDiff, targetFilePaths),
				}).open();
			}
		});
	}

	private async propagateToSeriesMembers(
		sourceFrontmatter: Frontmatter,
		diff: FrontmatterDiff,
		targetFilePaths: string[]
	): Promise<void> {
		// Add all targets to loop prevention set
		for (const fp of targetFilePaths) {
			this.propagatingFilePaths.add(fp);
		}

		const excludedProps = getRecurringInstanceExcludedProps(this._settings);

		try {
			await Promise.all(
				targetFilePaths.map((fp) =>
					applyFrontmatterChangesToInstance(this.app, fp, sourceFrontmatter, diff, excludedProps)
				)
			);
		} finally {
			// Remove targets from loop prevention after a delay to account for indexer processing
			setTimeout(() => {
				for (const fp of targetFilePaths) {
					this.propagatingFilePaths.delete(fp);
				}
			}, 2000);
		}
	}

	private updateFile(filePath: string, frontmatter: Record<string, unknown>): void {
		this.removeFile(filePath);

		const title = getEventName(this._settings.titleProp, frontmatter, filePath, this._settings.calendarTitleProp);
		if (title) {
			const nameKey = title.toLowerCase();
			if (nameKey) {
				this.fileToNameKey.set(filePath, nameKey);
				let set = this.seriesByName.get(nameKey);
				if (!set) {
					set = new Set();
					this.seriesByName.set(nameKey, set);
				}
				set.add(filePath);
			}
		}
	}

	private removeFile(filePath: string): void {
		const nameKey = this.fileToNameKey.get(filePath);
		if (nameKey) {
			const set = this.seriesByName.get(nameKey);
			if (set) {
				set.delete(filePath);
				if (set.size === 0) this.seriesByName.delete(nameKey);
			}
			this.fileToNameKey.delete(filePath);
		}
	}

	private rebuild(): void {
		this.seriesByName.clear();
		this.fileToNameKey.clear();

		if (!this._settings.enableNameSeriesTracking) return;

		const allEvents = this.eventStore.getAllEvents();
		for (const event of allEvents) {
			this.updateFile(event.ref.filePath, event.meta);
		}
	}

	/** Returns all known name keys (lowercase event titles) tracked by the name series */
	getAllNameKeys(): string[] {
		return Array.from(this.seriesByName.keys());
	}

	/** Returns name-based series that contain 2+ events (single events aren't a "series") */
	getNameBasedSeries(): Map<string, Set<string>> {
		return new Map(Array.from(this.seriesByName).filter(([_name, files]) => files.size >= 2));
	}

	/** Returns CalendarEvents in the name-based series for a given cleaned name key */
	getEventsInNameSeries(nameKey: string): CalendarEvent[] {
		const filePaths = this.seriesByName.get(nameKey);
		if (!filePaths) return [];
		const events: CalendarEvent[] = [];
		for (const fp of filePaths) {
			const event = this.eventStore.getEventByPath(fp);
			if (event) events.push(event);
		}
		return events;
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.propagationDebouncer.destroy();
		this.propagatingFilePaths.clear();
	}
}
