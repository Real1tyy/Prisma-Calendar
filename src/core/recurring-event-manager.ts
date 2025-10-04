import { getNextOccurrence, iterateOccurrencesInRange } from "@real1ty-obsidian-plugins/utils/date-recurrence-utils";
import { createFileLink } from "@real1ty-obsidian-plugins/utils/file-operations";
import { sanitizeForFilename } from "@real1ty-obsidian-plugins/utils/file-utils";
import { generateZettelId } from "@real1ty-obsidian-plugins/utils/generate";
import { DateTime } from "luxon";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import type { NodeRecurringEvent, RRuleFrontmatter } from "../types/recurring-event";
import type { SingleCalendarConfig } from "../types/settings";
import { ChangeNotifier } from "../utils/change-notifier";
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

export interface RecurringEventData {
	recurringEvent: NodeRecurringEvent | null;
	physicalInstances: Array<{
		filePath: string;
		instanceDate: DateTime;
	}>;
}
export class RecurringEventManager extends ChangeNotifier {
	private settings: SingleCalendarConfig;
	private recurringEventsMap: Map<string, RecurringEventData> = new Map();
	private subscription: Subscription | null = null;
	private settingsSubscription: Subscription | null = null;
	private indexingCompleteSubscription: Subscription | null = null;
	private templateService: TemplateService;
	private indexingComplete = false;
	private creationLocks: Map<string, Promise<string | null>> = new Map();
	private sourceFileToRRuleId: Map<string, string> = new Map();

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>,
		private indexer: Indexer
	) {
		super();
		this.settings = settingsStore.value;
		this.templateService = new TemplateService(app, settingsStore);

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
						await this.ensurePhysicalInstances(event.recurringEvent.rRuleId);
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

	private async processAllRecurringEvents(): Promise<void> {
		await Promise.all(
			Array.from(this.recurringEventsMap.entries()).map(async ([rruleId, data]) => {
				try {
					await this.ensurePhysicalInstances(rruleId);
				} catch (error) {
					const eventTitle = data?.recurringEvent?.title || "Unknown Event";
					console.error(`❌ Failed to process recurring event ${eventTitle} (${rruleId}):`, error);
				}
			})
		);
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
	}

	private addRecurringEvent(recurringEvent: NodeRecurringEvent): void {
		const existingData = this.recurringEventsMap.get(recurringEvent.rRuleId);
		if (existingData) {
			existingData.recurringEvent = recurringEvent;
		} else {
			this.recurringEventsMap.set(recurringEvent.rRuleId, {
				recurringEvent,
				physicalInstances: [],
			});
		}
		this.sourceFileToRRuleId.set(recurringEvent.sourceFilePath, recurringEvent.rRuleId);
		this.notifyChange();
	}

	private async handleFileChanged(filePath: string, frontmatter: Record<string, unknown>): Promise<void> {
		const rruleId = frontmatter[this.settings.rruleIdProp] as string;
		const instanceDate = frontmatter.nodeRecurringInstanceDate as string;

		if (rruleId && instanceDate) {
			const parsedInstanceDate = DateTime.fromISO(instanceDate);
			if (parsedInstanceDate.isValid) {
				let recurringData = this.recurringEventsMap.get(rruleId);

				if (!recurringData) {
					recurringData = {
						recurringEvent: null, // Will be filled when recurring event is found
						physicalInstances: [],
					};
					this.recurringEventsMap.set(rruleId, recurringData);
				}

				// Check if this instance already exists (either same file path or same date)
				const existingIndex = recurringData.physicalInstances.findIndex(
					(instance) => instance.filePath === filePath || instance.instanceDate.equals(parsedInstanceDate)
				);

				const instance = {
					filePath,
					instanceDate: parsedInstanceDate,
				};

				if (existingIndex !== -1) {
					// Update existing instance
					recurringData.physicalInstances[existingIndex] = instance;
				} else {
					recurringData.physicalInstances.push(instance);
				}
				this.notifyChange();
			}
		}
	}

	private handleFileDeleted(event: IndexerEvent): void {
		const rruleId = this.sourceFileToRRuleId.get(event.filePath);

		if (rruleId) {
			this.recurringEventsMap.delete(rruleId);
			this.sourceFileToRRuleId.delete(event.filePath);
			this.notifyChange();
			return;
		}

		// Check if this is an instance file - search through all physical instances
		for (const [_rruleId, data] of this.recurringEventsMap.entries()) {
			const index = data.physicalInstances.findIndex((instance) => instance.filePath === event.filePath);
			if (index !== -1) {
				data.physicalInstances.splice(index, 1);
				this.notifyChange();
				return;
			}
		}
	}

	private async ensurePhysicalInstances(rruleId: string): Promise<void> {
		const data = this.recurringEventsMap.get(rruleId);
		if (!data || !data.recurringEvent) return;

		try {
			const { recurringEvent, physicalInstances } = data;
			const now = DateTime.now().toUTC();

			const futureInstances = physicalInstances.filter((instance) => instance.instanceDate >= now.startOf("day"));

			const targetInstanceCount = this.calculateTargetInstanceCount(recurringEvent);
			const currentCount = futureInstances.length;

			if (currentCount >= targetInstanceCount) {
				return;
			}

			const instancesToCreate = targetInstanceCount - currentCount;
			let nextDate = this.getNextOccurrenceFromNow(recurringEvent, futureInstances);

			for (let i = 0; i < instancesToCreate; i++) {
				const filePath = await this.createPhysicalInstance(recurringEvent, nextDate);

				if (filePath) {
					data.physicalInstances.push({
						filePath,
						instanceDate: nextDate,
					});
				}

				nextDate = getNextOccurrence(nextDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
			}
		} catch (error) {
			console.error(`❌ Failed to ensure physical instances for ${data.recurringEvent.title}:`, error);
		}
	}

	private calculateTargetInstanceCount(recurringEvent: NodeRecurringEvent): number {
		const intervals = this.settings.futureInstancesCount;
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
		// If we have existing future instances, start from the date after the latest one
		if (existingFutureInstances.length > 0) {
			// Sort by date and get the latest instance
			const sortedInstances = [...existingFutureInstances].sort(
				(a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis()
			);
			const latestInstanceDate = sortedInstances[sortedInstances.length - 1].instanceDate;
			return getNextOccurrence(latestInstanceDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		// No existing future instances. Find the first valid start date
		const now = DateTime.now().toUTC();
		const sourceDateTime = this.getStartDateTime(recurringEvent.rrules);
		const firstValidDate = this.findFirstValidStartDate(recurringEvent);

		// Only skip the first valid date if it equals the source date
		// (e.g., if source is Wednesday and rule includes Wednesday)
		let currentDate = firstValidDate;
		if (firstValidDate.hasSame(sourceDateTime, "day")) {
			// Skip the source date itself
			currentDate = getNextOccurrence(firstValidDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}

		// If the occurrence is still in the past, keep advancing until we reach today or later
		while (currentDate < now.startOf("day")) {
			currentDate = getNextOccurrence(currentDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}
		return currentDate;
	}

	private async createPhysicalInstance(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime
	): Promise<string | null> {
		// Use instance date + recurring event ID as lock key to prevent duplicate creation
		const lockKey = `${recurringEvent.rRuleId}-${instanceDate.toISODate()}`;

		// Check if there's already a creation in progress for this instance
		const existingCreation = this.creationLocks.get(lockKey);
		if (existingCreation) {
			// Wait for the existing creation to complete and return its result
			return await existingCreation;
		}

		// Generate filepath and create a new promise for this creation
		const filePath = this.generateNodeInstanceFilePath(recurringEvent, instanceDate);
		const creationPromise = this.doCreatePhysicalInstance(recurringEvent, instanceDate, filePath);
		this.creationLocks.set(lockKey, creationPromise);

		try {
			const result = await creationPromise;
			return result;
		} finally {
			this.creationLocks.delete(lockKey);
		}
	}

	private async doCreatePhysicalInstance(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime,
		filePath: string
	): Promise<string | null> {
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
			const fullContent = await this.app.vault.cachedRead(sourceFile as TFile); // already verified to be a TFile in indexer
			content = extractContentAfterFrontmatter(fullContent);
			recurringEvent.content = content;
		}

		// Create the physical file with inherited content
		const file = await this.templateService.createFile({
			title: filename,
			targetDirectory: this.settings.directory,
			filename: filename,
			content,
		});

		// Set frontmatter with event data and instance metadata
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			const excludeProps = new Set([
				this.settings.rruleProp,
				this.settings.rruleSpecProp,
				this.settings.startProp,
				this.settings.endProp,
				this.settings.dateProp,
				this.settings.allDayProp,
			]);

			for (const [key, value] of Object.entries(recurringEvent.frontmatter)) {
				if (!excludeProps.has(key)) {
					fm[key] = value;
				}
			}

			// Set instance-specific properties - CRITICAL for duplication detection
			fm[this.settings.rruleIdProp] = recurringEvent.rRuleId;
			fm.nodeRecurringInstanceDate = instanceDate.toISODate();

			const sourceFile = this.app.vault.getAbstractFileByPath(recurringEvent.sourceFilePath);
			if (sourceFile instanceof TFile) {
				fm[this.settings.sourceProp] = createFileLink(sourceFile);
			}

			const { instanceStart, instanceEnd } = this.calculateInstanceTimes(recurringEvent, instanceDate);

			// Set all day property if specified
			if (recurringEvent.rrules.allDay !== undefined) {
				fm[this.settings.allDayProp] = recurringEvent.rrules.allDay;
			}

			// Use appropriate date properties based on all-day status
			if (recurringEvent.rrules.allDay) {
				// ALL-DAY EVENT: Use dateProp only (date without time)
				fm[this.settings.dateProp] = instanceStart.toISODate();
				// Clear timed event properties
				delete fm[this.settings.startProp];
				delete fm[this.settings.endProp];
			} else {
				// TIMED EVENT: Use startProp/endProp
				fm[this.settings.startProp] = instanceStart.toISO();
				if (instanceEnd) {
					fm[this.settings.endProp] = instanceEnd.toISO();
				}
				// Clear all-day event property
				delete fm[this.settings.dateProp];
			}
		});

		// Notify that physical instances have changed
		this.notifyChange();
		return filePath;
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
		physicalInstances: Array<{ filePath: string; instanceDate: DateTime }>
	): NodeRecurringEventInstance[] {
		if (!recurringEvent) return [];

		// Start virtual events AFTER the latest physical instance
		let virtualStartDate: DateTime;

		if (physicalInstances.length > 0) {
			// Sort physical instances and get the latest one
			const sortedInstances = [...physicalInstances].sort(
				(a, b) => a.instanceDate.toMillis() - b.instanceDate.toMillis()
			);
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
		const sourceStart = this.getStartDateTime(rrules);
		const sourceEnd = rrules.allDay ? null : rrules.endTime || null;

		// For all-day events, preserve the date without timezone conversion
		// For timed events, ensure UTC timezone is used
		const normalizedInstanceDate = rrules.allDay
			? DateTime.fromObject(
					{
						year: instanceDate.year,
						month: instanceDate.month,
						day: instanceDate.day,
					},
					{ zone: "utc" }
				)
			: instanceDate;

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

		// Strip ZettelID from recurring event title and generate new one for this instance
		const titleWithoutZettel = recurringEvent.title.replace(/-\d{14}$/, "");
		const newZettelId = generateZettelId();
		const instanceTitle = `${titleWithoutZettel} ${dateStr}-${newZettelId}`;

		const sanitizedTitle = sanitizeForFilename(instanceTitle);

		const folderPath = this.settings.directory ? `${this.settings.directory}/` : "";
		return `${folderPath}${sanitizedTitle}.md`;
	}

	getPhysicalInstancesByRRuleId(rruleId: string): Array<{ filePath: string; instanceDate: DateTime }> {
		const data = this.recurringEventsMap.get(rruleId);
		return data?.physicalInstances || [];
	}

	getSourceEventPath(rruleId: string): string | null {
		const data = this.recurringEventsMap.get(rruleId);
		return data?.recurringEvent?.sourceFilePath || null;
	}

	getAllRRuleIds(): string[] {
		return Array.from(this.recurringEventsMap.keys());
	}
}
