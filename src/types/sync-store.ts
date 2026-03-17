import { z } from "zod";

export const PrismaSyncDataSchema = z
	.object({
		readOnly: z.boolean().catch(false),
		lastUsedCalendarId: z.string().optional(),
	})
	.strip();

type PrismaSyncData = z.infer<typeof PrismaSyncDataSchema>;
