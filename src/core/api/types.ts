import { z } from "zod";

import type { ParsedEvent } from "../../types";
import { AIOperationsSchema } from "../../types/ai";
import { SingleCalendarConfigSchema } from "../../types/settings";

export type { AIMode, AIOperation as PrismaAIOperation } from "../../types/ai";

// ─── Navigation ─────────────────────────────────────────────────────

export const PrismaNavigateInputSchema = z.object({
	date: z.string().optional(),
	view: z.string().optional(),
	calendarId: z.string().optional(),
});

export type NavigateInput = z.infer<typeof PrismaNavigateInputSchema>;

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

// Read-side inputs — small, regular shapes used across getX / status / lifecycle
// actions. Defining them once here keeps `defineAction` call sites tight.

export const PrismaFilePathInputSchema = z.object({
	filePath: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaFilePathInput = z.infer<typeof PrismaFilePathInputSchema>;

export const PrismaCalendarIdInputSchema = z.object({
	calendarId: z.string().optional(),
});

export type PrismaCalendarIdInput = z.infer<typeof PrismaCalendarIdInputSchema>;

export const PrismaGetEventsInputSchema = z.object({
	start: z.string(),
	end: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaGetEventsInput = z.infer<typeof PrismaGetEventsInputSchema>;

export const PrismaCloneEventInputSchema = z.object({
	filePath: z.string(),
	offsetMs: z.number().optional(),
	calendarId: z.string().optional(),
});

export type PrismaCloneEventInput = z.infer<typeof PrismaCloneEventInputSchema>;

export const PrismaMoveEventInputSchema = z.object({
	filePath: z.string(),
	offsetMs: z.number(),
	calendarId: z.string().optional(),
});

export type PrismaMoveEventInput = z.infer<typeof PrismaMoveEventInputSchema>;

export const PrismaConvertEventInputSchema = PrismaEventInputSchema.extend({
	filePath: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaConvertEventInput = z.infer<typeof PrismaConvertEventInputSchema>;

export const PrismaMakeVirtualInputSchema = z.object({
	filePath: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaMakeVirtualInput = z.infer<typeof PrismaMakeVirtualInputSchema>;

export const PrismaMakeRealInputSchema = z.object({
	virtualEventId: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaMakeRealInput = z.infer<typeof PrismaMakeRealInputSchema>;

export const PrismaMoveEventToCalendarInputSchema = z.object({
	filePath: z.string(),
	targetCalendarId: z.string(),
	calendarId: z.string().optional(),
});

export type PrismaMoveEventToCalendarInput = z.infer<typeof PrismaMoveEventToCalendarInputSchema>;

export const PrismaMoveEventToCalendarResultSchema = z.object({
	success: z.boolean(),
	movedFilePath: z.string().optional(),
	error: z.string().optional(),
});

export type PrismaMoveEventToCalendarResult = z.infer<typeof PrismaMoveEventToCalendarResultSchema>;

// ─── Modal-trigger Inputs ───────────────────────────────────────────

export const PrismaActivateInputSchema = z.object({
	key: z.string(),
});

export type PrismaActivateInput = z.infer<typeof PrismaActivateInputSchema>;

export const PrismaOpenCreateEventModalInputSchema = z.object({
	calendarId: z.string().optional(),
	autoStartStopwatch: z.boolean().optional(),
	openCreatedInNewTab: z.boolean().optional(),
});

export type PrismaOpenCreateEventModalInput = z.infer<typeof PrismaOpenCreateEventModalInputSchema>;

// ─── Batch Operations ───────────────────────────────────────────────

export const PrismaBatchInputSchema = z.object({
	filePaths: z.array(z.string()),
	calendarId: z.string().optional(),
});

export type PrismaBatchInput = z.infer<typeof PrismaBatchInputSchema>;

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

export const PrismaCategoryOutputSchema = z.object({
	name: z.string(),
	color: z.string(),
});

export type PrismaCategoryOutput = z.infer<typeof PrismaCategoryOutputSchema>;

export const PrismaCalendarInfoSchema = z.object({
	calendarId: z.string(),
	name: z.string(),
	directory: z.string(),
	enabled: z.boolean(),
	eventCount: z.number(),
	untrackedEventCount: z.number(),
});

export type PrismaCalendarInfo = z.infer<typeof PrismaCalendarInfoSchema>;

// ─── Statistics ─────────────────────────────────────────────────────

export const PrismaStatisticsIntervalSchema = z.enum(["day", "week", "month"]);
export const PrismaStatisticsModeSchema = z.enum(["name", "category"]);

export const PrismaStatisticsInputSchema = z.object({
	date: z.string().optional(),
	interval: PrismaStatisticsIntervalSchema.optional(),
	mode: PrismaStatisticsModeSchema.optional(),
	calendarId: z.string().optional(),
});

export type PrismaStatisticsInput = z.infer<typeof PrismaStatisticsInputSchema>;

export const PrismaStatEntrySchema = z.object({
	name: z.string(),
	duration: z.number(),
	durationFormatted: z.string(),
	percentage: z.string(),
	count: z.number(),
	isRecurring: z.boolean(),
});

export type PrismaStatEntry = z.infer<typeof PrismaStatEntrySchema>;

export const PrismaStatisticsOutputSchema = z.object({
	periodStart: z.string(),
	periodEnd: z.string(),
	interval: PrismaStatisticsIntervalSchema,
	mode: PrismaStatisticsModeSchema,
	totalDuration: z.number(),
	totalDurationFormatted: z.string(),
	totalEvents: z.number(),
	timedEvents: z.number(),
	allDayEvents: z.number(),
	skippedEvents: z.number(),
	doneEvents: z.number(),
	undoneEvents: z.number(),
	entries: z.array(PrismaStatEntrySchema),
});

export type PrismaStatisticsOutput = z.infer<typeof PrismaStatisticsOutputSchema>;

// ─── Settings ───────────────────────────────────────────────────────

export const PrismaUpdateSettingsInputSchema = z.object({
	settings: SingleCalendarConfigSchema.partial(),
	calendarId: z.string().optional(),
});

export type PrismaUpdateSettingsInput = z.infer<typeof PrismaUpdateSettingsInputSchema>;

// ─── AI API ─────────────────────────────────────────────────────────

export const PrismaAIModeSchema = z.enum(["query", "manipulation", "planning"]);

export const PrismaAIQueryInputSchema = z.object({
	message: z.string(),
	mode: PrismaAIModeSchema.optional(),
	execute: z.boolean().optional(),
	customPromptIds: z.array(z.string()).optional(),
	calendarId: z.string().optional(),
});

export type PrismaAIQueryInput = z.infer<typeof PrismaAIQueryInputSchema>;

export const PrismaAIOperationResultSchema = z.object({
	succeeded: z.number(),
	failed: z.number(),
	total: z.number(),
});

export type PrismaAIOperationResult = z.infer<typeof PrismaAIOperationResultSchema>;

export const PrismaAIQueryResultSchema = z.object({
	success: z.boolean(),
	error: z.string().optional(),
	response: z.string().optional(),
	mode: PrismaAIModeSchema.optional(),
	operations: AIOperationsSchema.optional(),
	validationErrors: z.array(z.string()).optional(),
	executionResult: PrismaAIOperationResultSchema.optional(),
});

export type PrismaAIQueryResult = z.infer<typeof PrismaAIQueryResultSchema>;

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
