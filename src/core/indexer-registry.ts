import type { App } from "obsidian";
import type { BehaviorSubject } from "rxjs";
import type { SingleCalendarConfig } from "../types/settings";
import { normalizeDirectoryPath } from "../utils/file-utils";
import { EventStore } from "./event-store";
import { Indexer } from "./indexer";
import { NotificationManager } from "./notification-manager";
import { Parser } from "./parser";
import { RecurringEventManager } from "./recurring-event-manager";

interface IndexerEntry {
	indexer: Indexer;
	parser: Parser;
	eventStore: EventStore;
	recurringEventManager: RecurringEventManager;
	notificationManager: NotificationManager;
	refCount: number;
	calendarIds: Set<string>;
}

type SharedInfrastructure = Pick<
	IndexerEntry,
	"indexer" | "parser" | "eventStore" | "recurringEventManager" | "notificationManager"
>;

/**
 * Registry to manage shared indexers, parsers, event stores, and recurring event managers across multiple calendars.
 *
 * When multiple calendars use the same directory, they share the same infrastructure to prevent conflicts
 * and improve efficiency. This ensures:
 * - File events are processed once
 * - Physical recurring instances aren't duplicated
 * - Events are parsed and cached once
 * - Virtual events are generated from a single source
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
	 * Get or create shared infrastructure for the specified directory.
	 * Returns existing instances if another calendar is already using this directory.
	 */
	getOrCreateIndexer(calendarId: string, settingsStore: BehaviorSubject<SingleCalendarConfig>): SharedInfrastructure {
		const directory = normalizeDirectoryPath(settingsStore.value.directory);

		let entry: IndexerEntry | undefined = this.registry.get(directory);

		if (entry) {
			entry.refCount++;
			entry.calendarIds.add(calendarId);
		} else {
			const indexer = new Indexer(this.app, settingsStore);
			const recurringEventManager = new RecurringEventManager(this.app, settingsStore, indexer);
			const notificationManager = new NotificationManager(this.app, settingsStore, indexer);
			const parser = new Parser(settingsStore);
			const eventStore = new EventStore(indexer, parser, recurringEventManager);

			entry = {
				indexer,
				parser,
				eventStore,
				recurringEventManager,
				notificationManager,
				refCount: 1,
				calendarIds: new Set([calendarId]),
			} satisfies IndexerEntry;

			this.registry.set(directory, entry);
		}

		return {
			indexer: entry.indexer,
			parser: entry.parser,
			eventStore: entry.eventStore,
			recurringEventManager: entry.recurringEventManager,
			notificationManager: entry.notificationManager,
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
			entry.eventStore.destroy();
			entry.parser.destroy();
			entry.recurringEventManager.destroy();
			entry.notificationManager.stop();
			this.registry.delete(normalizedDir);
		}
	}

	destroy(): void {
		for (const entry of this.registry.values()) {
			entry.indexer.stop();
			entry.eventStore.destroy();
			entry.parser.destroy();
			entry.recurringEventManager.destroy();
			entry.notificationManager.stop();
		}

		this.registry.clear();
		IndexerRegistry.instance = null;
	}
}
