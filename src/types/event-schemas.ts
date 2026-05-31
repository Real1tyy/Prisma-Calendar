import {
	classifyDateLikeString,
	extractDisplayName,
	getFilenameFromPath,
	removeMarkdownExtension,
	toSafeString,
	type DateLikeKind,
} from "@real1ty-obsidian-plugins";
import { v5 as uuidv5 } from "uuid";

import { PRISMA_CALENDAR_NAMESPACE } from "../constants";
import { toInternalISO } from "../utils/dates/iso";
import { cleanupTitle } from "../utils/events/naming";
import { eventDefaults, type AllDayEvent, type ParsedEvent, type TimedEvent, type UntrackedEvent } from "./calendar";
import { createEventFrontmatterSchema, type ParsedEventFrontmatter } from "./event-frontmatter-schema";
import type { EventMetadata } from "./event-metadata";
import type { Frontmatter, SingleCalendarConfig } from "./index";

/**
 * Raw value-type classifications for the three temporal roles, captured from the
 * *original* frontmatter strings before parsing. Luxon parsing collapses a
 * date-only value to midnight and loses the date-vs-datetime distinction, so the
 * resolver needs these raw classifications to decide timed-vs-all-day.
 */
export interface TemporalKinds {
	start: DateLikeKind | null;
	end: DateLikeKind | null;
	date: DateLikeKind | null;
}

/**
 * Input envelope for the event schemas. `frontmatter` is the raw, unmapped
 * frontmatter (preserved for downstream consumers that need the original keys);
 * `parsed` is the canonical typed envelope produced by the unified mapped schema;
 * `temporalKinds` are the raw value-type classifications of the temporal roles.
 */
export interface EventSchemaInput {
	filePath: string;
	frontmatter: Frontmatter;
	folder: string;
	parsed: ParsedEventFrontmatter;
	temporalKinds: TemporalKinds;
}

function makeId(filePath: string): string {
	return uuidv5(filePath, PRISMA_CALENDAR_NAMESPACE);
}

function makeTitle(parsed: ParsedEventFrontmatter, filePath: string): string {
	if (parsed.title) return parsed.title;
	if (parsed.calendarTitle) return extractDisplayName(parsed.calendarTitle);
	const basename = removeMarkdownExtension(getFilenameFromPath(filePath));
	return basename ? cleanupTitle(basename) : "";
}

function buildMeta(input: EventSchemaInput, isAllDay: boolean): Frontmatter {
	const { frontmatter, folder } = input;
	return {
		folder,
		isAllDay,
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
		rruleUntil: parsed.rruleUntil,
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
	const start = parsed.start ?? parsed.date;
	if (!start) return null;

	const startIso = toInternalISO(start);
	const endIso = parsed.end
		? toInternalISO(parsed.end)
		: toInternalISO(start.plus({ minutes: settings.defaultDurationMinutes }));

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
		meta: buildMeta(input, false),
	};
}

function buildAllDayEvent(input: EventSchemaInput): AllDayEvent | null {
	const { parsed } = input;
	const anchor = parsed.date ?? parsed.start;
	if (!anchor) return null;

	const metadata = buildMetadata(parsed);
	return {
		...eventDefaults(),
		id: makeId(input.filePath),
		ref: { filePath: input.filePath },
		title: makeTitle(parsed, input.filePath),
		type: "allDay",
		start: toInternalISO(anchor.startOf("day")),
		allDay: true,
		skipped: metadata.skip ?? false,
		metadata,
		meta: buildMeta(input, true),
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
		meta: buildMeta(input, false),
	};
}

type TemporalKind = "timed" | "allDay" | "untracked";

/**
 * Resolves an event to timed, all-day, or untracked. Resolution order (first
 * match wins):
 *
 *   1. `allDay === true` → all-day.
 *   2. `allDay === false` → timed if a start value is present, else untracked.
 *   3. start is `datetime` and end is absent-or-`datetime` → timed.
 *   4. dateProp holds a `date` → all-day.
 *   5. otherwise → untracked.
 *
 * Rules 3–5 classify by the value *type* of each temporal role (from
 * `temporalKinds`): a datetime start drives a timed event, a date-only dateProp
 * drives an all-day event. See docs/specs/2026-05-30-permissive-temporal-type-detection.md.
 */
export function resolveTemporalKind(input: EventSchemaInput): TemporalKind {
	const { parsed, temporalKinds } = input;

	if (parsed.allDay === true) return "allDay";
	if (parsed.allDay === false) return parsed.start ? "timed" : "untracked";

	if (temporalKinds.start === "datetime" && temporalKinds.end !== "date") return "timed";
	if (temporalKinds.date === "date" && parsed.date) return "allDay";
	return "untracked";
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
			const kind = resolveTemporalKind(input);
			if (kind === "allDay") return buildAllDayEvent(input);
			if (kind === "timed") return buildTimedEvent(input, settings);
			return null;
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
	const temporalKinds: TemporalKinds = {
		start: classifyDateLikeString(toSafeString(args.frontmatter[settings.startProp]) ?? ""),
		end: classifyDateLikeString(toSafeString(args.frontmatter[settings.endProp]) ?? ""),
		date: classifyDateLikeString(toSafeString(args.frontmatter[settings.dateProp]) ?? ""),
	};
	return {
		filePath: args.filePath,
		frontmatter: args.frontmatter,
		folder: args.folder,
		parsed,
		temporalKinds,
	};
}
