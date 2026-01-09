import type { CustomButtonInput, EventInput } from "@fullcalendar/core";
import { z } from "zod";
import type { Frontmatter } from "./index";

// Base properties shared by all event types
const BaseEventSchema = z.object({
	id: z.string(),
	ref: z.object({
		filePath: z.string(),
	}),
	title: z.string(),
});

// Timed Event: has start and end, can be skipped, can be virtual
export const TimedEventSchema = BaseEventSchema.extend({
	type: z.literal("timed"),
	start: z.string(),
	end: z.string(),
	allDay: z.literal(false),
	isVirtual: z.boolean(),
	skipped: z.boolean(),
	color: z.string().optional(),
	meta: z.record(z.string(), z.unknown()),
});

// All-Day Event: has start (no end), can be skipped, can be virtual
export const AllDayEventSchema = BaseEventSchema.extend({
	type: z.literal("allDay"),
	start: z.string(),
	allDay: z.literal(true),
	isVirtual: z.boolean(),
	skipped: z.boolean(),
	color: z.string().optional(),
	meta: z.record(z.string(), z.unknown()),
});

// Untracked Event: no start/end/allDay, cannot be virtual, cannot be skipped
export const UntrackedEventSchema = BaseEventSchema.extend({
	type: z.literal("untracked"),
	isVirtual: z.literal(false),
	skipped: z.literal(false),
	color: z.string().optional(),
	meta: z.record(z.string(), z.unknown()),
});

export const CalendarEventSchema = z.discriminatedUnion("type", [TimedEventSchema, AllDayEventSchema]);

export const ParsedEventSchema = z.discriminatedUnion("type", [
	TimedEventSchema,
	AllDayEventSchema,
	UntrackedEventSchema,
]);

export type TimedEvent = z.infer<typeof TimedEventSchema>;
export type AllDayEvent = z.infer<typeof AllDayEventSchema>;
export type UntrackedEvent = z.infer<typeof UntrackedEventSchema>;
export type CalendarEvent = z.infer<typeof CalendarEventSchema>; // TimedEvent | AllDayEvent
export type ParsedEvent = z.infer<typeof ParsedEventSchema>; // TimedEvent | AllDayEvent | UntrackedEvent

export function isTimedEvent(event: ParsedEvent): event is TimedEvent {
	return event.type === "timed";
}

export function isAllDayEvent(event: ParsedEvent): event is AllDayEvent {
	return event.type === "allDay";
}

export function isUntrackedEvent(event: ParsedEvent): event is UntrackedEvent {
	return event.type === "untracked";
}

export function isCalendarEvent(event: ParsedEvent): event is CalendarEvent {
	return event.type === "timed" || event.type === "allDay";
}

export interface PrismaExtendedProps {
	filePath: string;
	folder: string;
	originalTitle: string;
	frontmatterDisplayData: Frontmatter;
	isVirtual: boolean;
}

export interface PrismaEventInput extends EventInput {
	extendedProps: PrismaExtendedProps;
}

export interface FlexibleExtendedProps {
	filePath?: string;
	folder?: string;
	originalTitle?: string;
	frontmatterDisplayData?: Frontmatter;
	isVirtual?: boolean;
}

export interface CalendarEventData {
	title: string;
	start: Date | null;
	end: Date | null;
	allDay: boolean;
	extendedProps: FlexibleExtendedProps;
}

export interface EventMountInfo {
	el: HTMLElement;
	event: CalendarEventData;
}

export interface EventUpdateInfo {
	event: CalendarEventData & { start: Date };
	oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay"> & { start: Date };
	revert: () => void;
}

// Extended button input with className support (FullCalendar accepts it at runtime but doesn't type it)
export interface ExtendedButtonInput extends CustomButtonInput {
	className?: string;
}
