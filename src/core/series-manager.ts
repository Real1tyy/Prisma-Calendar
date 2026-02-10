import { parseIntoList } from "@real1ty-obsidian-plugins";
import type { BehaviorSubject, Subscription } from "rxjs";
import { filter } from "rxjs/operators";
import type { CalendarEvent } from "../types/calendar";
import type { SingleCalendarConfig } from "../types/index";
import { getEventName } from "../utils/calendar-events";
import type { EventStore } from "./event-store";
import type { Indexer, IndexerEvent } from "./indexer";

/**
 * Tracks event series across the calendar using two grouping strategies:
 * 1. Name-based: Events sharing the same cleaned/lowercased title
 * 2. Property-based: Events sharing the same frontmatter series property value
 *
 * Follows the CategoryTracker pattern for subscription/rebuild lifecycle.
 */
export class SeriesManager {
	/** Cleaned lowercase title -> file paths */
	private seriesByName = new Map<string, Set<string>>();
	/** Series prop value -> file paths */
	private seriesByProp = new Map<string, Set<string>>();
	/** Reverse lookup: file path -> name key */
	private fileToNameKey = new Map<string, string>();
	/** Reverse lookup: file path -> series prop values */
	private fileToSeriesProp = new Map<string, Set<string>>();

	private subscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private _settings: SingleCalendarConfig;

	constructor(
		private indexer: Indexer,
		private eventStore: EventStore,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this._settings = settingsStore.value;

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this._settings = newSettings;
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
		switch (event.type) {
			case "file-changed":
				if (event.source) {
					this.updateFile(event.filePath, event.source.frontmatter);
				}
				break;
			case "file-deleted":
				this.removeFile(event.filePath);
				break;
		}
	}

	private addToGroup(groupMap: Map<string, Set<string>>, key: string, filePath: string): void {
		let set = groupMap.get(key);
		if (!set) {
			set = new Set();
			groupMap.set(key, set);
		}
		set.add(filePath);
	}

	private removeFromGroupSingle(
		groupMap: Map<string, Set<string>>,
		reverseMap: Map<string, string>,
		filePath: string
	): void {
		const key = reverseMap.get(filePath);
		if (!key) return;
		const set = groupMap.get(key);
		if (set) {
			set.delete(filePath);
			if (set.size === 0) groupMap.delete(key);
		}
		reverseMap.delete(filePath);
	}

	private removeFromGroupMulti(
		groupMap: Map<string, Set<string>>,
		reverseMap: Map<string, Set<string>>,
		filePath: string
	): void {
		const keys = reverseMap.get(filePath);
		if (!keys) return;
		for (const key of keys) {
			const set = groupMap.get(key);
			if (set) {
				set.delete(filePath);
				if (set.size === 0) groupMap.delete(key);
			}
		}
		reverseMap.delete(filePath);
	}

	private updateFile(filePath: string, frontmatter: Record<string, unknown>): void {
		this.removeFile(filePath);

		const title = getEventName(this._settings.titleProp, frontmatter, filePath);
		if (title) {
			const nameKey = title.toLowerCase();
			if (nameKey) {
				this.fileToNameKey.set(filePath, nameKey);
				this.addToGroup(this.seriesByName, nameKey, filePath);
			}
		}

		const seriesProp = this._settings.seriesProp;
		if (seriesProp) {
			const seriesValues = parseIntoList(frontmatter[seriesProp]);
			if (seriesValues.length > 0) {
				this.fileToSeriesProp.set(filePath, new Set(seriesValues));
				for (const value of seriesValues) {
					this.addToGroup(this.seriesByProp, value, filePath);
				}
			}
		}
	}

	private removeFile(filePath: string): void {
		this.removeFromGroupSingle(this.seriesByName, this.fileToNameKey, filePath);
		this.removeFromGroupMulti(this.seriesByProp, this.fileToSeriesProp, filePath);
	}

	private rebuild(): void {
		this.seriesByName.clear();
		this.seriesByProp.clear();
		this.fileToNameKey.clear();
		this.fileToSeriesProp.clear();

		const allEvents = this.eventStore.getAllEvents();
		for (const event of allEvents) {
			this.updateFile(event.ref.filePath, event.meta);
		}
	}

	/** Returns name-based series that contain 2+ events (single events aren't a "series") */
	getNameBasedSeries(): Map<string, Set<string>> {
		return new Map(Array.from(this.seriesByName).filter(([_name, files]) => files.size >= 2));
	}

	/** Returns property-based series (1+ events, since the user explicitly tagged them) */
	getPropBasedSeries(): Map<string, Set<string>> {
		return new Map(this.seriesByProp);
	}

	/** Returns a combined sorted list of all series keys (both name-based and prop-based) */
	getAllSeriesKeys(): string[] {
		const keys = new Set<string>();
		for (const [name, files] of this.seriesByName) {
			if (files.size >= 2) keys.add(name);
		}
		for (const key of this.seriesByProp.keys()) {
			keys.add(key);
		}
		return Array.from(keys).sort((a, b) => a.localeCompare(b));
	}

	/** Returns CalendarEvents in the name-based series for a given cleaned name key */
	getEventsInNameSeries(nameKey: string): CalendarEvent[] {
		const filePaths = this.seriesByName.get(nameKey);
		if (!filePaths) return [];
		return this.resolveEvents(filePaths);
	}

	/** Returns CalendarEvents in the property-based series for a given prop value */
	getEventsInPropSeries(propValue: string): CalendarEvent[] {
		const filePaths = this.seriesByProp.get(propValue);
		if (!filePaths) return [];
		return this.resolveEvents(filePaths);
	}

	private resolveEvents(filePaths: Set<string>): CalendarEvent[] {
		const events: CalendarEvent[] = [];
		for (const filePath of filePaths) {
			const event = this.eventStore.getEventByPath(filePath);
			if (event) {
				events.push(event);
			}
		}
		return events;
	}

	/** Returns all prop-based series with their event counts, sorted alphabetically */
	getPropSeriesWithCounts(): { name: string; count: number }[] {
		return Array.from(this.seriesByProp.entries())
			.map(([name, files]) => ({ name, count: files.size }))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
	}
}
