import {
	createFileLink,
	createFileManually,
	DebouncedNotifier,
	extractContentAfterFrontmatter,
	type FrontmatterDiff,
	FrontmatterPropagationModal,
	getUniqueFilePathFromFull,
	mergeFrontmatterDiffs,
	rebuildPhysicalInstanceFilename,
	sanitizeForFilename,
	withLock,
} from "@real1ty-obsidian-plugins/utils";
import { DateTime } from "luxon";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import type { Frontmatter } from "../types";
import type { NodeRecurringEvent } from "../types/recurring-event";
import type { SingleCalendarConfig } from "../types/settings";
import {
	applyFrontmatterChangesToInstance,
	filterExcludedPropsFromDiff,
	getRecurringInstanceExcludedProps,
	hashRRuleIdToZettelFormat,
	removeZettelId,
	setEventBasics,
} from "../utils/calendar-events";
import { getNextOccurrence } from "../utils/date-recurrence";
import { applySourceTimeToInstanceDate } from "../utils/format";
import { deleteFilesByPaths } from "../utils/obsidian";
import { calculateTargetInstanceCount, findFirstValidStartDate, getStartDateTime } from "../utils/recurring-utils";
import type { Indexer, IndexerEvent } from "./indexer";
import type { ParsedEvent } from "./parser";

interface NodeRecurringEventInstance {
	recurringEvent: NodeRecurringEvent;
	instanceDate: DateTime;
	filePath: string;
	created: boolean;
}

interface PhysicalInstance {
	filePath: string;
	instanceDate: DateTime;
	ignored?: boolean;
}

