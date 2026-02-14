import {
	FilterEvaluator,
	getFilenameFromPath,
	parseIntoList,
	removeMarkdownExtension,
} from "@real1ty-obsidian-plugins";
import type { DateTime } from "luxon";
import type { App } from "obsidian";
import type { BehaviorSubject, Subscription } from "rxjs";
import { v5 as uuidv5 } from "uuid";
import { PRISMA_CALENDAR_NAMESPACE } from "../constants";
import type { AllDayEvent, CalendarEvent, TimedEvent } from "../types/calendar";
import { convertToISO, parseEventFrontmatter } from "../types/event";
import type { Frontmatter, ISO, SingleCalendarConfig } from "../types/index";
import { applyDateNormalization, applyDateNormalizationToFile, getEventName } from "../utils/calendar-events";
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
		const title =
			getEventName(this.settings.titleProp, frontmatter, filePath, this.settings.calendarTitleProp) ||
			removeMarkdownExtension(getFilenameFromPath(filePath));

		const location = this.extractLocation(frontmatter);
		const participants = this.extractParticipants(frontmatter);

		return parsed.allDay
			? this.parseAllDayEvent(source, id, title, parsed.date, isSkipped, location, participants)
			: this.parseTimedEvent(source, id, title, parsed.startTime, parsed.endTime, isSkipped, location, participants);
	}

	private parseAllDayEvent(
		source: RawEventSource,
		id: string,
		title: string,
		date: DateTime,
		isSkipped: boolean,
		location?: string,
		participants?: string[]
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
			location,
			participants,
			meta: this.createEventMeta(source),
		};
	}

	private parseTimedEvent(
		source: RawEventSource,
		id: string,
		title: string,
		startTime: DateTime,
		endTime: DateTime | null | undefined,
		isSkipped: boolean,
		location?: string,
		participants?: string[]
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
			location,
			participants,
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

	private extractLocation(frontmatter: Frontmatter): string | undefined {
		const locationValue = frontmatter[this.settings.locationProp];
		if (locationValue && typeof locationValue === "string" && locationValue.trim()) {
			return locationValue;
		}
		return undefined;
	}

	private extractParticipants(frontmatter: Frontmatter): string[] | undefined {
		const participantsValue = frontmatter[this.settings.participantsProp];
		if (!participantsValue) return undefined;

		const participants = parseIntoList(participantsValue);
		return participants.length > 0 ? participants : undefined;
	}

	private calculateDefaultEnd(start: DateTime, allDay: boolean): DateTime {
		if (allDay) {
			return start.endOf("day");
		}

		return start.plus({ minutes: this.settings.defaultDurationMinutes });
	}
}
