import { z } from "zod";
import { SETTINGS_DEFAULTS } from "../constants";

export const PrismaSyncDataSchema = z
	.object({
		readOnly: z.boolean().catch(SETTINGS_DEFAULTS.DEFAULT_READ_ONLY),
	})
	.strip();

export type PrismaSyncData = z.infer<typeof PrismaSyncDataSchema>;
