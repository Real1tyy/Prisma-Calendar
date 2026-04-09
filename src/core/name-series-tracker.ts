import {
	type FrontmatterDiff,
	FrontmatterPropagationDebouncer,
	showFrontmatterPropagationModal,
} from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { filter } from "rxjs/operators";

import { PROPAGATION_DEBOUNCE_MS } from "../constants";
import type { CalendarEvent } from "../types/calendar";
import type { CalendarEventSource, IndexerEvent } from "../types/event-source";
import type { Frontmatter, SingleCalendarConfig } from "../types/index";
import {
	applyFrontmatterChangesToInstance,
	filterExcludedPropsFromDiff,
	getExcludedProps,
} from "../utils/event-frontmatter";
import { getEventName } from "../utils/event-naming";
import { batchedPromiseAll } from "../utils/obsidian";
import type { EventStore } from "./event-store";

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
	private settings: SingleCalendarConfig;

	/** File paths currently being propagated to — prevents infinite loops */
	private propagatingFilePaths = new Set<string>();

	private propagationDebouncer: FrontmatterPropagationDebouncer<{
		sourceFrontmatter: Frontmatter;
		filePath: string;
		nameKey: string;
	}>;

	// ─── Lifecycle ───────────────────────────────────────────────

	constructor(
		private app: App,
		private eventSource: CalendarEventSource,
		private eventStore: EventStore,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this.settings = settingsStore.value;
		this.propagationDebouncer = new FrontmatterPropagationDebouncer({
			debounceMs: PROPAGATION_DEBOUNCE_MS,
			filterDiff: (diff) =>
				filterExcludedPropsFromDiff(diff, getExcludedProps(this.settings, this.settings.excludedNameSeriesProps)),
		});

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			const wasEnabled = this.settings.enableNameSeriesTracking;
			this.settings = newSettings;

			if (wasEnabled && !newSettings.enableNameSeriesTracking) {
				this.seriesByName.clear();
				this.fileToNameKey.clear();
			} else if (!wasEnabled && newSettings.enableNameSeriesTracking) {
				this.rebuild();
			}
		});

		this.subscription = this.eventSource.events$
			.pipe(filter((event: IndexerEvent) => event.type === "file-changed" || event.type === "file-deleted"))
			.subscribe((event: IndexerEvent) => {
				this.handleIndexerEvent(event);
			});

		this.indexingCompleteSubscription = this.eventSource.indexingComplete$.subscribe((isComplete) => {
			if (isComplete) {
				this.rebuild();
			}
		});
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

	// ─── Indexer Event Handling ────────────────────────────────────

	private handleIndexerEvent(event: IndexerEvent): void {
		if (!this.settings.enableNameSeriesTracking) return;

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

	// ─── Name Propagation ─────────────────────────────────────────

	private handleNamePropagation(filePath: string, sourceFrontmatter: Frontmatter, diff: FrontmatterDiff): void {
		const enabled = this.settings.propagateFrontmatterToNameSeries || this.settings.askBeforePropagatingToNameSeries;
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

			if (this.settings.propagateFrontmatterToNameSeries) {
				void this.propagateToSeriesMembers(ctx.sourceFrontmatter, filteredDiff, targetFilePaths);
			} else if (this.settings.askBeforePropagatingToNameSeries) {
				showFrontmatterPropagationModal(this.app, {
					eventTitle: `Name series: ${ctx.nameKey}`,
					diff: filteredDiff,
					instanceCount: targetFilePaths.length,
					onConfirm: () => this.propagateToSeriesMembers(ctx.sourceFrontmatter, filteredDiff, targetFilePaths),
				});
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

		const excludedProps = getExcludedProps(this.settings, this.settings.excludedNameSeriesProps);

		try {
			await batchedPromiseAll(
				targetFilePaths,
				(fp) => applyFrontmatterChangesToInstance(this.app, fp, sourceFrontmatter, diff, excludedProps),
				this.settings.fileConcurrencyLimit
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

	// ─── File Management ──────────────────────────────────────────

	private updateFile(filePath: string, frontmatter: Record<string, unknown>): void {
		this.removeFile(filePath);

		const title = getEventName(this.settings.titleProp, frontmatter, filePath, this.settings.calendarTitleProp);
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

		if (!this.settings.enableNameSeriesTracking) return;

		const allEvents = this.eventStore.getAllEvents();
		for (const event of allEvents) {
			this.updateFile(event.ref.filePath, event.meta);
		}
	}

	// ─── Public Query API ─────────────────────────────────────────

	/** Returns the internal name-series map as a read-only view (no copy) */
	getNameSeriesMap(): ReadonlyMap<string, ReadonlySet<string>> {
		return this.seriesByName;
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
}
