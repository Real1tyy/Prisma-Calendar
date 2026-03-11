import { z } from "zod";

const ISODatetimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

const EventFieldsSchema = z.object({
	title: z.string().min(1),
	start: ISODatetimeSchema,
	end: ISODatetimeSchema,
	allDay: z.boolean().optional(),
	categories: z.array(z.string()).optional(),
	location: z.string().optional(),
	participants: z.array(z.string()).optional(),
});

export const CreateOpSchema = EventFieldsSchema.extend({
	type: z.literal("create"),
});

export const EditOpSchema = EventFieldsSchema.partial().extend({
	type: z.literal("edit"),
	filePath: z.string().min(1),
});

export const DeleteOpSchema = z.object({
	type: z.literal("delete"),
	filePath: z.string().min(1),
});

export const AIOperationsSchema = z.array(z.discriminatedUnion("type", [CreateOpSchema, EditOpSchema, DeleteOpSchema]));

export type AIOperation = z.infer<typeof AIOperationsSchema>[number];
