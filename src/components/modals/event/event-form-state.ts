import { parseIntoList } from "@real1ty-obsidian-plugins";
import { z } from "zod";

import type { EventPreset } from "../../../types/settings";

// ─── Canonical field schemas — define once, use everywhere ───

export const SimpleEditableFieldsSchema = z.object({
	location: z.string().default("").describe("Event location"),
	icon: z.string().default("").describe("Event icon (emoji or text)"),
	participants: z.string().default("").describe("Comma-separated list of participants"),
	breakMinutes: z.string().default("").describe("Break time in minutes"),
	markAsDone: z.boolean().default(false).describe("Mark as done"),
	skip: z.boolean().default(false).describe("Hide event from calendar"),
});

export type SimpleEditableFields = z.infer<typeof SimpleEditableFieldsSchema>;

export const RecurringFormStateSchema = z.object({
	enabled: z.boolean().default(false),
	rruleType: z.string().default(""),
	weekdays: z.array(z.string()).default([]),
	customFreq: z.string().default("DAILY"),
	customInterval: z.string().default("1"),
	futureInstancesCount: z.string().default(""),
	generatePastEvents: z.boolean().default(false),
});

export const EventFormStateSchema = z
	.object({
		title: z.string().default(""),
		allDay: z.boolean().default(false),
		start: z.string().default(""),
		end: z.string().default(""),
		date: z.string().default(""),
		categories: z.array(z.string()).default([]),
		prerequisites: z.array(z.string()).default([]),
		notifyBefore: z.string().default(""),
		recurring: RecurringFormStateSchema.default({
			enabled: false,
			rruleType: "",
			weekdays: [],
			customFreq: "DAILY",
			customInterval: "1",
			futureInstancesCount: "",
			generatePastEvents: false,
		}),
	})
	.extend(SimpleEditableFieldsSchema.shape);

export type RecurringFormState = z.infer<typeof RecurringFormStateSchema>;
export type EventFormState = z.infer<typeof EventFormStateSchema>;

export function createDefaultState(): EventFormState {
	return EventFormStateSchema.parse({});
}

export function applyPresetToState(state: EventFormState, preset: EventPreset): EventFormState {
	const patch: Record<string, unknown> = {};

	const directKeys = ["title", "allDay", "location", "icon", "participants", "skip", "markAsDone"] as const;
	for (const key of directKeys) {
		if (preset[key] !== undefined) patch[key] = preset[key];
	}

	if (preset["categories"] !== undefined) patch["categories"] = parseIntoList(preset["categories"]);
	if (preset["breakMinutes"] !== undefined) patch["breakMinutes"] = preset["breakMinutes"].toString();
	if (preset["notifyBefore"] !== undefined) patch["notifyBefore"] = preset["notifyBefore"].toString();

	if (preset["rruleType"]) {
		patch["recurring"] = {
			...state.recurring,
			enabled: true,
			rruleType: preset["rruleType"],
			...(preset["rruleSpec"] && { weekdays: preset["rruleSpec"].split(",").map((d) => d.trim().toLowerCase()) }),
			...(preset["futureInstancesCount"] !== undefined && {
				futureInstancesCount: preset["futureInstancesCount"].toString(),
			}),
		};
	}

	return EventFormStateSchema.parse({ ...state, ...patch });
}

export function extractPresetFromState(state: EventFormState): Partial<EventPreset> {
	const preset: Partial<EventPreset> = {};

	if (state.title) preset.title = state.title;
	preset.allDay = state.allDay;
	if (state.categories.length > 0) preset.categories = state.categories.join(", ");

	const textFields = { location: "location", icon: "icon", participants: "participants" } as const;
	for (const [stateKey, presetKey] of Object.entries(textFields)) {
		const val = (state[stateKey as keyof EventFormState] as string).trim();
		if (val) (preset as Record<string, unknown>)[presetKey] = val;
	}

	const breakValue = Number.parseFloat(state.breakMinutes);
	if (!Number.isNaN(breakValue) && breakValue > 0) preset.breakMinutes = breakValue;

	preset.skip = state.skip;
	preset.markAsDone = state.markAsDone;

	const notifyValue = Number.parseInt(state.notifyBefore, 10);
	if (!Number.isNaN(notifyValue) && notifyValue >= 0) preset.notifyBefore = notifyValue;

	if (state.recurring.enabled) {
		preset.rruleType = state.recurring.rruleType;
		if (state.recurring.weekdays.length > 0) preset.rruleSpec = state.recurring.weekdays.join(", ");
		const futureCount = Number.parseInt(state.recurring.futureInstancesCount, 10);
		if (!Number.isNaN(futureCount) && futureCount > 0) preset.futureInstancesCount = futureCount;
	}

	return preset;
}
