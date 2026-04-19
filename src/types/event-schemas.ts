import { extractDisplayName, getFilenameFromPath, removeMarkdownExtension } from "@real1ty-obsidian-plugins";
import { v5 as uuidv5 } from "uuid";

import { PRISMA_CALENDAR_NAMESPACE } from "../constants";
import { cleanupTitle } from "../utils/events/naming";
import { toInternalISO } from "../utils/iso";
import type { AllDayEvent, ParsedEvent, TimedEvent, UntrackedEvent } from "./calendar";
import { eventDefaults } from "./calendar";
import type { EventMetadata } from "./event-metadata";
import type { ParsedEventFrontmatter } from "./event-frontmatter-schema";
import { createEventFrontmatterSchema } from "./event-frontmatter-schema";
import type { Frontmatter, SingleCalendarConfig } from "./index";

/**
 * Input envelope for the event schemas. `frontmatter` is the raw, unmapped
 * frontmatter (preserved for downstream consumers that need the original keys);
 * `parsed` is the canonical typed envelope produced by the unified mapped schema.
 */
export interface EventSchemaInput {
	filePath: string;
	frontmatter: Frontmatter;
	folder: string;
	parsed: ParsedEventFrontmatter;
}

function makeId(filePath: string): string {
	return uuidv5(filePath, PRISMA_CALENDAR_NAMESPACE);
}

function makeTitle(parsed: ParsedEventFrontmatter, filePath: string): string {
	if (parsed.calendarTitle) return extractDisplayName(parsed.calendarTitle);
	if (parsed.title) return parsed.title;
	const basename = removeMarkdownExtension(getFilenameFromPath(filePath));
	return basename ? cleanupTitle(basename) : "";
}

function buildMeta(input: EventSchemaInput): Frontmatter {
	const { parsed, frontmatter, folder } = input;
	return {
		folder,
		isAllDay: parsed.allDay === true,
		...frontmatter,
	};
}

export function buildMetadata(parsed: ParsedEventFrontmatter): EventMetadata {
	return {
		skip: parsed.skip,
		location: parsed.location,
		participants: parsed.participants,
		categories: parsed.categories,
		breakMinutes: parsed.breakMinutes,
		icon: parsed.icon,
		status: parsed.status,
		minutesBefore: parsed.minutesBefore,
		daysBefore: parsed.daysBefore,
		alreadyNotified: parsed.alreadyNotified,
		rruleType: parsed.rruleType,
		rruleSpec: parsed.rruleSpec,
		rruleId: parsed.rruleId,
		instanceDate: parsed.instanceDate,
		source: parsed.source,
		futureInstancesCount: parsed.futureInstancesCount,
		generatePastEvents: parsed.generatePastEvents,
		caldav: parsed.caldav,
		icsSubscription: parsed.icsSubscription,
	};
}

function buildTimedEvent(input: EventSchemaInput, settings: SingleCalendarConfig): TimedEvent | null {
	const { parsed } = input;
	if (!parsed.start) return null;

	const startIso = toInternalISO(parsed.start);
	const endIso = parsed.end
		? toInternalISO(parsed.end)
		: toInternalISO(parsed.start.plus({ minutes: settings.defaultDurationMinutes }));

	const metadata = buildMetadata(parsed);
	return {
		...eventDefaults(),
		id: makeId(input.filePath),
		ref: { filePath: input.filePath },
		title: makeTitle(parsed, input.filePath),
		type: "timed",
		start: startIso,
		end: endIso,
		allDay: false,
		skipped: metadata.skip ?? false,
		metadata,
		meta: buildMeta(input),
	};
}

function buildAllDayEvent(input: EventSchemaInput): AllDayEvent | null {
	const { parsed } = input;
	if (parsed.allDay !== true || !parsed.date) return null;

	const metadata = buildMetadata(parsed);
	return {
		...eventDefaults(),
		id: makeId(input.filePath),
		ref: { filePath: input.filePath },
		title: makeTitle(parsed, input.filePath),
		type: "allDay",
		start: toInternalISO(parsed.date.startOf("day")),
		allDay: true,
		skipped: metadata.skip ?? false,
		metadata,
		meta: buildMeta(input),
	};
}

function buildUntrackedEvent(input: EventSchemaInput): UntrackedEvent | null {
	const { parsed } = input;
	if (parsed.start || parsed.date) return null;

	const metadata = buildMetadata(parsed);
	return {
		...eventDefaults(),
		id: makeId(input.filePath),
		ref: { filePath: input.filePath },
		title: makeTitle(parsed, input.filePath),
		type: "untracked",
		virtualKind: "none" as const,
		skipped: false as const,
		metadata,
		meta: buildMeta(input),
	};
}

/**
 * Combined parser. Consumes the canonical pre-mapped envelope and dispatches to
 * the matching event variant.
 */
export interface CalendarEventParser {
	parse(input: EventSchemaInput): TimedEvent | AllDayEvent | null;
	parseUntracked(input: EventSchemaInput): UntrackedEvent | null;
	parseAny(input: EventSchemaInput): ParsedEvent | null;
}

export function createEventSchema(settings: SingleCalendarConfig): CalendarEventParser {
	return {
		parse(input) {
			if (input.parsed.allDay === true) {
				return buildAllDayEvent(input);
			}
			return buildTimedEvent(input, settings);
		},
		parseUntracked(input) {
			return buildUntrackedEvent(input);
		},
		parseAny(input) {
			return this.parse(input) ?? this.parseUntracked(input);
		},
	};
}

/**
 * Helper for constructing the EventSchemaInput from raw frontmatter — runs the
 * unified mapped schema, then bundles the original frontmatter alongside the
 * typed envelope.
 */
export function buildEventSchemaInput(
	args: { filePath: string; frontmatter: Frontmatter; folder: string },
	settings: SingleCalendarConfig
): EventSchemaInput {
	const schema = createEventFrontmatterSchema(settings);
	const parsed = schema.parse(args.frontmatter);
	return {
		filePath: args.filePath,
		frontmatter: args.frontmatter,
		folder: args.folder,
		parsed,
	};
}
