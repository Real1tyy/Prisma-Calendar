import { createFileLink } from "@real1ty-obsidian-plugins/utils/file-operations";
import { DateTime } from "luxon";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import type { NodeRecurringEvent, RRuleFrontmatter } from "../types/recurring-event";
import type { SingleCalendarConfig } from "../types/settings";
import { withLock } from "../utils/async-lock";
import { hashRRuleIdToZettelFormat, removeZettelId } from "../utils/calendar-events";
import { getNextOccurrence, iterateOccurrencesInRange } from "../utils/date-recurrence";
import { DebouncedNotifier } from "../utils/debounced-notifier";
import { rebuildPhysicalInstanceFilename, sanitizeForFilename } from "../utils/file-utils";
import { applySourceTimeToInstanceDate } from "../utils/format";
import { extractContentAfterFrontmatter } from "../utils/obsidian";
import type { Indexer, IndexerEvent } from "./indexer";
import type { ParsedEvent } from "./parser";
import { TemplateService } from "./templates";

export interface NodeRecurringEventInstance {
	recurringEvent: NodeRecurringEvent;
	instanceDate: DateTime;
	filePath: string;
	created: boolean;
}

export interface PhysicalInstance {
	filePath: string;
	instanceDate: DateTime;
}

export interface RecurringEventData {
	recurringEvent: NodeRecurringEvent | null;
	physicalInstances: Map<string, PhysicalInstance>;
}
export class RecurringEventManager extends DebouncedNotifier {
	private settings: SingleCalendarConfig;
	private recurringEventsMap: Map<string, RecurringEventData> = new Map();
	private subscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private templateService: TemplateService;
	private indexingComplete = false;
	private creationLocks: Map<string, Promise<string | null>> = new Map();
	private sourceFileToRRuleId: Map<string, string> = new Map();
	private ensureInstancesLocks: Map<string, Promise<void>> = new Map();

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private indexer: Indexer
	) {
		super();
		this.settings = settingsStore.value;
		this.templateService = new TemplateService(app, settingsStore, indexer);

		this.settingsSubscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});
		this.indexingCompleteSubscription = this.indexer.indexingComplete$.subscribe(async (isComplete) => {
			this.indexingComplete = isComplete;
			if (isComplete) {
				await this.processAllRecurringEvents();
			}
		});
		this.subscription = this.indexer.events$.subscribe((event: IndexerEvent) => {
			this.handleIndexerEvent(event);
		});
	}

	private async handleIndexerEvent(event: IndexerEvent): Promise<void> {
		switch (event.type) {
			case "recurring-event-found":
				if (event.recurringEvent) {
					this.addRecurringEvent(event.recurringEvent);
					if (this.indexingComplete) {
						await this.ensurePhysicalInstancesWithLock(event.recurringEvent.rRuleId);
						// Check if this is a rename (oldPath exists)
						if (event.oldPath) {
							await this.handleRecurringEventRenamedWithLock(event.recurringEvent);
						}
					}
				}
				break;
			case "file-changed":
				if (event.source) {
					await this.handleFileChanged(event.filePath, event.source.frontmatter);
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
		this.templateService.destroy();
		this.recurringEventsMap.clear();
		this.creationLocks.clear();
		this.sourceFileToRRuleId.clear();
		this.ensureInstancesLocks.clear();
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

	private async handleFileChanged(filePath: string, frontmatter: Record<string, unknown>): Promise<void> {
		const rruleId = frontmatter[this.settings.rruleIdProp] as string;
		const instanceDate = frontmatter.nodeRecurringInstanceDate as string;

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
		for (const [_rruleId, data] of this.recurringEventsMap.entries()) {
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

			const futureInstances = Array.from(physicalInstances.values()).filter(
				(instance) => instance.instanceDate >= now.startOf("day")
			);

			const targetInstanceCount = this.calculateTargetInstanceCount(recurringEvent);
			const currentCount = futureInstances.length;

			if (currentCount >= targetInstanceCount) {
				return;
			}

			const instancesToCreate = targetInstanceCount - currentCount;
			let nextDate = this.getNextOccurrenceFromNow(recurringEvent, futureInstances);

			for (let i = 0; i < instancesToCreate; i++) {
				const dateKey = nextDate.toISODate();

				// CRITICAL: Check if instance for this date already exists before creating
				if (dateKey && !physicalInstances.has(dateKey)) {
					const filePath = await this.createPhysicalInstance(recurringEvent, nextDate);

					if (filePath) {
						physicalInstances.set(dateKey, {
							filePath,
							instanceDate: nextDate,
						});
					}
				}

				nextDate = getNextOccurrence(nextDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
			}
			this.scheduleRefresh();
		} catch (error) {
			console.error(`❌ Failed to ensure physical instances for ${data.recurringEvent.title}:`, error);
		}
	}

	private calculateTargetInstanceCount(recurringEvent: NodeRecurringEvent): number {
		// Check for per-event override in frontmatter
		const overrideValue = recurringEvent.frontmatter[this.settings.futureInstancesCountProp];
		const intervals =
			typeof overrideValue === "number" && overrideValue > 0 ? overrideValue : this.settings.futureInstancesCount;

		const { type, weekdays } = recurringEvent.rrules;

		if (type === "weekly" || type === "bi-weekly") {
			return (weekdays?.length || 1) * intervals;
		}
		return intervals;
	}

	private getStartDateTime(rrules: RRuleFrontmatter): DateTime {
		return rrules.allDay ? rrules.date! : rrules.startTime!;
	}

	private findFirstValidStartDate(recurringEvent: NodeRecurringEvent): DateTime {
		const { rrules } = recurringEvent;
		const startDateTime = this.getStartDateTime(rrules);

		// For weekly/bi-weekly, the start date might not match the weekday rule.
		// We must find the first date that IS a valid weekday on or after the start time.
		if ((rrules.type === "weekly" || rrules.type === "bi-weekly") && rrules.weekdays?.length) {
			// Use the iterator to find the true first occurrence.
			const iterator = iterateOccurrencesInRange(
				startDateTime,
				rrules,
				startDateTime, // Start searching from the start time
				startDateTime.plus({ years: 1 }) // Search a year ahead
			);
			const result = iterator.next();
			// If the iterator finds a value, that's our true start. Otherwise, fall back to the original start time.
			if (!result.done) {
				return result.value;
			}
		}

		// For all other types (daily, monthly, etc.), the start time IS the first occurrence.
		return startDateTime;
	}

	private getNextOccurrenceFromNow(
		recurringEvent: NodeRecurringEvent,
		existingFutureInstances: Array<{ filePath: string; instanceDate: DateTime }>
	): DateTime {
		if (existingFutureInstances.length > 0) {
			const sortedInstances = [...existingFutureInstances].sort(
				(a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis()
			);
			const latestInstanceDate = sortedInstances[sortedInstances.length - 1].instanceDate;
			return getNextOccurrence(latestInstanceDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		const now = DateTime.now().toUTC();
		const sourceDateTime = this.getStartDateTime(recurringEvent.rrules);
		const firstValidDate = this.findFirstValidStartDate(recurringEvent);

		let currentDate = firstValidDate;
		if (firstValidDate.hasSame(sourceDateTime, "day")) {
			currentDate = getNextOccurrence(firstValidDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		while (currentDate <= now.startOf("day")) {
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

			// Extract the instance title from the filename (already has ZettelID from generateNodeInstanceFilePath)
			const filename = filePath.split("/").pop()?.replace(".md", "") || "";

			// Lazy load content if not already loaded (deferred from initial scan)
			let content = recurringEvent.content;
			if (!content) {
				const sourceFile = this.app.vault.getAbstractFileByPath(recurringEvent.sourceFilePath);
				const fullContent = await this.app.vault.cachedRead(sourceFile as TFile);
				content = extractContentAfterFrontmatter(fullContent);
				recurringEvent.content = content;
			}

			// Build frontmatter for the instance
			const excludeProps = new Set([
				this.settings.rruleProp,
				this.settings.rruleSpecProp,
				this.settings.startProp,
				this.settings.endProp,
				this.settings.dateProp,
				this.settings.allDayProp,
				this.settings.alreadyNotifiedProp, // Don't copy notification status - each instance needs its own notification
				"_Archived", // Don't copy _Archived property from source to instances
			]);

			const instanceFrontmatter: Record<string, unknown> = {};

			// Copy non-excluded properties from source
			for (const [key, value] of Object.entries(recurringEvent.frontmatter)) {
				if (!excludeProps.has(key)) {
					instanceFrontmatter[key] = value;
				}
			}

			// Set instance-specific properties - CRITICAL for duplication detection
			instanceFrontmatter[this.settings.rruleIdProp] = recurringEvent.rRuleId;
			instanceFrontmatter.nodeRecurringInstanceDate = instanceDate.toISODate();

			const sourceFile = this.app.vault.getAbstractFileByPath(recurringEvent.sourceFilePath);
			if (sourceFile instanceof TFile) {
				instanceFrontmatter[this.settings.sourceProp] = createFileLink(sourceFile);
			}

			const { instanceStart, instanceEnd } = this.calculateInstanceTimes(recurringEvent, instanceDate);

			// Set all day property if specified
			if (recurringEvent.rrules.allDay !== undefined) {
				instanceFrontmatter[this.settings.allDayProp] = recurringEvent.rrules.allDay;
			}

			// Use appropriate date properties based on all-day status
			if (recurringEvent.rrules.allDay) {
				instanceFrontmatter[this.settings.dateProp] = instanceStart.toISODate();
			} else {
				instanceFrontmatter[this.settings.startProp] = instanceStart.toUTC().toISO();
				if (instanceEnd) {
					instanceFrontmatter[this.settings.endProp] = instanceEnd.toUTC().toISO();
				}
			}

			await this.templateService.createFile({
				title: filename,
				targetDirectory: this.settings.directory,
				filename: filename,
				content,
				frontmatter: instanceFrontmatter,
			});

			// Don't notify here - let the batch operation handle notification
			// Individual file creations will be picked up by the indexer
			return filePath;
		});
	}

	async generateAllVirtualInstances(rangeStart: DateTime, rangeEnd: DateTime): Promise<ParsedEvent[]> {
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

		// Start virtual events AFTER the latest physical instance
		let virtualStartDate: DateTime;

		if (physicalInstances.size > 0) {
			// Sort physical instances and get the latest one
			const instancesArray = Array.from(physicalInstances.values());
			const sortedInstances = instancesArray.sort((a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis());
			const latestPhysicalDate = sortedInstances[sortedInstances.length - 1].instanceDate;

			// Start from the next occurrence after the latest physical instance
			virtualStartDate = getNextOccurrence(
				latestPhysicalDate,
				recurringEvent.rrules.type,
				recurringEvent.rrules.weekdays
			);
		} else {
			// No physical instances, start from the first valid date after source
			const sourceDate = this.getStartDateTime(recurringEvent.rrules);
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
		const sourceStart = this.getStartDateTime(rrules).toUTC();
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
		const base = sanitizeForFilename(`${titleNoZettel} ${dateStr}`);
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
}
