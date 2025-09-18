import type { DateTime } from "luxon";
import type { BehaviorSubject, Subscription } from "rxjs";
import { getFilenameFromPath } from "utils/file-utils";
import { convertToISO, parseEventFrontmatter } from "../types/event-schemas";
import type { ISO, SingleCalendarConfig } from "../types/index";
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
	timezone: string;
	color?: string;
	meta?: Record<string, unknown>;
}

export class Parser {
	private settings: SingleCalendarConfig;
	private subscription: Subscription | null = null;

	constructor(settingsStore: BehaviorSubject<SingleCalendarConfig>) {
		this.settings = settingsStore.value;
		this.subscription = settingsStore.subscribe((newSettings) => {
			this.settings = newSettings;
		});
	}

	destroy(): void {
		this.subscription?.unsubscribe();
	}

	parseEventSource(source: RawEventSource): ParsedEvent | null {
		const { filePath, frontmatter, folder } = source;

		const parsed = parseEventFrontmatter(frontmatter, this.settings);
		if (!parsed) {
			return null;
		}

		const id = this.generateEventId(filePath);
		const title = parsed.title || this.getFallbackTitle(filePath);
		const timezone = parsed.timezone || this.settings.timezone;

		const start = convertToISO(parsed.startTime, timezone);

		let end: ISO | undefined;
		if (parsed.endTime) {
			end = convertToISO(parsed.endTime, timezone);
		} else {
			const startInTimezone =
				timezone && timezone !== "system" ? parsed.startTime.setZone(timezone) : parsed.startTime;
			const defaultEnd = this.calculateDefaultEnd(startInTimezone, parsed.allDay);
			end = defaultEnd.toUTC().toISO({ suppressMilliseconds: true }) || undefined;
		}

		const meta: Record<string, unknown> = {
			folder,
			originalStart: frontmatter[this.settings.startProp],
			originalEnd: frontmatter[this.settings.endProp],
			...frontmatter,
		};

		return {
			id,
			ref: { filePath },
			title,
			start,
			end,
			allDay: parsed.allDay,
			isVirtual: false,
			timezone,
			meta,
		};
	}

	private generateEventId(filePath: string): string {
		const base = filePath;
		let hash = 0;
		for (let i = 0; i < base.length; i++) {
			const char = base.charCodeAt(i);
			hash = (hash << 5) - hash + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(36);
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
