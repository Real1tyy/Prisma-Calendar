import { z } from "zod";

import type { ParsedEvent } from "../../types";
import type { AIMode } from "../../types/ai";
import type { AIOperation } from "../../types/ai-operation-schemas";

export type { AIOperation as PrismaAIOperation } from "../../types/ai-operation-schemas";

// ─── Navigation ─────────────────────────────────────────────────────

export type NavigateInput = {
	date?: string;
	view?: string;
	calendarId?: string;
};

// ─── Public Input Schemas ───────────────────────────────────────────
// Validated at the API boundary when external consumers call our API.

export const PrismaEventInputSchema = z.object({
	title: z.string().optional(),
	start: z.string().optional(),
	end: z.string().optional(),
	allDay: z.boolean().optional(),
	categories: z.array(z.string()).optional(),
	location: z.string().optional(),
	participants: z.array(z.string()).optional(),
	markAsDone: z.boolean().optional(),
	skip: z.boolean().optional(),
	frontmatter: z.record(z.string(), z.unknown()).optional(),
});

export type PrismaEventInput = z.infer<typeof PrismaEventInputSchema>;

export const PrismaCreateEventInputSchema = PrismaEventInputSchema.extend({
	title: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaCreateEventInput = z.infer<typeof PrismaCreateEventInputSchema>;

export const PrismaEditEventInputSchema = PrismaEventInputSchema.extend({
	filePath: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaEditEventInput = z.infer<typeof PrismaEditEventInputSchema>;

export const PrismaDeleteEventInputSchema = z.object({
	filePath: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaDeleteEventInput = z.infer<typeof PrismaDeleteEventInputSchema>;

export const PrismaConvertEventInputSchema = PrismaEventInputSchema.extend({
	filePath: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaConvertEventInput = z.infer<typeof PrismaConvertEventInputSchema>;

export interface PrismaMakeVirtualInput {
	filePath: string;
	calendarId?: string;
}

export interface PrismaMakeRealInput {
	virtualEventId: string;
	calendarId?: string;
}

// ─── Public Output Schemas ──────────────────────────────────────────

export const PrismaEventOutputSchema = z.object({
	filePath: z.string(),
	title: z.string(),
	type: z.enum(["timed", "allDay", "untracked"]),
	start: z.string().optional(),
	end: z.string().optional(),
	allDay: z.boolean(),
	virtualKind: z.string(),
	skipped: z.boolean(),
	color: z.string().optional(),
	categories: z.array(z.string()).optional(),
	location: z.string().optional(),
	participants: z.array(z.string()).optional(),
	status: z.string().optional(),
	icon: z.string().optional(),
	rruleType: z.string().optional(),
	rruleId: z.string().optional(),
	instanceDate: z.string().optional(),
});

export type PrismaEventOutput = z.infer<typeof PrismaEventOutputSchema>;

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

// ─── AI API ─────────────────────────────────────────────────────────

export interface PrismaAIQueryInput {
	message: string;
	mode?: AIMode;
	execute?: boolean;
	customPromptIds?: string[];
	calendarId?: string;
}

export interface PrismaAIOperationResult {
	succeeded: number;
	failed: number;
	total: number;
}

export interface PrismaAIQueryResult {
	success: boolean;
	error?: string;
	response?: string;
	mode?: AIMode;
	operations?: AIOperation[];
	validationErrors?: string[];
	executionResult?: PrismaAIOperationResult;
}

export function serializeEvent(event: ParsedEvent): PrismaEventOutput {
	const output: PrismaEventOutput = {
		filePath: event.ref.filePath,
		title: event.title,
		type: event.type,
		allDay: event.type === "allDay",
		virtualKind: event.virtualKind,
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
