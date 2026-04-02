import { z } from "zod";

export const VirtualEventDataSchema = z.object({
	id: z.string(),
	title: z.string(),
	start: z.string(),
	end: z.string().nullable(),
	allDay: z.boolean(),
	properties: z.record(z.string(), z.unknown()).default({}),
});

export const VirtualEventsFileSchema = z.array(VirtualEventDataSchema);

export type VirtualEventData = z.infer<typeof VirtualEventDataSchema>;