interface RecurringEventData {
	recurringEvent: NodeRecurringEvent | null;
	physicalInstances: Map<string, PhysicalInstance>;
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
	private ensureInstancesLocks: Map<string, Promise<void>> = new Map();
	private propagationDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
	private accumulatedDiffs: Map<string, FrontmatterDiff[]> = new Map();

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private indexer: Indexer
	) {
		super();
		this.settings = settingsStore.value;

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

	private async handleIndexerEvent(event: IndexerEvent): Promise<void> {
		switch (event.type) {
			case "recurring-event-found":
				if (event.recurringEvent) {
					this.addRecurringEvent(event.recurringEvent);
					if (this.indexingComplete) {
						await this.ensurePhysicalInstancesWithLock(event.recurringEvent.rRuleId);
						if (event.oldPath) {
							await this.handleRecurringEventRenamedWithLock(event.recurringEvent);
						}
						this.handleFrontmatterPropagation(event.recurringEvent, event.frontmatterDiff);
					}
				}
				break;
			case "file-changed":
				if (event.source) {
					this.handleFileChanged(event.filePath, event.source.frontmatter);
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

		await Promise.all(
			Array.from(data.physicalInstances.values()).map((instance) =>
				this.renamePhysicalInstance(instance, recurringEvent.title)
			)
		);
	}

	private async renamePhysicalInstance(instance: PhysicalInstance, newTitle: string): Promise<void> {
		try {
			const file = this.app.vault.getAbstractFileByPath(instance.filePath);
			if (!(file instanceof TFile)) {
				console.warn(`Physical instance file not found: ${instance.filePath}`);
				return;
			}

			const newBasename = rebuildPhysicalInstanceFilename(file.basename, newTitle);
			if (!newBasename) {
				console.warn(`Could not rebuild filename for physical instance: ${file.basename}`);
				return;
			}

			const folderPath = file.parent?.path ? `${file.parent.path}/` : "";
			const newPath = `${folderPath}${newBasename}.md`;
			await this.app.fileManager.renameFile(file, newPath);
			instance.filePath = newPath;
		} catch (error) {
			console.error(`Error renaming physical instance ${instance.filePath}:`, error);
		}
	}

	private handleFrontmatterPropagation(recurringEvent: NodeRecurringEvent, frontmatterDiff?: FrontmatterDiff): void {
		if (!this.settings.propagateFrontmatterToInstances && !this.settings.askBeforePropagatingFrontmatter) {
			return;
		}

		const data = this.recurringEventsMap.get(recurringEvent.rRuleId);
		if (!data || data.physicalInstances.size === 0 || !frontmatterDiff?.hasChanges) {
			return;
		}

		const existingTimer = this.propagationDebounceTimers.get(recurringEvent.rRuleId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const existingDiffs = this.accumulatedDiffs.get(recurringEvent.rRuleId) || [];
		existingDiffs.push(frontmatterDiff);
		this.accumulatedDiffs.set(recurringEvent.rRuleId, existingDiffs);

		const timer = setTimeout(() => {
			this.propagationDebounceTimers.delete(recurringEvent.rRuleId);
			const diffs = this.accumulatedDiffs.get(recurringEvent.rRuleId) || [];
			this.accumulatedDiffs.delete(recurringEvent.rRuleId);

			const mergedDiff = mergeFrontmatterDiffs(diffs);
			const filteredDiff = filterExcludedPropsFromDiff(mergedDiff, this.settings);

			if (!filteredDiff.hasChanges) {
				return;
			}

			if (this.settings.propagateFrontmatterToInstances) {
				void this.propagateFrontmatterToInstances(recurringEvent, filteredDiff);
			} else if (this.settings.askBeforePropagatingFrontmatter) {
				new FrontmatterPropagationModal(this.app, {
					eventTitle: recurringEvent.title,
					diff: filteredDiff,
					instanceCount: data.physicalInstances.size,
					onConfirm: () => this.propagateFrontmatterToInstances(recurringEvent, filteredDiff),
				}).open();
			}
		}, this.settings.propagationDebounceMs);

		this.propagationDebounceTimers.set(recurringEvent.rRuleId, timer);
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

		await Promise.all(
			Array.from(data.physicalInstances.values()).map((instance) =>
				applyFrontmatterChangesToInstance(
					this.app,
					instance.filePath,
					recurringEvent.frontmatter,
					frontmatterDiff,
					this.settings
				)
			)
		);
	}

	private async processAllRecurringEvents(): Promise<void> {
		await Promise.all(
			Array.from(this.recurringEventsMap.entries()).map(async ([rruleId, data]) => {
				try {
					await this.ensurePhysicalInstancesWithLock(rruleId);
				} catch (error) {
					const eventTitle = data?.recurringEvent?.title || "Unknown Event";
					console.error(`❌ Failed to process recurring event ${eventTitle} (${rruleId}):`, error);
				}
			})
		);

		// Force immediate notification after all recurring events are processed
		this.flushPendingRefresh();
	}

	destroy(): void {
		this.subscription?.unsubscribe();
		this.subscription = null;
		this.settingsSubscription?.unsubscribe();
		this.settingsSubscription = null;
		this.indexingCompleteSubscription?.unsubscribe();
		this.indexingCompleteSubscription = null;
		super.destroy();
		this.recurringEventsMap.clear();
		this.creationLocks.clear();
		this.sourceFileToRRuleId.clear();
		this.ensureInstancesLocks.clear();
		for (const timer of this.propagationDebounceTimers.values()) {
			clearTimeout(timer);
		}
		this.propagationDebounceTimers.clear();
		this.accumulatedDiffs.clear();
	}

	/**
	 * Clears all internal state without notifying subscribers.
	 * Used during resync to avoid triggering a refresh before new data is loaded.
	 */
	clearWithoutNotify(): void {
		this.recurringEventsMap.clear();
		this.sourceFileToRRuleId.clear();
		// Keep locks intact to prevent race conditions during resync
	}

	private addRecurringEvent(recurringEvent: NodeRecurringEvent): void {
		// CRITICAL: Check if this source file already has an RRuleID
		const existingRRuleId = this.sourceFileToRRuleId.get(recurringEvent.sourceFilePath);

		if (existingRRuleId && existingRRuleId !== recurringEvent.rRuleId) {
			// RACE CONDITION DETECTED: Same source file with different RRuleID
			// Merge into existing entry using the first RRuleID
			const existingData = this.recurringEventsMap.get(existingRRuleId);
			if (existingData) {
				existingData.recurringEvent = recurringEvent;
			}

			// Don't create a new entry for the duplicate RRuleID
			return;
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

	private handleFileChanged(filePath: string, frontmatter: Frontmatter): void {
		const rruleId = frontmatter[this.settings.rruleIdProp] as string;
		const instanceDate = frontmatter[this.settings.instanceDateProp] as string;
		const isIgnored = frontmatter[this.settings.ignoreRecurringProp] === true;

		if (rruleId && instanceDate) {
			const parsedInstanceDate = DateTime.fromISO(instanceDate, { zone: "utc" });
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
					recurringData.physicalInstances.set(dateKey, {
						filePath,
						instanceDate: parsedInstanceDate,
						ignored: isIgnored,
					});
					this.scheduleRefresh();
				}
			}
		}
	}

	private handleFileDeleted(event: IndexerEvent): void {
		const rruleId = this.sourceFileToRRuleId.get(event.filePath);

		if (rruleId) {
			this.recurringEventsMap.delete(rruleId);
			this.sourceFileToRRuleId.delete(event.filePath);
			this.scheduleRefresh();
			return;
		}

		// Check if this is an instance file - search through all physical instances
		for (const data of this.recurringEventsMap.values()) {
			// Find and delete the instance by filePath
			for (const [dateKey, instance] of data.physicalInstances.entries()) {
				if (instance.filePath === event.filePath) {
					data.physicalInstances.delete(dateKey);
					this.scheduleRefresh();
					return;
				}
			}
		}
	}

	private async ensurePhysicalInstancesWithLock(rruleId: string): Promise<void> {
		return withLock(this.ensureInstancesLocks, rruleId, () => this.ensurePhysicalInstances(rruleId));
	}

	private async ensurePhysicalInstances(rruleId: string): Promise<void> {
		const data = this.recurringEventsMap.get(rruleId);
		if (!data || !data.recurringEvent) return;

		try {
			const { recurringEvent, physicalInstances } = data;

			const isSkipped = recurringEvent.frontmatter[this.settings.skipProp] === true;
			if (isSkipped) {
				return;
			}

			const now = DateTime.now().toUTC();
			const generatePastEvents = recurringEvent.frontmatter[this.settings.generatePastEventsProp] === true;

			const futureInstances = Array.from(physicalInstances.values()).filter(
				(instance) => instance.instanceDate >= now.startOf("day") && !instance.ignored
			);

			const targetInstanceCount = calculateTargetInstanceCount(
				recurringEvent.rrules,
				recurringEvent.frontmatter[this.settings.futureInstancesCountProp],
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
			console.error(`❌ Failed to ensure physical instances for ${data.recurringEvent.title}:`, error);
		}
	}

	private async createInstanceIfMissing(
		recurringEvent: NodeRecurringEvent,
		physicalInstances: Map<string, PhysicalInstance>,
		instanceDate: DateTime
	): Promise<void> {
		const dateKey = instanceDate.toISODate();

		if (dateKey && !physicalInstances.has(dateKey)) {
			const filePath = await this.createPhysicalInstance(recurringEvent, instanceDate);

			if (filePath) {
				physicalInstances.set(dateKey, {
					filePath,
					instanceDate,
				});
			}
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

		while (currentDate < now.startOf("day")) {
			await this.createInstanceIfMissing(recurringEvent, physicalInstances, currentDate);
			currentDate = getNextOccurrence(currentDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}
	}

	private getNextOccurrenceFromTime(
		recurringEvent: NodeRecurringEvent,
		existingInstances: Array<PhysicalInstance>,
		fromDate: DateTime
	): DateTime {
		const nonIgnoredInstances = existingInstances.filter((instance) => !instance.ignored);

		if (nonIgnoredInstances.length > 0) {
			const sortedInstances = [...nonIgnoredInstances].sort(
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

			// Lazy load content if not already loaded (deferred from initial scan)
			// Note: content can be empty string ("") which is valid, so check for undefined/null specifically
			let content = recurringEvent.content;
			if (content === undefined || content === null) {
				const sourceFile = this.app.vault.getAbstractFileByPath(recurringEvent.sourceFilePath);
				if (!(sourceFile instanceof TFile)) {
					console.error(
						`Source file not found: ${recurringEvent.sourceFilePath}, this shouldn't happen, please report this as an issue.`
					);
					return null;
				}
				const fullContent = await this.app.vault.cachedRead(sourceFile);
				content = extractContentAfterFrontmatter(fullContent);
				recurringEvent.content = content;
			}

			// Build frontmatter for the instance
			const excludeProps = getRecurringInstanceExcludedProps(this.settings);

			const instanceFrontmatter: Frontmatter = {};

			// Copy non-excluded properties from source
			for (const [key, value] of Object.entries(recurringEvent.frontmatter)) {
				if (!excludeProps.has(key)) {
					instanceFrontmatter[key] = value;
				}
			}

			// Set instance-specific properties - CRITICAL for duplication detection
			instanceFrontmatter[this.settings.rruleIdProp] = recurringEvent.rRuleId;
			instanceFrontmatter[this.settings.instanceDateProp] = instanceDate.toISODate();

			const sourceFile = this.app.vault.getAbstractFileByPath(recurringEvent.sourceFilePath);
			if (sourceFile instanceof TFile) {
				instanceFrontmatter[this.settings.sourceProp] = createFileLink(sourceFile);
			}

			const { instanceStart, instanceEnd } = this.calculateInstanceTimes(recurringEvent, instanceDate);

			// Set all day property if specified
			if (recurringEvent.rrules.allDay !== undefined) {
				instanceFrontmatter[this.settings.allDayProp] = recurringEvent.rrules.allDay;
			}

			const instanceStartISO = instanceStart.toUTC().toISO();
			const instanceEndISO = instanceEnd ? (instanceEnd.toUTC().toISO() ?? undefined) : undefined;
			if (instanceStartISO) {
				setEventBasics(instanceFrontmatter, this.settings, {
					start: instanceStartISO,
					end: instanceEndISO,
					allDay: recurringEvent.rrules.allDay,
				});
			}

			const uniquePath = getUniqueFilePathFromFull(this.app, filePath);
			const directory = this.settings.directory || "";
			const finalFilename = uniquePath.replace(`${directory}/`, "").replace(/\.md$/, "");

			const file = await createFileManually(this.app, directory, finalFilename, content, instanceFrontmatter);

			// Don't notify here - let the batch operation handle notification
			// Individual file creations will be picked up by the indexer
			return file.path;
		});
	}

	generateAllVirtualInstances(rangeStart: DateTime, rangeEnd: DateTime): ParsedEvent[] {
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
		const isSkipped = recurringEvent.frontmatter[this.settings.skipProp] === true;
		if (isSkipped) {
			return [];
		}

		// Start virtual events AFTER the latest non-ignored physical instance
		let virtualStartDate: DateTime;

		// Filter out ignored instances (duplicated recurring events) when determining virtual event start
		const nonIgnoredInstances = Array.from(physicalInstances.values()).filter((instance) => !instance.ignored);

		if (nonIgnoredInstances.length > 0) {
			// Sort physical instances and get the latest one
			const sortedInstances = nonIgnoredInstances.sort((a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis());
			const latestPhysicalDate = sortedInstances[sortedInstances.length - 1].instanceDate;

			// Start from the next occurrence after the latest non-ignored physical instance
			virtualStartDate = getNextOccurrence(
				latestPhysicalDate,
				recurringEvent.rrules.type,
				recurringEvent.rrules.weekdays
			);
		} else {
			// No non-ignored physical instances, start from the first valid date after source
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

	private calculateInstanceTimes(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime
	): { instanceStart: DateTime; instanceEnd: DateTime | null } {
		const { rrules } = recurringEvent;
		const sourceStart = getStartDateTime(rrules).toUTC();
		const sourceEnd = rrules.allDay ? null : rrules.endTime?.toUTC() || null;

		const normalizedInstanceDate = rrules.allDay
			? DateTime.fromObject(
					{
						year: instanceDate.year,
						month: instanceDate.month,
						day: instanceDate.day,
					},
					{ zone: "utc" }
				)
			: instanceDate.toUTC();

		const instanceStart = applySourceTimeToInstanceDate(normalizedInstanceDate, sourceStart);
		const instanceEnd = sourceEnd ? applySourceTimeToInstanceDate(normalizedInstanceDate, sourceEnd) : null;

		return { instanceStart, instanceEnd };
	}

	private createVirtualEvent(occurrence: NodeRecurringEventInstance): ParsedEvent {
		const { recurringEvent, instanceDate } = occurrence;
		const { instanceStart, instanceEnd } = this.calculateInstanceTimes(recurringEvent, instanceDate);

		return {
			id: `${recurringEvent.rRuleId}-${instanceDate.toISODate()}`,
			ref: { filePath: recurringEvent.sourceFilePath },
			title: recurringEvent.title,
			start: instanceStart.toISO({ suppressMilliseconds: true }) || "",
			end: instanceEnd ? instanceEnd.toISO({ suppressMilliseconds: true }) || "" : undefined,
			allDay: recurringEvent.rrules.allDay,
			isVirtual: true,
			skipped: false,
			meta: {
				...recurringEvent.frontmatter,
				rruleId: recurringEvent.rRuleId,
			},
		};
	}

	private generateNodeInstanceFilePath(recurringEvent: NodeRecurringEvent, instanceDate: DateTime): string {
		const dateStr = instanceDate.toFormat("yyyy-MM-dd");
		const titleNoZettel = removeZettelId(recurringEvent.title);
		const zettelHash = hashRRuleIdToZettelFormat(recurringEvent.rRuleId);
		const base = sanitizeForFilename(`${titleNoZettel} ${dateStr}`, { style: "preserve" });
		const folder = this.settings.directory ? `${this.settings.directory}/` : "";
		return `${folder}${base}-${zettelHash}.md`;
	}

	getPhysicalInstancesByRRuleId(rruleId: string): PhysicalInstance[] {
		const data = this.recurringEventsMap.get(rruleId);
		return data ? Array.from(data.physicalInstances.values()) : [];
	}

	getSourceEventPath(rruleId: string): string | null {
		const data = this.recurringEventsMap.get(rruleId);
		return data?.recurringEvent?.sourceFilePath || null;
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
			.filter((data) => data.recurringEvent && data.recurringEvent.frontmatter[this.settings.skipProp] !== true)
			.map((data) => data.recurringEvent as NodeRecurringEvent);
	}

	getDisabledRecurringEvents(): NodeRecurringEvent[] {
		const disabledEvents: NodeRecurringEvent[] = [];

		// Iterate through the already-tracked recurring events
		for (const data of this.recurringEventsMap.values()) {
			if (!data.recurringEvent) continue;

			// Check if this recurring event is disabled (skipped)
			const isSkipped = data.recurringEvent.frontmatter[this.settings.skipProp] === true;
			if (isSkipped) {
				disabledEvents.push(data.recurringEvent);
			}
		}

		return disabledEvents;
	}

	async deleteAllPhysicalInstances(rruleId: string): Promise<void> {
		const data = this.recurringEventsMap.get(rruleId);
		if (!data) return;

		const physicalInstances = Array.from(data.physicalInstances.values());
		const filePaths = physicalInstances.map((instance) => instance.filePath);
		await deleteFilesByPaths(this.app, filePaths);

		data.physicalInstances.clear();
		this.scheduleRefresh();
	}
}
