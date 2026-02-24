import type { ParsedEvent } from "../../types";

export type NavigateInput = {
	date?: string;
	view?: string;
	calendarId?: string;
};

export interface PrismaEventInput {
	title?: string;
	start?: string;
	end?: string;
	allDay?: boolean;
	categories?: string[];
	location?: string;
	participants?: string[];
	markAsDone?: boolean;
	skip?: boolean;
	frontmatter?: Record<string, unknown>;
}

export interface PrismaCreateEventInput extends PrismaEventInput {
	title: string;
	calendarId?: string;
}

export interface PrismaEditEventInput extends PrismaEventInput {
	filePath: string;
	calendarId?: string;
}

export interface PrismaDeleteEventInput {
	filePath: string;
	calendarId?: string;
}

export interface PrismaConvertEventInput extends PrismaEventInput {
	filePath: string;
	calendarId?: string;
}

// ─── Public Output Interfaces ────────────────────────────────

export interface PrismaEventOutput {
	filePath: string;
	title: string;
	type: "timed" | "allDay" | "untracked";
	start?: string;
	end?: string;
	allDay: boolean;
	isVirtual: boolean;
	skipped: boolean;
	color?: string;
	categories?: string[];
	location?: string;
	participants?: string[];
	status?: string;
	icon?: string;
	rruleType?: string;
	rruleId?: string;
	instanceDate?: string;
}

export interface PrismaCategoryOutput {
	name: string;
	color: string;
}

export interface PrismaCalendarInfo {
	calendarId: string;
	name: string;
	directory: string;
	enabled: boolean;
	eventCount: number;
	untrackedEventCount: number;
}

export interface PrismaStatEntry {
	name: string;
	duration: number;
	durationFormatted: string;
	percentage: string;
	count: number;
	isRecurring: boolean;
}

export interface PrismaStatisticsOutput {
	periodStart: string;
	periodEnd: string;
	interval: "day" | "week" | "month";
	mode: "name" | "category";
	totalDuration: number;
	totalDurationFormatted: string;
	totalEvents: number;
	timedEvents: number;
	allDayEvents: number;
	skippedEvents: number;
	doneEvents: number;
	undoneEvents: number;
	entries: PrismaStatEntry[];
}

export function serializeEvent(event: ParsedEvent): PrismaEventOutput {
	const output: PrismaEventOutput = {
		filePath: event.ref.filePath,
		title: event.title,
		type: event.type,
		allDay: event.type === "allDay",
		isVirtual: event.isVirtual,
		skipped: event.skipped,
	};

	if (event.type === "timed") {
		output.start = event.start;
		output.end = event.end;
	} else if (event.type === "allDay") {
		output.start = event.start;
	}

	if (event.color) output.color = event.color;
	if (event.metadata.categories?.length) output.categories = event.metadata.categories;
	if (event.metadata.location) output.location = event.metadata.location;
	if (event.metadata.participants?.length) output.participants = event.metadata.participants;
	if (event.metadata.status) output.status = event.metadata.status;
	if (event.metadata.icon) output.icon = event.metadata.icon;
	if (event.metadata.rruleType) output.rruleType = event.metadata.rruleType;
	if (event.metadata.rruleId) output.rruleId = event.metadata.rruleId;
	if (event.metadata.instanceDate) output.instanceDate = event.metadata.instanceDate;

	return output;
}
