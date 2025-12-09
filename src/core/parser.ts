import { FilterEvaluator, getFilenameFromPath } from "@real1ty-obsidian-plugins/utils";
import type { DateTime } from "luxon";
import type { BehaviorSubject, Subscription } from "rxjs";
import { v5 as uuidv5 } from "uuid";
import { convertToISO, parseEventFrontmatter } from "../types/event";
import type { Frontmatter, ISO, SingleCalendarConfig } from "../types/index";
import type { VaultEventId } from "./event-store";
import type { RawEventSource } from "./indexer";

export interface ParsedEvent {
	id: string;
	ref: VaultEventId;
	title: string;
	start: ISO;
	end?: ISO;
	allDay: boolean;
	isVirtual: boolean;
	skipped: boolean;
	color?: string;
	meta?: Frontmatter;
}

// Custom namespace UUID for Prisma Calendar events
// This ensures our event IDs are unique to this application
const PRISMA_CALENDAR_NAMESPACE = "a8f9e6d4-7c2b-4e1a-9f3d-5b8c1a2e4d6f";

export class Parser {
	private settings: SingleCalendarConfig;
	private subscription: Subscription | null = null;
	private filterEvaluator: FilterEvaluator<SingleCalendarConfig>;

	constructor(settingsStore: BehaviorSubject<SingleCalendarConfig>) {
		this.settings = settingsStore.value;
		this.filterEvaluator = new FilterEvaluator<SingleCalendarConfig>(settingsStore);
		this.subscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});
	}

	destroy(): void {
		this.subscription?.unsubscribe();
	}

	parseEventSource(source: RawEventSource): ParsedEvent | null {
		const { filePath, frontmatter, folder } = source;

		if (!this.filterEvaluator.evaluateFilters(frontmatter)) {
			return null;
		}

		const parsed = parseEventFrontmatter(frontmatter, this.settings);
		if (!parsed) {
			return null;
		}

		const isSkipped = frontmatter[this.settings.skipProp] === true;

		const id = uuidv5(filePath, PRISMA_CALENDAR_NAMESPACE);
		const title = parsed.title || this.getFallbackTitle(filePath);

		let start: ISO;
		let end: ISO | undefined;
		let allDay: boolean;

		if (parsed.allDay) {
			// ALL-DAY EVENT: Use the date field, set to full day in UTC
			allDay = true;
			start = parsed.date.startOf("day").toUTC().toISO({ suppressMilliseconds: true }) || "";
			end = parsed.date.endOf("day").toUTC().toISO({ suppressMilliseconds: true }) || "";
		} else {
			// TIMED EVENT: Use startTime and optional endTime, convert to UTC
			allDay = false;
			start = convertToISO(parsed.startTime);

			if (parsed.endTime) {
				end = convertToISO(parsed.endTime);
			} else {
				const defaultEnd = this.calculateDefaultEnd(parsed.startTime, false);
				end = defaultEnd.toUTC().toISO({ suppressMilliseconds: true }) || undefined;
			}
		}

		const meta: Frontmatter = {
			folder,
			isAllDay: source.isAllDay,
			originalStart: frontmatter[this.settings.startProp],
			originalEnd: frontmatter[this.settings.endProp],
			originalDate: frontmatter[this.settings.dateProp],
			...frontmatter,
		};

		return {
			id,
			ref: { filePath },
			title,
			start,
			end,
			allDay,
			isVirtual: false,
			skipped: isSkipped,
			meta,
		};
	}

	private getFallbackTitle(filePath: string): string {
		const fileName = getFilenameFromPath(filePath);
		return fileName.replace(/\.md$/, "");
	}

	private calculateDefaultEnd(start: DateTime, allDay: boolean): DateTime {
		if (allDay) {
			return start.endOf("day");
		}

		return start.plus({ minutes: this.settings.defaultDurationMinutes });
	}
}
