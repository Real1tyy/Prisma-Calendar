import { z } from "zod";

export const ICSSubscriptionSyncMetadataSchema = z.object({
	subscriptionId: z.string(),
	uid: z.string(),
	lastModified: z.number().int().positive().optional(),
	lastSyncedAt: z.number().int().positive(),
});

export type ICSSubscriptionSyncMetadata = z.infer<typeof ICSSubscriptionSyncMetadataSchema>;

export interface ICSSubscriptionSyncResult {
	success: boolean;
	subscriptionId: string;
	created: number;
	updated: number;
	deleted: number;
	errors: string[];
}
