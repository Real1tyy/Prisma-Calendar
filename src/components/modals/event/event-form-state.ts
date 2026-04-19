import { parseIntoList } from "@real1ty-obsidian-plugins";
import { z } from "zod";

import {
	EventEditableFormFieldsSchema,
	NonNegativeInt,
	PositiveFloat,
	PositiveInt,
} from "../../../types/event-boundaries";
import type { EventPreset } from "../../../types/settings";

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
		virtual: z.boolean().default(false),
		start: z.string().default(""),
		end: z.string().default(""),
		date: z.string().default(""),
		categories: z.array(z.string()).default([]),
		participants: z.array(z.string()).default([]),
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
	.extend(EventEditableFormFieldsSchema.omit({ notifyBefore: true }).shape);

export type EventFormState = z.infer<typeof EventFormStateSchema>;

export function createDefaultState(): EventFormState {
	return EventFormStateSchema.parse({});
}

export function applyPresetToState(state: EventFormState, preset: EventPreset): EventFormState {
	const patch: Record<string, unknown> = {};

	const directKeys = ["title", "allDay", "location", "icon", "skip", "markAsDone"] as const;
	for (const key of directKeys) {
		if (preset[key] !== undefined) patch[key] = preset[key];
	}

	if (preset["categories"] !== undefined) patch["categories"] = parseIntoList(preset["categories"]);
	if (preset["participants"] !== undefined) patch["participants"] = parseIntoList(preset["participants"]);
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

	const textFields = { location: "location", icon: "icon" } as const;
	for (const [stateKey, presetKey] of Object.entries(textFields)) {
		const val = (state[stateKey as keyof EventFormState] as string).trim();
		if (val) (preset as Record<string, unknown>)[presetKey] = val;
	}

	if (state.participants.length > 0) preset.participants = state.participants.join(", ");

	const breakValue = PositiveFloat.parse(state.breakMinutes);
	if (breakValue !== undefined) preset.breakMinutes = breakValue;

	preset.skip = state.skip;
	preset.markAsDone = state.markAsDone;

	const notifyValue = NonNegativeInt.parse(state.notifyBefore);
	if (notifyValue !== undefined) preset.notifyBefore = notifyValue;

	if (state.recurring.enabled) {
		preset.rruleType = state.recurring.rruleType;
		if (state.recurring.weekdays.length > 0) preset.rruleSpec = state.recurring.weekdays.join(", ");
		const futureCount = PositiveInt.parse(state.recurring.futureInstancesCount);
		if (futureCount !== undefined) preset.futureInstancesCount = futureCount;
	}

	return preset;
}
