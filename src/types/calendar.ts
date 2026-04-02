import type { CustomButtonInput, EventInput } from "@fullcalendar/core";
import { z } from "zod";

import { EventMetadataSchema } from "./event";
import type { Frontmatter } from "./index";

export const VirtualKindSchema = z.enum(["none", "recurring", "manual"]);
export type VirtualKind = z.infer<typeof VirtualKindSchema>;

export function isAnyVirtual(kind: VirtualKind | undefined): boolean {
	return kind !== undefined && kind !== "none";
}

// Base properties shared by all event types
const BaseEventSchema = z.object({
	id: z.string(),
	ref: z.object({
		filePath: z.string(),
	}),
	title: z.string(),
	metadata: EventMetadataSchema,
});

// Timed Event: has start and end, can be skipped, can be virtual
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

// All-Day Event: has start (no end), can be skipped, can be virtual
export const AllDayEventSchema = BaseEventSchema.extend({
	type: z.literal("allDay"),
	start: z.string(),
	allDay: z.literal(true),
	virtualKind: VirtualKindSchema.default("none"),
	skipped: z.boolean(),
	color: z.string().optional(),
	meta: z.record(z.string(), z.unknown()),
});

// Untracked Event: no start/end/allDay, cannot be virtual, cannot be skipped
export const UntrackedEventSchema = BaseEventSchema.extend({
	type: z.literal("untracked"),
	virtualKind: z.literal("none"),
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

export interface PrismaExtendedProps {
	filePath: string;
	folder: string;
	originalTitle: string;
	frontmatterDisplayData: Frontmatter;
	virtualKind: VirtualKind;
	virtualEventId?: string;
	computedColors?: string[];
	frontmatterHash?: number;
}

export interface PrismaEventInput extends EventInput {
	extendedProps: PrismaExtendedProps;
}

export interface FlexibleExtendedProps {
	filePath?: string;
	folder?: string;
	originalTitle?: string;
	frontmatterDisplayData?: Frontmatter;
	virtualKind?: VirtualKind;
	virtualEventId?: string;
	computedColors?: string[];
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
	oldEvent: Pick<CalendarEventData, "start" | "end" | "allDay"> & {
		start: Date;
	};
	revert: () => void;
}

// Extended button input with className support (FullCalendar accepts it at runtime but doesn't type it)
export interface ExtendedButtonInput extends CustomButtonInput {
	className?: string;
}
