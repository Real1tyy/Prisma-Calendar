import { z } from "zod";

export const ICSSubscriptionSyncMetadataSchema = z.object({
	subscriptionId: z.string(),
	uid: z.string(),
	lastModified: z.number().int().positive().optional(),
	// Legacy: see CalDAVSyncMetadataSchema — accepted, never written.
	lastSyncedAt: z.number().int().positive().optional(),
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
