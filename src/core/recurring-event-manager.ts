import type { SyncStore } from "@real1ty-obsidian-plugins";
import {
	applySourceTimeToInstanceDate,
	createFileAtPathAtomic,
	createFileLink,
	DebouncedNotifier,
	extractContentAfterFrontmatter,
	type FrontmatterDiff,
	FrontmatterPropagationDebouncer,
	getISOTimePart,
	getObsidianLinkPath,
	getUniqueFilePathFromFull,
	rebuildPhysicalInstanceFilename,
	replaceISOTime,
	sanitizeForFilename,
	showFrontmatterPropagationModal,
	withFrontmatter,
	withLock,
} from "@real1ty-obsidian-plugins";
import { DateTime } from "luxon";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";

import type { CalendarEvent, Frontmatter, PrismaSyncDataSchema } from "../types";
import type { EventMetadata } from "../types/event";
import { stripZ, toInternalISO } from "../types/event";
import type { NodeRecurringEvent, RecurringEventSeries } from "../types/recurring-event";
import type { SingleCalendarConfig } from "../types/settings";
import { getNextOccurrence } from "../utils/date-recurrence";
import {
	applyFrontmatterChangesToInstance,
	filterExcludedPropsFromDiff,
	getRecurringInstanceExcludedProps,
	setEventBasics,
	type TimePropagationDiff,
} from "../utils/event-frontmatter";
import { hashRRuleIdToZettelFormat, removeZettelId } from "../utils/event-naming";
import {
	batchedPromiseAll,
	deleteFilesByPaths,
	getFileAndFrontmatter,
	getFileByPathOrThrow,
	trashDuplicateFile,
} from "../utils/obsidian";
import { calculateTargetInstanceCount, findFirstValidStartDate, getStartDateTime } from "../utils/recurring-utils";
import type { CategoryTracker } from "./category-tracker";
import type { EventStore } from "./event-store";
import type { Indexer, IndexerEvent } from "./indexer";

const DATE_FORMAT = "yyyy-MM-dd";

interface NodeRecurringEventInstance {
	recurringEvent: NodeRecurringEvent;
	instanceDate: DateTime;
	filePath: string;
	created: boolean;
}

interface PhysicalInstance {
	filePath: string;
	instanceDate: DateTime;
}

interface RecurringEventData {
	recurringEvent: NodeRecurringEvent | null;
	physicalInstances: Map<string, PhysicalInstance>;
}

interface ParsedTimeChange {
	prop: string;
	oldTimePart: string;
	newTimePart: string;
}
export class RecurringEventManager extends DebouncedNotifier {
	private settings: SingleCalendarConfig;
	private recurringEventsMap: Map<string, RecurringEventData> = new Map();
	private subscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private indexingComplete = false;
	private creationLocks: Map<string, Promise<string | null>> = new Map();
	private sourceFileToRRuleId: Map<string, string> = new Map();
	private instanceFileToRRuleId: Map<string, string> = new Map();
	private physicalSourceToRRuleIds: Map<string, Set<string>> = new Map();
	private ensureInstancesLocks: Map<string, Promise<void>> = new Map();
	private propagationDebouncer: FrontmatterPropagationDebouncer<string>;
	private eventStore: EventStore | null = null;
	private categoryTracker: CategoryTracker | null = null;

