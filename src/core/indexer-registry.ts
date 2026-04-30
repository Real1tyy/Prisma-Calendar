import type { SyncStore } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";
import type { BehaviorSubject } from "rxjs";

import type { PrismaSyncDataSchema } from "../types";
import type { SingleCalendarConfig } from "../types/settings";
import { CategoryTracker } from "./category-tracker";
import { EventFileRepository } from "./event-file-repository";
import { EventStore } from "./event-store";
import { UntrackedEventStore } from "./event-store";
import { NameSeriesTracker } from "./name-series-tracker";
import { NotificationManager } from "./notification-manager";
import { Parser } from "./parser";
import { PrerequisiteTracker } from "./prerequisite-tracker";
import { RecurringEventManager } from "./recurring-event-manager";

interface RegistryEntry {
	fileRepository: EventFileRepository;
	parser: Parser;
	eventStore: EventStore;
	untrackedEventStore: UntrackedEventStore;
	recurringEventManager: RecurringEventManager;
	notificationManager: NotificationManager;
	categoryTracker: CategoryTracker;
	nameSeriesTracker: NameSeriesTracker;
	prerequisiteTracker: PrerequisiteTracker;
	refCount: number;
	calendarIds: Set<string>;
}

type SharedInfrastructure = Pick<
	RegistryEntry,
	| "fileRepository"
	| "parser"
	| "eventStore"
	| "untrackedEventStore"
	| "recurringEventManager"
	| "notificationManager"
	| "categoryTracker"
	| "nameSeriesTracker"
	| "prerequisiteTracker"
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
	private registry: Map<string, RegistryEntry> = new Map();
	private syncStore: SyncStore<typeof PrismaSyncDataSchema> | null = null;

	private constructor(private app: App) {}

	static getInstance(app: App): IndexerRegistry {
		if (!IndexerRegistry.instance) {
			IndexerRegistry.instance = new IndexerRegistry(app);
		}
		return IndexerRegistry.instance;
	}

	setSyncStore(syncStore: SyncStore<typeof PrismaSyncDataSchema>): void {
		this.syncStore = syncStore;
	}

	/**
	 * Get or create shared infrastructure for the specified directory.
	 * Returns existing instances if another calendar is already using this directory.
	 *
	 * Empty directories get per-calendar keys — each unconfigured calendar gets
	 * its own infrastructure so they can independently diverge when the user
	 * picks real directories via configure.
	 */
	getOrCreateIndexer(calendarId: string, settingsStore: BehaviorSubject<SingleCalendarConfig>): SharedInfrastructure {
		const registryKey = calendarId;

		let entry: RegistryEntry | undefined = this.registry.get(registryKey);

		if (entry) {
			entry.refCount++;
			entry.calendarIds.add(calendarId);
		} else {
			const fileRepository = new EventFileRepository(this.app, settingsStore, this.syncStore);
			const recurringEventManager = new RecurringEventManager(this.app, settingsStore, fileRepository, this.syncStore);
			const notificationManager = new NotificationManager(this.app, settingsStore, fileRepository, this.syncStore);
			const parser = new Parser(this.app, settingsStore);
			const eventStore = new EventStore(fileRepository, parser, recurringEventManager, settingsStore);
			const categoryTracker = new CategoryTracker(this.app, fileRepository, eventStore, settingsStore);
			const nameSeriesTracker = new NameSeriesTracker(this.app, fileRepository, eventStore, settingsStore);
			const prerequisiteTracker = new PrerequisiteTracker(this.app, fileRepository, eventStore, settingsStore);
			recurringEventManager.setEventStore(eventStore);
			recurringEventManager.setCategoryTracker(categoryTracker);
			const untrackedEventStore = new UntrackedEventStore(fileRepository, settingsStore);

			entry = {
				fileRepository,
				parser,
				eventStore,
				untrackedEventStore,
				recurringEventManager,
				notificationManager,
				categoryTracker,
				nameSeriesTracker,
				prerequisiteTracker,
				refCount: 1,
				calendarIds: new Set([calendarId]),
			} satisfies RegistryEntry;

			this.registry.set(registryKey, entry);
		}

		return {
			fileRepository: entry.fileRepository,
			parser: entry.parser,
			eventStore: entry.eventStore,
			untrackedEventStore: entry.untrackedEventStore,
			recurringEventManager: entry.recurringEventManager,
			notificationManager: entry.notificationManager,
			categoryTracker: entry.categoryTracker,
			nameSeriesTracker: entry.nameSeriesTracker,
			prerequisiteTracker: entry.prerequisiteTracker,
		};
	}

	/**
	 * Release an indexer reference when a calendar is destroyed.
	 * Destroys the indexer only when no calendars are using it anymore.
	 */
	releaseIndexer(calendarId: string, _directory: string): void {
		const registryKey = calendarId;
		const entry = this.registry.get(registryKey);

		if (!entry) {
			return;
		}

		entry.calendarIds.delete(calendarId);
		entry.refCount--;

		if (entry.refCount <= 0) {
			entry.fileRepository.destroy();
			entry.eventStore.destroy();
			entry.untrackedEventStore.destroy();
			entry.parser.destroy();
			entry.recurringEventManager.destroy();
			entry.notificationManager.stop();
			entry.categoryTracker.destroy();
			entry.nameSeriesTracker.destroy();
			entry.prerequisiteTracker.destroy();
			this.registry.delete(registryKey);
		}
	}

	destroy(): void {
		for (const entry of this.registry.values()) {
			entry.fileRepository.destroy();
			entry.eventStore.destroy();
			entry.untrackedEventStore.destroy();
			entry.parser.destroy();
			entry.recurringEventManager.destroy();
			entry.notificationManager.stop();
			entry.categoryTracker.destroy();
			entry.nameSeriesTracker.destroy();
			entry.prerequisiteTracker.destroy();
		}

		this.registry.clear();
		IndexerRegistry.instance = null;
	}
}
