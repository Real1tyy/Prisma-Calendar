import { z } from "zod";

// ─── Save Boundary Schemas ───────────────────────────────────────────
// Validated at the boundary when events are created or updated.

const BaseEventFieldsSchema = z.object({
	title: z.string(),
	start: z.string(),
	end: z.string().nullable(),
	allDay: z.boolean(),
	preservedFrontmatter: z.record(z.string(), z.unknown()),
});

export const CreateEventDataSchema = BaseEventFieldsSchema.extend({
	virtual: z.boolean(),
});

export const UpdateEventDataSchema = BaseEventFieldsSchema.extend({
	filePath: z.string(),
});

export const EventSaveDataSchema = BaseEventFieldsSchema.extend({
	filePath: z.string().nullable(),
	virtual: z.boolean(),
});

export type CreateEventData = z.infer<typeof CreateEventDataSchema>;
export type UpdateEventData = z.infer<typeof UpdateEventDataSchema>;
export type EventSaveData = z.infer<typeof EventSaveDataSchema>;

// ─── Form Boundary Schemas ───────────────────────────────────────────
// Shapes used inside the event edit modal's form state.

export const EventEditableFieldsSchema = z.object({
	title: z.string().optional(),
	allDay: z.boolean().optional(),
	location: z.string().optional().describe("Event location"),
	icon: z.string().optional().describe("Event icon (emoji or text)"),
	participants: z.array(z.string()).optional().describe("Event participants"),
	categories: z.array(z.string()).optional().describe("Event categories"),
	breakMinutes: z.number().nonnegative().optional().describe("Break time in minutes"),
	notifyBefore: z.number().int().nonnegative().optional().describe("Notification lead time"),
	markAsDone: z.boolean().optional().describe("Mark as done"),
	skip: z.boolean().optional().describe("Hide event from calendar"),
});

export type EventEditableFields = z.infer<typeof EventEditableFieldsSchema>;

export const EventEditableFormFieldsSchema = z.object({
	location: z.string().default("").describe("Event location").meta({ placeholder: "Event location" }),
	icon: z.string().default("").describe("Event icon (emoji or text)").meta({ placeholder: "Emoji or text" }),
	breakMinutes: z.string().default("").describe("Break time in minutes").meta({ placeholder: "0" }),
	notifyBefore: z.string().default("").describe("Notification lead time"),
	markAsDone: z.boolean().default(false).describe("Mark as done"),
	skip: z.boolean().default(false).describe("Hide event from calendar"),
});

export type EventEditableFormFields = z.infer<typeof EventEditableFormFieldsSchema>;

// ─── Form → Domain Transform Primitives ──────────────────────────────

export const TrimmedOptionalString = z.string().transform((s: string) => s.trim() || undefined);

export const PositiveFloat = z.string().transform((s: string) => {
	const n = Number.parseFloat(s);
	return !Number.isNaN(n) && n > 0 ? n : undefined;
});

export const NonNegativeInt = z.string().transform((s: string) => {
	const n = Number.parseInt(s, 10);
	return !Number.isNaN(n) && n >= 0 ? n : undefined;
});

export const PositiveInt = z.string().transform((s: string) => {
	const n = Number.parseInt(s, 10);
	return !Number.isNaN(n) && n > 0 ? n : undefined;
});

export const FormToFieldsSchema = z.object({
	location: TrimmedOptionalString.optional(),
	icon: TrimmedOptionalString.optional(),
	breakMinutes: PositiveFloat.optional(),
	markAsDone: z.boolean().optional().default(false),
	skip: z.boolean().optional().default(false),
});
