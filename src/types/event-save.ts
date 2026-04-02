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
