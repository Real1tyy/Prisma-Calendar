import { FilterEvaluator, getFilenameFromPath, removeMarkdownExtension } from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";
import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { v5 as uuidv5 } from "uuid";
import { PRISMA_CALENDAR_NAMESPACE } from "../constants";
import type { AllDayEvent, CalendarEvent, TimedEvent } from "../types/calendar";
import type { EventMetadata } from "../types/event";
import { convertToISO, parseEventFrontmatter } from "../types/event";
import type { Frontmatter, ISO, SingleCalendarConfig } from "../types/index";

import { applyDateNormalizationToFile, getEventName } from "../utils/calendar-events";
import type { RawEventSource } from "./indexer";

export class Parser {
	private settings: SingleCalendarConfig;
	private subscription: Subscription | null = null;
	private filterEvaluator: FilterEvaluator<SingleCalendarConfig>;

	constructor(
		private app: App,
		settingsStore: BehaviorSubject<SingleCalendarConfig>
	) {
		this.app = app;
		this.settings = settingsStore.value;
		this.filterEvaluator = new FilterEvaluator<SingleCalendarConfig>(settingsStore);
		this.subscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});
	}

	destroy(): void {
		this.subscription?.unsubscribe();
	}

	parseEventSource(source: RawEventSource): CalendarEvent | null {
		const { filePath, frontmatter, metadata } = source;

		if (!this.filterEvaluator.evaluateFilters(frontmatter)) {
			return null;
		}

		const id = uuidv5(filePath, PRISMA_CALENDAR_NAMESPACE);

		const result = parseEventFrontmatter(frontmatter, this.settings);
		if (!result) {
			return null;
		}

		const { datetime: parsed } = result;

		const title =
			getEventName(this.settings.titleProp, frontmatter, filePath, this.settings.calendarTitleProp) ||
			removeMarkdownExtension(getFilenameFromPath(filePath));

		return parsed.allDay
			? this.parseAllDayEvent(source, id, title, parsed.date, metadata)
			: this.parseTimedEvent(source, id, title, parsed.startTime, parsed.endTime, metadata);
	}

	private parseAllDayEvent(
		source: RawEventSource,
		id: string,
		title: string,
		date: DateTime,
		metadata: EventMetadata
	): AllDayEvent {
		const { filePath, frontmatter } = source;
		const start = date.startOf("day").toUTC().toISO({ suppressMilliseconds: true }) || "";

		const meta = this.createEventMeta(source);

		void applyDateNormalizationToFile(this.app, filePath, frontmatter, this.settings, start, undefined, true);

		return {
			id,
			ref: { filePath },
			title,
			type: "allDay",
			start: start as ISO,
			allDay: true,
			isVirtual: false,
			skipped: metadata.skip ?? false,
			metadata,
			meta,
		};
	}

	private parseTimedEvent(
		source: RawEventSource,
		id: string,
		title: string,
		startTime: DateTime,
		endTime: DateTime | null | undefined,
		metadata: EventMetadata
	): TimedEvent {
		const { filePath, frontmatter } = source;
		const start = convertToISO(startTime);
		const end: ISO = endTime
			? convertToISO(endTime)
			: this.calculateDefaultEnd(startTime, false).toUTC().toISO({ suppressMilliseconds: true }) || "";

		const meta = this.createEventMeta(source);
		void applyDateNormalizationToFile(this.app, source.filePath, frontmatter, this.settings, start, end);

		return {
			id,
			ref: { filePath },
			title,
			type: "timed",
			start,
			end,
			allDay: false,
			isVirtual: false,
			skipped: metadata.skip ?? false,
			metadata,
			meta,
		};
	}

	private createEventMeta(source: RawEventSource): Frontmatter {
		const { folder, frontmatter, isAllDay } = source;
		return {
			folder,
			isAllDay,
			originalStart: frontmatter[this.settings.startProp],
			originalEnd: frontmatter[this.settings.endProp],
			originalDate: frontmatter[this.settings.dateProp],
			...frontmatter,
		};
	}

	private calculateDefaultEnd(start: DateTime, allDay: boolean): DateTime {
		if (allDay) {
			return start.endOf("day");
		}

		return start.plus({ minutes: this.settings.defaultDurationMinutes });
	}
}
