import { FilterEvaluator, getFilenameFromPath, removeMarkdownExtension } from "@real1ty-obsidian-plugins/utils";
import type { DateTime } from "luxon";
import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { v5 as uuidv5 } from "uuid";
import { PRISMA_CALENDAR_NAMESPACE } from "../constants";
import type { AllDayEvent, CalendarEvent, TimedEvent } from "../types/calendar";
import { convertToISO, parseEventFrontmatter } from "../types/event";
import type { Frontmatter, ISO, SingleCalendarConfig } from "../types/index";
import { applyDateNormalization, applyDateNormalizationToFile } from "../utils/calendar-events";
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
		const { filePath, frontmatter } = source;

		if (!this.filterEvaluator.evaluateFilters(frontmatter)) {
			return null;
		}

		const id = uuidv5(filePath, PRISMA_CALENDAR_NAMESPACE);

		const parsed = parseEventFrontmatter(frontmatter, this.settings);
		if (!parsed) {
			return null;
		}

		const isSkipped = frontmatter[this.settings.skipProp] === true;
		const title = parsed.title || removeMarkdownExtension(getFilenameFromPath(filePath));

		return parsed.allDay
			? this.parseAllDayEvent(source, id, title, parsed.date, isSkipped)
			: this.parseTimedEvent(source, id, title, parsed.startTime, parsed.endTime, isSkipped);
	}

	private parseAllDayEvent(
		source: RawEventSource,
		id: string,
		title: string,
		date: DateTime,
		isSkipped: boolean
	): AllDayEvent {
		const { filePath } = source;
		const start = date.startOf("day").toUTC().toISO({ suppressMilliseconds: true }) || "";

		return {
			id,
			ref: { filePath },
			title,
			type: "allDay",
			start: start as ISO,
			allDay: true,
			isVirtual: false,
			skipped: isSkipped,
			meta: this.createEventMeta(source),
		};
	}

	private parseTimedEvent(
		source: RawEventSource,
		id: string,
		title: string,
		startTime: DateTime,
		endTime: DateTime | null | undefined,
		isSkipped: boolean
	): TimedEvent {
		const { filePath, frontmatter } = source;
		const start = convertToISO(startTime);
		const end: ISO = endTime
			? convertToISO(endTime)
			: this.calculateDefaultEnd(startTime, false).toUTC().toISO({ suppressMilliseconds: true }) || "";

		const meta = this.createEventMeta(source);
		applyDateNormalization(meta, this.settings, start, end);
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
			skipped: isSkipped,
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
