import type { App } from "obsidian";
import type { BehaviorSubject } from "rxjs";
import type { SingleCalendarConfig } from "../types/settings";
import { normalizeDirectoryPath } from "../utils/file-utils";
import { Indexer } from "./indexer";
import { RecurringEventManager } from "./recurring-event-manager";

interface IndexerEntry {
	indexer: Indexer;
	recurringEventManager: RecurringEventManager;
	refCount: number;
	calendarIds: Set<string>;
}

/**
 * Registry to manage shared indexers and recurring event managers across multiple calendars.
 *
 * When multiple calendars use the same directory, they share the same indexer to prevent conflicts.
 * This ensures file events are processed once and physical recurring instances aren't duplicated.
 *
 * **Limitation**: Cannot detect subset overlaps (e.g., "tasks" vs "tasks/homework" will create separate indexers).
 */
export class IndexerRegistry {
	private static instance: IndexerRegistry | null = null;
	private registry: Map<string, IndexerEntry> = new Map();

	private constructor(private app: App) {}

	static getInstance(app: App): IndexerRegistry {
		if (!IndexerRegistry.instance) {
			IndexerRegistry.instance = new IndexerRegistry(app);
		}
		return IndexerRegistry.instance;
	}

	/**
	 * Get or create an indexer for the specified directory.
	 * Returns existing indexer if another calendar is already using this directory.
	 */
	getOrCreateIndexer(
		calendarId: string,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	): { indexer: Indexer; recurringEventManager: RecurringEventManager } {
		const directory = normalizeDirectoryPath(settingsStore.value.directory);

		let entry = this.registry.get(directory);

		if (entry) {
			entry.refCount++;
			entry.calendarIds.add(calendarId);
		} else {
			const indexer = new Indexer(this.app, settingsStore);
			const recurringEventManager = new RecurringEventManager(this.app, settingsStore, indexer);

			entry = {
				indexer,
				recurringEventManager,
				refCount: 1,
				calendarIds: new Set([calendarId]),
			};

			this.registry.set(directory, entry);
		}

		return {
			indexer: entry.indexer,
			recurringEventManager: entry.recurringEventManager,
		};
	}

	/**
	 * Release an indexer reference when a calendar is destroyed.
	 * Destroys the indexer only when no calendars are using it anymore.
	 */
	releaseIndexer(calendarId: string, directory: string): void {
		const normalizedDir = normalizeDirectoryPath(directory);
		const entry = this.registry.get(normalizedDir);

		if (!entry) {
			return;
		}

		entry.calendarIds.delete(calendarId);
		entry.refCount--;

		if (entry.refCount <= 0) {
			entry.indexer.stop();
			entry.recurringEventManager.destroy();
			this.registry.delete(normalizedDir);
		}
	}

	destroy(): void {
		for (const entry of this.registry.values()) {
			entry.indexer.stop();
			entry.recurringEventManager.destroy();
		}

		this.registry.clear();
		IndexerRegistry.instance = null;
	}
}
