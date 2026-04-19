import type { CustomButtonInput, EventInput } from "@fullcalendar/core";
import { z } from "zod";

import type { FCExtendedProps } from "../utils/extended-props";
import { EventMetadataSchema } from "./event-metadata";

// ─── Virtual Kind ────────────────────────────────────────────────────

export const VirtualKindSchema = z.enum(["none", "recurring", "manual", "holiday"]);
export type VirtualKind = z.infer<typeof VirtualKindSchema>;

export function isAnyVirtual(kind: VirtualKind | undefined): boolean {
	return kind !== undefined && kind !== "none";
}

// ─── Event Domain Schemas ────────────────────────────────────────────

const BaseEventSchema = z.object({
	id: z.string(),
	ref: z.object({
		filePath: z.string(),
	}),
	title: z.string(),
	metadata: EventMetadataSchema,
});

export const TimedEventSchema = BaseEventSchema.extend({
	type: z.literal("timed"),
	start: z.string(),
	end: z.string(),
	allDay: z.literal(false),
	virtualKind: VirtualKindSchema.default("none"),
	skipped: z.boolean(),
	color: z.string().optional(),
	meta: z.record(z.string(), z.unknown()),
});

export const AllDayEventSchema = BaseEventSchema.extend({
	type: z.literal("allDay"),
	start: z.string(),
	allDay: z.literal(true),
	virtualKind: VirtualKindSchema.default("none"),
	skipped: z.boolean(),
	color: z.string().optional(),
	meta: z.record(z.string(), z.unknown()),
});

export const UntrackedEventSchema = BaseEventSchema.extend({
	type: z.literal("untracked"),
	virtualKind: z.literal("none"),
	skipped: z.literal(false),
	color: z.string().optional(),
	meta: z.record(z.string(), z.unknown()),
});

const CalendarEventSchema = z.discriminatedUnion("type", [TimedEventSchema, AllDayEventSchema]);

const ParsedEventSchema = z.discriminatedUnion("type", [TimedEventSchema, AllDayEventSchema, UntrackedEventSchema]);

export type TimedEvent = z.infer<typeof TimedEventSchema>;
export type AllDayEvent = z.infer<typeof AllDayEventSchema>;
export type UntrackedEvent = z.infer<typeof UntrackedEventSchema>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;
export type ParsedEvent = z.infer<typeof ParsedEventSchema>;

export function eventDefaults(): {
	virtualKind: "none";
	skipped: false;
	metadata: z.infer<typeof EventMetadataSchema>;
	meta: Record<string, unknown>;
} {
	return { virtualKind: "none", skipped: false, metadata: {}, meta: {} };
}

export function isTimedEvent(event: ParsedEvent): event is TimedEvent {
	return event.type === "timed";
}

export function isAllDayEvent(event: ParsedEvent): event is AllDayEvent {
	return event.type === "allDay";
}

// ─── Event Classification ────────────────────────────────────────────

const EventKindSchema = z.enum(["normal", "source", "physical", "virtual", "manual", "holiday"]);
export type EventKind = z.infer<typeof EventKindSchema>;

// ─── FullCalendar Adapter Types ──────────────────────────────────────

export interface FCPrismaEventInput extends EventInput {
	extendedProps: FCExtendedProps;
}

export interface CalendarEventData {
	title: string;
	start: Date | null;
	end: Date | null;
	allDay: boolean;
	extendedProps: Partial<Omit<FCExtendedProps, "frontmatterHash">>;
}

export interface EventMountInfo {
	el: HTMLElement;
	event: CalendarEventData;
}

export interface EventDateTime {
	start: string;
	end: string | undefined;
	allDay: boolean;
}

export interface EventUpdateInfo {
	event: CalendarEventData & { start: Date };
	oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay"> & {
		start: Date;
	};
	revert: () => void;
}

export interface ExtendedButtonInput extends CustomButtonInput {
	className?: string;
}

// ─── Move-By Operation (batch move) ──────────────────────────────────

export const TIME_UNITS = ["minutes", "hours", "days", "weeks", "months", "years"] as const;

export type TimeUnit = (typeof TIME_UNITS)[number];

const ALL_DAY_UNITS = new Set<TimeUnit>(["days", "weeks", "months", "years"]);

export const isTimeUnitAllowedForAllDay = (unit: TimeUnit): boolean => ALL_DAY_UNITS.has(unit);

export interface MoveByResult {
	value: number;
	unit: TimeUnit;
}

// ─── Virtual Events File ─────────────────────────────────────────────

export const VirtualEventDataSchema = z.object({
	id: z.string(),
	title: z.string(),
	start: z.string(),
	end: z.string().nullable(),
	allDay: z.boolean(),
	properties: z.record(z.string(), z.unknown()).default({}),
});

export const VirtualEventsFileSchema = z.array(VirtualEventDataSchema);

export type VirtualEventData = z.infer<typeof VirtualEventDataSchema>;