	// ─── Lifecycle ────────────────────────────────────────────────

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private indexer: Indexer,
		private syncStore: SyncStore<typeof PrismaSyncDataSchema> | null
	) {
		super();
		this.settings = settingsStore.value;
		this.propagationDebouncer = new FrontmatterPropagationDebouncer({
			debounceMs: this.settings.propagationDebounceMs,
			filterDiff: (diff) => filterExcludedPropsFromDiff(diff, this.settings),
		});

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});
		this.indexingCompleteSubscription = this.indexer.indexingComplete$.subscribe((isComplete) => {
			this.indexingComplete = isComplete;
			if (isComplete) {
				void this.processAllRecurringEvents();
			}
		});
		this.subscription = this.indexer.events$.subscribe((event: IndexerEvent) => {
			void this.handleIndexerEvent(event);
		});
	}

	override destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		this.propagationDebouncer.destroy();
		super.destroy();
		this.recurringEventsMap.clear();
		this.creationLocks.clear();
		this.sourceFileToRRuleId.clear();
		this.instanceFileToRRuleId.clear();
		this.physicalSourceToRRuleIds.clear();
		this.ensureInstancesLocks.clear();
	}

	/**
	 * Clears all internal state without notifying subscribers.
	 * Used during resync to avoid triggering a refresh before new data is loaded.
	 */
	clearWithoutNotify(): void {
		this.recurringEventsMap.clear();
		this.sourceFileToRRuleId.clear();
		this.instanceFileToRRuleId.clear();
		this.physicalSourceToRRuleIds.clear();
		// Keep locks intact to prevent race conditions during resync
	}

	// ─── Indexer Event Handling ───────────────────────────────────

	private async handleIndexerEvent(event: IndexerEvent): Promise<void> {
		switch (event.type) {
			case "recurring-event-found":
				if (event.recurringEvent) {
					this.addRecurringEvent(event.recurringEvent, event.oldFrontmatter);
					if (this.indexingComplete) {
						if (event.oldPath) {
							// Rename: rename physical instances BEFORE ensuring count,
							// so ensurePhysicalInstances sees the correct (renamed) files
							// and doesn't create duplicates.
							await this.handleRecurringEventRenamedWithLock(event.recurringEvent);
						}
						await this.ensurePhysicalInstancesWithLock(event.recurringEvent.rRuleId);
						this.handleFrontmatterPropagation(event.recurringEvent, event.frontmatterDiff, event.oldFrontmatter);
					}
				}
				break;
			case "file-changed":
				if (event.source) {
					this.handleFileChanged(event.filePath, event.source.metadata);
				}
				break;
			case "file-deleted":
				this.handleFileDeleted(event);
				break;
		}
	}

	private async handleRecurringEventRenamedWithLock(recurringEvent: NodeRecurringEvent): Promise<void> {
		return withLock(this.ensureInstancesLocks, recurringEvent.rRuleId, () =>
			this.handleRecurringEventRenamed(recurringEvent)
		);
	}

	private async handleRecurringEventRenamed(recurringEvent: NodeRecurringEvent): Promise<void> {
		const data = this.recurringEventsMap.get(recurringEvent.rRuleId);
		if (!data || data.physicalInstances.size === 0) {
			return;
		}

		await batchedPromiseAll(
			this.getPhysicalInstancesList(data.physicalInstances),
			(instance) => this.renamePhysicalInstance(instance, recurringEvent.title, recurringEvent.rRuleId),
			this.settings.fileConcurrencyLimit
		);
	}

	private async renamePhysicalInstance(instance: PhysicalInstance, newTitle: string, rruleId: string): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(instance.filePath);
			if (!(file instanceof TFile)) {
				console.warn(`[RecurringEvents] Physical instance file not found: ${instance.filePath}`);
				return;
			}

			const newBasename = rebuildPhysicalInstanceFilename(file.basename, newTitle);
			if (!newBasename) {
				console.warn(`[RecurringEvents] Could not rebuild filename for physical instance: ${file.basename}`);
				return;
			}

			const oldPath = instance.filePath;
			const folderPath = file.parent?.path ? `${file.parent.path}/` : "";
			const newPath = `${folderPath}${newBasename}.md`;
			await this.app.fileManager.renameFile(file, newPath);
			instance.filePath = newPath;
			this.instanceFileToRRuleId.delete(oldPath);
			this.instanceFileToRRuleId.set(newPath, rruleId);
		} catch (error) {
			console.error(`[RecurringEvents] Error renaming physical instance ${instance.filePath}:`, error);
		}
	}

	private handleFrontmatterPropagation(
		recurringEvent: NodeRecurringEvent,
		frontmatterDiff?: FrontmatterDiff,
		oldFrontmatter?: Frontmatter
	): void {
		const data = this.recurringEventsMap.get(recurringEvent.rRuleId);
		if (!data || data.physicalInstances.size === 0) return;

		if (oldFrontmatter) {
			const timeDiff = this.extractTimeDiffFromFrontmatter(oldFrontmatter, recurringEvent.frontmatter);
			if (timeDiff) {
				void this.propagateTimeToFutureInstances(recurringEvent, timeDiff);
			}
		}

		if (!frontmatterDiff?.hasChanges) return;

		if (!this.settings.propagateFrontmatterToInstances && !this.settings.askBeforePropagatingFrontmatter) {
			return;
		}

		this.propagationDebouncer.schedule(
			recurringEvent.rRuleId,
			frontmatterDiff,
			recurringEvent.rRuleId,
			(filteredDiff, rruleId) => {
				const currentData = this.recurringEventsMap.get(rruleId);
				const currentEvent = currentData?.recurringEvent;
				if (!currentData || !currentEvent || currentData.physicalInstances.size === 0) return;

				if (this.settings.propagateFrontmatterToInstances) {
					void this.propagateFrontmatterToInstances(currentEvent, filteredDiff);
				} else if (this.settings.askBeforePropagatingFrontmatter) {
					const instanceCount = currentData.physicalInstances.size;
					showFrontmatterPropagationModal(this.app, {
						eventTitle: currentEvent.title,
						diff: filteredDiff,
						instanceCount,
						onConfirm: () => this.propagateFrontmatterToInstances(currentEvent, filteredDiff),
					});
				}
			}
		);
	}

	private async propagateFrontmatterToInstances(
		recurringEvent: NodeRecurringEvent,
		frontmatterDiff: FrontmatterDiff
	): Promise<void> {
		const data = this.recurringEventsMap.get(recurringEvent.rRuleId);
		if (!data || data.physicalInstances.size === 0) {
			return;
		}

		if (!frontmatterDiff.hasChanges) {
			return;
		}

		const excludedProps = getRecurringInstanceExcludedProps(this.settings);

		await batchedPromiseAll(
			this.getPhysicalInstancesList(data.physicalInstances),
			(instance) =>
				applyFrontmatterChangesToInstance(
					this.app,
					instance.filePath,
					recurringEvent.frontmatter,
					frontmatterDiff,
					excludedProps
				),
			this.settings.fileConcurrencyLimit
		);
	}

	private async propagateTimeToFutureInstances(
		recurringEvent: NodeRecurringEvent,
		timeDiff: TimePropagationDiff
	): Promise<void> {
		const data = this.recurringEventsMap.get(recurringEvent.rRuleId);
		if (!data || data.physicalInstances.size === 0) return;

		const today = DateTime.now().startOf("day");
		const futureInstances = this.getPhysicalInstancesList(data.physicalInstances).filter(
			(instance) => instance.instanceDate >= today
		);

		if (futureInstances.length === 0) return;

		const parsedChanges = this.parseTimeDiffChanges(timeDiff);
		if (parsedChanges.length === 0) return;

		await batchedPromiseAll(
			futureInstances,
			(instance) => this.applyTimeChangeToInstance(instance, parsedChanges),
			this.settings.fileConcurrencyLimit
		);
	}

	private extractTimeDiffFromFrontmatter(oldFm: Frontmatter, newFm: Frontmatter): TimePropagationDiff | null {
		const { startProp, endProp } = this.settings;
		const oldStart = oldFm[startProp];
		const newStart = newFm[startProp];
		const oldEnd = oldFm[endProp];
		const newEnd = newFm[endProp];

		const startChange =
			typeof oldStart === "string" && typeof newStart === "string" && oldStart !== newStart
				? { oldValue: oldStart, newValue: newStart }
				: undefined;

		const endChange =
			typeof oldEnd === "string" && typeof newEnd === "string" && oldEnd !== newEnd
				? { oldValue: oldEnd, newValue: newEnd }
				: undefined;

		if (!startChange && !endChange) return null;
		return { startChange, endChange };
	}

	private parseTimeDiffChanges(timeDiff: TimePropagationDiff): ParsedTimeChange[] {
		const changes: ParsedTimeChange[] = [];

		if (timeDiff.startChange) {
			changes.push({
				prop: this.settings.startProp,
				oldTimePart: getISOTimePart(timeDiff.startChange.oldValue),
				newTimePart: getISOTimePart(timeDiff.startChange.newValue),
			});
		}
		if (timeDiff.endChange) {
			changes.push({
				prop: this.settings.endProp,
				oldTimePart: getISOTimePart(timeDiff.endChange.oldValue),
				newTimePart: getISOTimePart(timeDiff.endChange.newValue),
			});
		}
		return changes;
	}

	private async applyTimeChangeToInstance(instance: PhysicalInstance, changes: ParsedTimeChange[]): Promise<void> {
		try {
			const { frontmatter } = getFileAndFrontmatter(this.app, instance.filePath);

			const applicableChanges = changes.filter(({ prop, oldTimePart }) => {
				const current = frontmatter[prop];
				if (typeof current !== "string" || !current.includes("T")) return false;
				return getISOTimePart(current) === oldTimePart;
			});

			if (applicableChanges.length === 0) return;

			const file = getFileByPathOrThrow(this.app, instance.filePath);
			await withFrontmatter(this.app, file, (fm) => {
				for (const { prop, newTimePart } of applicableChanges) {
					fm[prop] = replaceISOTime(fm[prop] as string, newTimePart);
				}
			});
		} catch (error) {
			console.error(`[RecurringEvents] Error applying time change to instance ${instance.filePath}:`, error);
		}
	}

	private handleFileChanged(filePath: string, metadata: EventMetadata): void {
		const { rruleId, instanceDate, source } = metadata;

		if (rruleId && instanceDate) {
			const parsedInstanceDate = DateTime.fromISO(stripZ(instanceDate));
			if (parsedInstanceDate.isValid) {
				let recurringData = this.recurringEventsMap.get(rruleId);

				if (!recurringData) {
					recurringData = {
						recurringEvent: null,
						physicalInstances: new Map(),
					};
					this.recurringEventsMap.set(rruleId, recurringData);
				}

				const dateKey = parsedInstanceDate.toISODate();
				if (dateKey) {
					const existing = recurringData.physicalInstances.get(dateKey);
					if (existing && existing.filePath !== filePath) {
						// First file wins — trash the newcomer (matches ICS/CalDAV convention)
						trashDuplicateFile(this.app, filePath, `recurring instance (rruleId: ${rruleId}, date: ${dateKey})`);
						return;
					}

					recurringData.physicalInstances.set(dateKey, {
						filePath,
						instanceDate: parsedInstanceDate,
					});
					this.instanceFileToRRuleId.set(filePath, rruleId);
					this.trackPhysicalSourceMapping(rruleId, source, filePath);
					this.scheduleRefresh();
				}
			}
		}
	}

	private trackPhysicalSourceMapping(rruleId: string, sourceLinkValue: unknown, instancePath: string): void {
		if (typeof sourceLinkValue !== "string" || !sourceLinkValue.trim()) {
			return;
		}
		const sourcePath = this.resolvePhysicalSourcePath(sourceLinkValue, instancePath);
		if (!sourcePath) {
			return;
		}
		const existing = this.physicalSourceToRRuleIds.get(sourcePath) ?? new Set<string>();
		existing.add(rruleId);
		this.physicalSourceToRRuleIds.set(sourcePath, existing);
	}

	private resolvePhysicalSourcePath(sourceLink: string, instancePath: string): string | null {
		const linkPath = getObsidianLinkPath(sourceLink);
		const sourceFile = this.app.metadataCache.getFirstLinkpathDest(linkPath, instancePath);
		return sourceFile?.path || null;
	}

	private handleFileDeleted(event: IndexerEvent): void {
		const rruleId = this.sourceFileToRRuleId.get(event.filePath);

		if (rruleId) {
			if (event.isRename) {
				// Rename: only remove the old path mapping, keep recurring event data
				// and physical instances intact. The subsequent "recurring-event-found"
				// event for the new path will re-associate the data and rename instances.
				this.sourceFileToRRuleId.delete(event.filePath);
			} else {
				this.recurringEventsMap.delete(rruleId);
				this.sourceFileToRRuleId.delete(event.filePath);
			}
			this.scheduleRefresh();
			return;
		}

		// Check if this is an instance file using the O(1) cache
		const instanceRRuleId = this.instanceFileToRRuleId.get(event.filePath);
		if (instanceRRuleId) {
			this.instanceFileToRRuleId.delete(event.filePath);
			const data = this.recurringEventsMap.get(instanceRRuleId);
			if (data) {
				for (const [dateKey, instance] of data.physicalInstances.entries()) {
					if (instance.filePath === event.filePath) {
						data.physicalInstances.delete(dateKey);
						break;
					}
				}
			}
			this.scheduleRefresh();
		}
	}

	// ─── Recurring Event Registration ─────────────────────────────

	private async processAllRecurringEvents(): Promise<void> {
		await Promise.all(
			Array.from(this.recurringEventsMap.entries()).map(async ([rruleId, data]) => {
				try {
					await this.ensurePhysicalInstancesWithLock(rruleId);
				} catch (error) {
					const eventTitle = data?.recurringEvent?.title || "Unknown Event";
					console.error(`[RecurringEvents] ❌ Failed to process recurring event ${eventTitle} (${rruleId}):`, error);
				}
			})
		);

		// Force immediate notification after all recurring events are processed
		this.flushPendingRefresh();
	}

	private addRecurringEvent(recurringEvent: NodeRecurringEvent, oldFrontmatter?: Frontmatter): void {
		const previousRRuleId = oldFrontmatter?.[this.settings.rruleIdProp];
		const previousRRuleIdStr = typeof previousRRuleId === "string" ? previousRRuleId : null;

		if (previousRRuleIdStr && previousRRuleIdStr !== recurringEvent.rRuleId) {
			this.migrateRecurringSeriesId(previousRRuleIdStr, recurringEvent.rRuleId, recurringEvent);
			return;
		}

		const existingRRuleId = this.sourceFileToRRuleId.get(recurringEvent.sourceFilePath);
		if (existingRRuleId && existingRRuleId !== recurringEvent.rRuleId) {
			this.migrateRecurringSeriesId(existingRRuleId, recurringEvent.rRuleId, recurringEvent);
			return;
		}

		const physicalLinkedIds = this.physicalSourceToRRuleIds.get(recurringEvent.sourceFilePath);
		if (physicalLinkedIds && physicalLinkedIds.size > 0) {
			for (const linkedRRuleId of Array.from(physicalLinkedIds)) {
				if (linkedRRuleId !== recurringEvent.rRuleId && this.recurringEventsMap.has(linkedRRuleId)) {
					this.migrateRecurringSeriesId(linkedRRuleId, recurringEvent.rRuleId, recurringEvent);
					return;
				}
			}
		}

		const existingData = this.recurringEventsMap.get(recurringEvent.rRuleId);
		if (existingData) {
			existingData.recurringEvent = recurringEvent;
		} else {
			this.recurringEventsMap.set(recurringEvent.rRuleId, {
				recurringEvent,
				physicalInstances: new Map(),
			});
		}
		this.sourceFileToRRuleId.set(recurringEvent.sourceFilePath, recurringEvent.rRuleId);
		this.notifyChange();
	}

	private migrateRecurringSeriesId(fromRRuleId: string, toRRuleId: string, recurringEvent: NodeRecurringEvent): void {
		const fromData = this.recurringEventsMap.get(fromRRuleId);
		const toData = this.recurringEventsMap.get(toRRuleId);
		const mergedPhysicalInstances = this.mergePhysicalInstances(fromData?.physicalInstances, toData?.physicalInstances);

		this.recurringEventsMap.set(toRRuleId, {
			recurringEvent,
			physicalInstances: mergedPhysicalInstances,
		});
		if (fromRRuleId !== toRRuleId) {
			this.recurringEventsMap.delete(fromRRuleId);
		}

		this.sourceFileToRRuleId.set(recurringEvent.sourceFilePath, toRRuleId);
		this.rebindPhysicalSourceMapping(recurringEvent.sourceFilePath, fromRRuleId, toRRuleId);

		for (const instance of mergedPhysicalInstances.values()) {
			this.instanceFileToRRuleId.set(instance.filePath, toRRuleId);
		}

		this.notifyChange();

		if (fromRRuleId !== toRRuleId && mergedPhysicalInstances.size > 0) {
			void this.rewritePhysicalInstancesRRuleId(mergedPhysicalInstances, toRRuleId);
		}
	}

	private mergePhysicalInstances(
		first?: Map<string, PhysicalInstance>,
		second?: Map<string, PhysicalInstance>
	): Map<string, PhysicalInstance> {
		return new Map([...(first ?? []), ...(second ?? [])]);
	}

	private rebindPhysicalSourceMapping(sourcePath: string, oldRRuleId: string, newRRuleId: string): void {
		const existing = this.physicalSourceToRRuleIds.get(sourcePath);
		const next = new Set(existing ?? []);
		next.delete(oldRRuleId);
		next.add(newRRuleId);
		this.physicalSourceToRRuleIds.set(sourcePath, next);
	}

	private async rewritePhysicalInstancesRRuleId(
		physicalInstances: Map<string, PhysicalInstance>,
		newRRuleId: string
	): Promise<void> {
		await batchedPromiseAll(
			Array.from(physicalInstances.values()),
			async (instance) => {
				const file = this.app.vault.getAbstractFileByPath(instance.filePath);
				if (!(file instanceof TFile)) {
					return;
				}
				await this.app.fileManager.processFrontMatter(file, (fm) => {
					if (fm[this.settings.rruleIdProp] !== newRRuleId) {
						fm[this.settings.rruleIdProp] = newRRuleId;
					}
				});
			},
			this.settings.fileConcurrencyLimit
		);
	}

	// ─── Physical Instance Management ─────────────────────────────

	private async ensurePhysicalInstancesWithLock(rruleId: string): Promise<void> {
		return withLock(this.ensureInstancesLocks, rruleId, async () => {
			const data = this.recurringEventsMap.get(rruleId);
			if (!data || !data.recurringEvent) return;
			await this.ensurePhysicalInstances(data);
		});
	}

	private async ensurePhysicalInstances(data: RecurringEventData): Promise<void> {
		if (!data.recurringEvent) return;

		if (this.syncStore?.data.readOnly) {
			return;
		}

		try {
			const { recurringEvent, physicalInstances } = data;

			if (recurringEvent.metadata.skip) {
				return;
			}

			const now = DateTime.now();
			const generatePastEvents = recurringEvent.metadata.generatePastEvents;

			const futureInstances = this.getPhysicalInstancesList(physicalInstances).filter(
				(instance) => instance.instanceDate >= now.startOf("day")
			);

			const targetInstanceCount = calculateTargetInstanceCount(
				recurringEvent.rrules,
				recurringEvent.metadata.futureInstancesCount,
				this.settings.futureInstancesCount
			);
			const currentCount = futureInstances.length;

			if (currentCount >= targetInstanceCount) {
				if (generatePastEvents) {
					await this.ensurePastInstances(recurringEvent, physicalInstances, now);
				}
				return;
			}

			const instancesToCreate = targetInstanceCount - currentCount;
			let nextDate = this.getNextOccurrenceFromTime(recurringEvent, futureInstances, now.startOf("day"));

			for (let i = 0; i < instancesToCreate; i++) {
				await this.createInstanceIfMissing(recurringEvent, physicalInstances, nextDate);
				nextDate = getNextOccurrence(nextDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
			}

			if (generatePastEvents) {
				await this.ensurePastInstances(recurringEvent, physicalInstances, now);
			}

			this.scheduleRefresh();
		} catch (error) {
			console.error(
				`[RecurringEvents] ❌ Failed to ensure physical instances for ${data.recurringEvent.title}:`,
				error
			);
		}
	}

	private async createInstanceIfMissing(
		recurringEvent: NodeRecurringEvent,
		physicalInstances: Map<string, PhysicalInstance>,
		instanceDate: DateTime
	): Promise<void> {
		const dateKey = instanceDate.toISODate();
		if (!dateKey) return;

		const existing = physicalInstances.get(dateKey);
		if (existing) return;

		const filePath = await this.createPhysicalInstance(recurringEvent, instanceDate);
		if (filePath) {
			physicalInstances.set(dateKey, { filePath, instanceDate });
			this.instanceFileToRRuleId.set(filePath, recurringEvent.rRuleId);
		}
	}

	private async ensurePastInstances(
		recurringEvent: NodeRecurringEvent,
		physicalInstances: Map<string, PhysicalInstance>,
		now: DateTime
	): Promise<void> {
		const firstValidDate = findFirstValidStartDate(recurringEvent.rrules);

		let currentDate = firstValidDate;
		if (firstValidDate.hasSame(getStartDateTime(recurringEvent.rrules), "day")) {
			currentDate = getNextOccurrence(firstValidDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		while (currentDate <= now.startOf("day")) {
			await this.createInstanceIfMissing(recurringEvent, physicalInstances, currentDate);
			currentDate = getNextOccurrence(currentDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}
	}

	private async createPhysicalInstance(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime
	): Promise<string | null> {
		const lockKey = `${recurringEvent.rRuleId}-${instanceDate.toISODate()}`;
		const filePath = this.generateNodeInstanceFilePath(recurringEvent, instanceDate);

		return withLock(this.creationLocks, lockKey, async () => {
			// Check if file already exists - if so, skip creation
			if (this.app.vault.getAbstractFileByPath(filePath)) {
				return null;
			}

			// Re-check in-memory map (may have been populated since createInstanceIfMissing checked)
			const dateKey = instanceDate.toISODate();
			if (dateKey) {
				const data = this.recurringEventsMap.get(recurringEvent.rRuleId);
				const existing = data?.physicalInstances.get(dateKey);
				if (existing) {
					return null;
				}
			}

			// Lazy load content if not already loaded (deferred from initial scan)
			// Note: content can be empty string ("") which is valid, so check for undefined/null specifically
			let content = recurringEvent.content;
			if (content === undefined || content === null) {
				const sourceFile = getFileByPathOrThrow(this.app, recurringEvent.sourceFilePath);
				const fullContent = await this.app.vault.cachedRead(sourceFile);
				content = extractContentAfterFrontmatter(fullContent);
				recurringEvent.content = content;
			}

			const sourceFile = this.app.vault.getAbstractFileByPath(recurringEvent.sourceFilePath);
			const sourceLink = sourceFile instanceof TFile ? createFileLink(sourceFile) : undefined;
			const { instanceStart, instanceEnd } = this.calculateInstanceTimes(recurringEvent, instanceDate);

			const instanceFrontmatter = buildInstanceFrontmatter(recurringEvent.frontmatter, instanceDate, this.settings, {
				rRuleId: recurringEvent.rRuleId,
				sourceLink,
				instanceStart,
				instanceEnd,
				allDay: recurringEvent.rrules.allDay,
			});

			markInstanceStatusIfPast(instanceFrontmatter, this.settings, instanceStart, instanceEnd);

			const uniquePath = getUniqueFilePathFromFull(this.app, filePath);

			const file = await createFileAtPathAtomic(this.app, uniquePath, {
				...(content ? { content } : {}),
				frontmatter: instanceFrontmatter,
				...(this.settings.templatePath ? { templatePath: this.settings.templatePath } : {}),
			});

			// Don't notify here - let the batch operation handle notification
			// Individual file creations will be picked up by the indexer
			return file.path;
		});
	}

	private getNextOccurrenceFromTime(
		recurringEvent: NodeRecurringEvent,
		existingInstances: Array<PhysicalInstance>,
		fromDate: DateTime
	): DateTime {
		if (existingInstances.length > 0) {
			const sortedInstances = [...existingInstances].sort(
				(a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis()
			);
			const latestInstanceDate = sortedInstances[sortedInstances.length - 1].instanceDate;
			return getNextOccurrence(latestInstanceDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		const sourceDateTime = getStartDateTime(recurringEvent.rrules);
		const firstValidDate = findFirstValidStartDate(recurringEvent.rrules);

		let currentDate = firstValidDate;
		if (firstValidDate.hasSame(sourceDateTime, "day")) {
			currentDate = getNextOccurrence(firstValidDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		while (currentDate <= fromDate) {
			currentDate = getNextOccurrence(currentDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		return currentDate;
	}

	private generateNodeInstanceFilePath(recurringEvent: NodeRecurringEvent, instanceDate: DateTime): string {
		const dateStr = instanceDate.toFormat(DATE_FORMAT);
		const titleNoZettel = removeZettelId(recurringEvent.title);
		const zettelHash = hashRRuleIdToZettelFormat(recurringEvent.rRuleId);
		const base = sanitizeForFilename(`${titleNoZettel} ${dateStr}`, {
			style: "preserve",
		});
		const folder = this.settings.directory ? `${this.settings.directory}/` : "";
		return `${folder}${base}-${zettelHash}.md`;
	}

	// ─── Virtual Instance Generation ──────────────────────────────

	generateAllVirtualInstances(rangeStart: DateTime, rangeEnd: DateTime): CalendarEvent[] {
		const virtualEvents = Array.from(this.recurringEventsMap.values()).flatMap(
			({ recurringEvent, physicalInstances }) =>
				this.calculateVirtualOccurrencesInRange(recurringEvent, rangeStart, rangeEnd, physicalInstances).map(
					(occurrence) => this.createVirtualEvent(occurrence)
				)
		);
		return virtualEvents;
	}

	private calculateVirtualOccurrencesInRange(
		recurringEvent: NodeRecurringEvent | null,
		rangeStart: DateTime,
		rangeEnd: DateTime,
		physicalInstances: Map<string, PhysicalInstance>
	): NodeRecurringEventInstance[] {
		if (!recurringEvent) return [];

		// Don't generate virtual events if recurring event is disabled (skipped)
		if (recurringEvent.metadata.skip) {
			return [];
		}

		// Start virtual events AFTER the latest physical instance
		let virtualStartDate: DateTime;

		const instances = this.getPhysicalInstancesList(physicalInstances);

		if (instances.length > 0) {
			const latestPhysicalDate = instances.reduce((latest, current) =>
				current.instanceDate > latest.instanceDate ? current : latest
			).instanceDate;

			virtualStartDate = getNextOccurrence(
				latestPhysicalDate,
				recurringEvent.rrules.type,
				recurringEvent.rrules.weekdays
			);
		} else {
			const sourceDate = getStartDateTime(recurringEvent.rrules);
			virtualStartDate = getNextOccurrence(sourceDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		// Ensure we start at or after the range start
		while (virtualStartDate < rangeStart) {
			virtualStartDate = getNextOccurrence(
				virtualStartDate,
				recurringEvent.rrules.type,
				recurringEvent.rrules.weekdays
			);
		}

		// Generate virtual instances from virtualStartDate to rangeEnd
		const virtualInstances: NodeRecurringEventInstance[] = [];
		let currentDate = virtualStartDate;

		while (currentDate <= rangeEnd) {
			const filePath = this.generateNodeInstanceFilePath(recurringEvent, currentDate);
			virtualInstances.push({
				recurringEvent,
				instanceDate: currentDate,
				filePath,
				created: false,
			});
			currentDate = getNextOccurrence(currentDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		return virtualInstances;
	}

	private createVirtualEvent(occurrence: NodeRecurringEventInstance): CalendarEvent {
		const { recurringEvent, instanceDate } = occurrence;
		const { instanceStart, instanceEnd } = this.calculateInstanceTimes(recurringEvent, instanceDate);
		const isAllDay = recurringEvent.rrules.allDay;
		const start = toInternalISO(instanceStart);
		const { metadata } = recurringEvent;

		const baseEvent = {
			id: `${recurringEvent.rRuleId}-${instanceDate.toISODate()}`,
			ref: { filePath: recurringEvent.sourceFilePath },
			title: recurringEvent.title,
			start: start,
			isVirtual: true,
			skipped: false,
			metadata: {
				...metadata,
				// Override instance-specific fields
				rruleId: recurringEvent.rRuleId,
				instanceDate: instanceDate.toISODate() ?? undefined,
			},
			meta: {
				...recurringEvent.frontmatter,
				rruleId: recurringEvent.rRuleId,
			},
		};

		return isAllDay
			? {
					...baseEvent,
					type: "allDay" as const,
					allDay: true,
				}
			: {
					...baseEvent,
					type: "timed" as const,
					end: instanceEnd ? toInternalISO(instanceEnd) : "",
					allDay: false,
				};
	}

	private calculateInstanceTimes(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime
	): { instanceStart: DateTime; instanceEnd: DateTime | null } {
		const { rrules } = recurringEvent;
		const sourceStart = getStartDateTime(rrules);
		const sourceEnd = rrules.allDay ? null : rrules.endTime || null;

		const normalizedInstanceDate = rrules.allDay
			? DateTime.fromObject({
					year: instanceDate.year,
					month: instanceDate.month,
					day: instanceDate.day,
				})
			: instanceDate;

		const instanceStart = applySourceTimeToInstanceDate(normalizedInstanceDate, sourceStart);
		const instanceEnd = sourceEnd ? applySourceTimeToInstanceDate(normalizedInstanceDate, sourceEnd) : null;

		return { instanceStart, instanceEnd };
	}

	// ─── Public Query API ──────────────────────────────────────────

	getRecurringEventSeries(rruleId: string): RecurringEventSeries | null {
		const data = this.recurringEventsMap.get(rruleId);
		if (!data) return null;

		const instances = this.getPhysicalInstancesAsEvents(rruleId);

		if (data.recurringEvent) {
			const { title: sourceTitle, sourceFilePath, rrules, metadata } = data.recurringEvent;
			const rruleType = rrules.type;
			const rruleSpec = rrules.weekdays?.join(", ");
			const sourceCategory = this.getCategoryColor(metadata.categories);
			return { sourceTitle, sourceFilePath, instances, rruleType, rruleSpec, sourceCategory };
		}

		// Source event not yet associated — fall back to physical instance metadata
		if (instances.length === 0) return null;

		const firstInstance = instances[0];
		return {
			sourceTitle: firstInstance.event.title,
			sourceFilePath: firstInstance.event.ref.filePath,
			instances,
		};
	}

	getInstanceCountByRRuleId(rruleId: string): number {
		return this.getPhysicalInstancesAsEvents(rruleId).length;
	}

	getPhysicalInstancesAsEvents(rruleId: string): Array<{
		event: CalendarEvent;
		instanceDate: DateTime;
	}> {
		const physicalInstances = this.getPhysicalInstancesByRRuleId(rruleId);

		return physicalInstances
			.map((instance) => {
				const event = this.eventStore?.getEventByPath(instance.filePath);
				return event ? { event, instanceDate: instance.instanceDate } : null;
			})
			.filter((result): result is { event: CalendarEvent; instanceDate: DateTime } => result !== null);
	}

	getPhysicalInstancesByRRuleId(rruleId: string): PhysicalInstance[] {
		const data = this.recurringEventsMap.get(rruleId);
		return data ? this.getPhysicalInstancesList(data.physicalInstances) : [];
	}

	private getCategoryColor(categories: string[] | undefined): string {
		if (!categories || categories.length === 0 || !this.categoryTracker) {
			return this.settings.defaultNodeColor;
		}

		const categoryColor = this.categoryTracker.getCategoriesWithColors().find((c) => c.name === categories[0])?.color;

		return categoryColor || this.settings.defaultNodeColor;
	}

	getRRuleIdForSourcePath(sourceFilePath: string): string | null {
		return this.sourceFileToRRuleId.get(sourceFilePath) ?? null;
	}

	getAllRRuleIds(): string[] {
		return Array.from(this.recurringEventsMap.keys());
	}

	getAllRecurringEvents(): NodeRecurringEvent[] {
		return Array.from(this.recurringEventsMap.values())
			.filter((data) => !!data.recurringEvent)
			.map((data) => data.recurringEvent as NodeRecurringEvent);
	}

	getEnabledRecurringEvents(): NodeRecurringEvent[] {
		return Array.from(this.recurringEventsMap.values())
			.filter((data) => data.recurringEvent && !data.recurringEvent.metadata.skip)
			.map((data) => data.recurringEvent as NodeRecurringEvent);
	}

	getDisabledRecurringEvents(): NodeRecurringEvent[] {
		return Array.from(this.recurringEventsMap.values())
			.filter((data) => data.recurringEvent?.metadata.skip)
			.map((data) => data.recurringEvent as NodeRecurringEvent);
	}

	setEventStore(eventStore: EventStore): void {
		this.eventStore = eventStore;
	}

	setCategoryTracker(categoryTracker: CategoryTracker): void {
		this.categoryTracker = categoryTracker;
	}

	async deleteAllPhysicalInstances(rruleId: string): Promise<void> {
		const data = this.recurringEventsMap.get(rruleId);
		if (!data) return;

		const physicalInstances = this.getPhysicalInstancesList(data.physicalInstances);
		const filePaths = physicalInstances.map((instance) => instance.filePath);
		await deleteFilesByPaths(this.app, filePaths, this.settings.fileConcurrencyLimit);

		for (const filePath of filePaths) {
			this.instanceFileToRRuleId.delete(filePath);
		}
		data.physicalInstances.clear();
		this.scheduleRefresh();
	}

	// ─── Utilities ────────────────────────────────────────────────

	private getPhysicalInstancesList(physicalInstances: Map<string, PhysicalInstance>): PhysicalInstance[] {
		return Array.from(physicalInstances.values());
	}
}

// ─── Extracted Pure Helpers ──────────────────────────────────────

interface InstanceFrontmatterContext {
	rRuleId: string;
	sourceLink: string | undefined;
	instanceStart: DateTime;
	instanceEnd: DateTime | null;
	allDay: boolean | undefined;
}

export function buildInstanceFrontmatter(
	sourceFrontmatter: Frontmatter,
	instanceDate: DateTime,
	settings: SingleCalendarConfig,
	ctx: InstanceFrontmatterContext
): Frontmatter {
	const excludeProps = getRecurringInstanceExcludedProps(settings);
	const fm: Frontmatter = Object.fromEntries(
		Object.entries(sourceFrontmatter).filter(([key]) => !excludeProps.has(key))
	);

	fm[settings.rruleIdProp] = ctx.rRuleId;
	fm[settings.instanceDateProp] = instanceDate.toISODate();

	if (ctx.sourceLink) {
		fm[settings.sourceProp] = ctx.sourceLink;
	}

	if (ctx.allDay !== undefined) {
		fm[settings.allDayProp] = ctx.allDay;
	}

	const instanceStartISO = toInternalISO(ctx.instanceStart);
	const instanceEndISO = ctx.instanceEnd ? toInternalISO(ctx.instanceEnd) : undefined;
	if (instanceStartISO) {
		setEventBasics(fm, settings, {
			start: instanceStartISO,
			end: instanceEndISO,
			allDay: ctx.allDay,
		});
	}

	return fm;
}

/**
 * Marks past instances as Done at creation time when the setting is enabled.
 * Physical instances created by ensurePastInstances are always in the past;
 * setting Status here ensures they're correct immediately without relying on
 * the indexer (which may miss newly created files due to metadata cache delays).
 */
export function markInstanceStatusIfPast(
	frontmatter: Frontmatter,
	settings: SingleCalendarConfig,
	instanceStart: DateTime,
	instanceEnd: DateTime | null
): void {
	if (!settings.markPastInstancesAsDone || !settings.statusProperty) return;

	const now = DateTime.now();
	const isPast = instanceEnd && instanceEnd < now ? true : instanceStart < now;

	if (isPast && frontmatter[settings.statusProperty] !== settings.doneValue) {
		frontmatter[settings.statusProperty] = settings.doneValue;
	}
}
