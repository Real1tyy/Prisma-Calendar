import {
	calculateRecurringInstanceDateTime,
	getNextOccurrence,
	iterateOccurrencesInRange,
} from "@real1ty-obsidian-plugins/utils/date-recurrence-utils";
import { createFileLink } from "@real1ty-obsidian-plugins/utils/file-operations";
import { sanitizeForFilename } from "@real1ty-obsidian-plugins/utils/file-utils";
import { DateTime } from "luxon";
import type { App } from "obsidian";
import { TFile } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import type { NodeRecurringEvent, RRuleFrontmatter } from "../types/recurring-event";
import type { SingleCalendarConfig } from "../types/settings";
import { ChangeNotifier } from "../utils/change-notifier";
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
		for (const [rruleId, data] of this.recurringEventsMap.entries()) {
			try {
				await this.ensurePhysicalInstances(rruleId);
			} catch (error) {
				const eventTitle = data?.recurringEvent?.title || "Unknown Event";
				console.error(`❌ Failed to process recurring event ${eventTitle} (${rruleId}):`, error);
			}
		}
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
		const rruleId = event.source?.frontmatter[this.settings.rruleIdProp] as string;
		if (!rruleId) {
			return;
		}
		if (this.recurringEventsMap.delete(rruleId)) {
			this.notifyChange();
		} else {
			console.error(`❌ Failed to delete recurring event ${rruleId}`);
		}
	}

	private async ensurePhysicalInstances(rruleId: string): Promise<void> {
		const data = this.recurringEventsMap.get(rruleId);
		if (!data || !data.recurringEvent) return;

		try {
			const { recurringEvent, physicalInstances } = data;
			const now = DateTime.now();

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

		// No existing future instances. Find the first valid occurrence that is on or after today.
		const now = DateTime.now();
		let currentDate = this.findFirstValidStartDate(recurringEvent);

		while (currentDate < now.startOf("day")) {
			currentDate = getNextOccurrence(currentDate, recurringEvent.rrules.type, recurringEvent.rrules.weekdays);
		}
		return currentDate;
	}

	private async createPhysicalInstance(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime
	): Promise<string | null> {
		const filePath = this.generateNodeInstanceFilePath(recurringEvent, instanceDate);

		// Check if there's already a creation in progress for this file path
		const existingCreation = this.creationLocks.get(filePath);
		if (existingCreation) {
			// Wait for the existing creation to complete and return its result
			return await existingCreation;
		}

		// Create a new promise for this creation and store it in the locks map
		const creationPromise = this.doCreatePhysicalInstance(recurringEvent, instanceDate, filePath);
		this.creationLocks.set(filePath, creationPromise);

		try {
			const result = await creationPromise;
			return result;
		} finally {
			this.creationLocks.delete(filePath);
		}
	}

	private async doCreatePhysicalInstance(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime,
		filePath: string
	): Promise<string | null> {
		const dateStr = instanceDate.toFormat("yyyy-MM-dd");
		const instanceTitle = `${recurringEvent.title} ${dateStr}`;

		// Check if file already exists - if so, skip creation
		if (this.app.vault.getAbstractFileByPath(filePath)) {
			return null;
		}

		// Create the physical file with inherited content
		const file = await this.templateService.createFile({
			title: instanceTitle,
			targetDirectory: this.settings.directory,
			filename: filePath.split("/").pop()?.replace(".md", ""),
			content: recurringEvent.content,
		});

		// Set frontmatter with event data and instance metadata
		await this.app.fileManager.processFrontMatter(file, (fm) => {
			const excludeProps = new Set([
				this.settings.rruleProp,
				this.settings.rruleSpecProp,
				this.settings.startProp,
				this.settings.endProp,
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
			fm[this.settings.startProp] = instanceStart.toISO();

			if (instanceEnd) {
				fm[this.settings.endProp] = instanceEnd.toISO();
			}

			// Set all day property if specified
			if (recurringEvent.rrules.allDay !== undefined && this.settings.allDayProp) {
				fm[this.settings.allDayProp] = recurringEvent.rrules.allDay;
			}
		});

		// Notify that physical instances have changed
		this.notifyChange();
		return filePath;
	}

	async generateAllVirtualInstances(rangeStart: DateTime, rangeEnd: DateTime): Promise<ParsedEvent[]> {
		const virtualEvents = Array.from(this.recurringEventsMap.values()).flatMap(
			({ recurringEvent, physicalInstances }) =>
				this.calculateOccurrencesInRange(recurringEvent, rangeStart, rangeEnd, physicalInstances).map((occurrence) =>
					this.createVirtualEvent(occurrence)
				)
		);
		return virtualEvents;
	}

	private calculateOccurrencesInRange(
		recurringEvent: NodeRecurringEvent | null,
		rangeStart: DateTime,
		rangeEnd: DateTime,
		physicalInstances: Array<{ filePath: string; instanceDate: DateTime }>
	): NodeRecurringEventInstance[] {
		if (!recurringEvent) return [];
		const startDate = this.getStartDateTime(recurringEvent.rrules);

		// Create a Set of dates that have physical instances for quick lookup
		const physicalDates = new Set(physicalInstances.map((instance) => instance.instanceDate.toISODate()));

		return Array.from(iterateOccurrencesInRange(startDate, recurringEvent.rrules, rangeStart, rangeEnd))
			.filter((occurrenceDate) => !physicalDates.has(occurrenceDate.toISODate()))
			.map((occurrenceDate) => {
				const filePath = this.generateNodeInstanceFilePath(recurringEvent, occurrenceDate);
				return {
					recurringEvent,
					instanceDate: occurrenceDate,
					filePath,
					created: false,
				};
			});
	}

	private calculateInstanceTimes(
		recurringEvent: NodeRecurringEvent,
		instanceDate: DateTime
	): { instanceStart: DateTime; instanceEnd: DateTime | null } {
		const { rrules } = recurringEvent;
		const startDate = this.getStartDateTime(rrules);
		const originalEnd = rrules.allDay ? null : rrules.endTime || null;

		const instanceStart = calculateRecurringInstanceDateTime(instanceDate, startDate, rrules.type, rrules.allDay);

		const instanceEnd = originalEnd
			? calculateRecurringInstanceDateTime(instanceDate, originalEnd, rrules.type, rrules.allDay)
			: null;

		return { instanceStart, instanceEnd };
	}

	private createVirtualEvent(occurrence: NodeRecurringEventInstance): ParsedEvent {
		const { recurringEvent, instanceDate } = occurrence;
		const { instanceStart, instanceEnd } = this.calculateInstanceTimes(recurringEvent, instanceDate);

		return {
			id: `${recurringEvent.rRuleId}-${instanceDate.toISODate()}`,
			ref: { filePath: recurringEvent.sourceFilePath },
			title: recurringEvent.title,
			start: instanceStart.toISO() as string,
			end: instanceEnd ? (instanceEnd.toISO() as string) : undefined,
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
		const instanceTitle = `${recurringEvent.title} ${dateStr}`;
		const sanitizedTitle = sanitizeForFilename(instanceTitle);

		const folderPath = this.settings.directory ? `${this.settings.directory}/` : "";
		return `${folderPath}${sanitizedTitle}.md`;
	}
}
