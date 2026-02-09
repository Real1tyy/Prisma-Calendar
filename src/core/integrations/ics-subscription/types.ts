import { z } from "zod";

export const ICSSubscriptionSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1),
		url: z.url(),
		enabled: z.boolean().catch(true),
		calendarId: z.string().min(1),
		syncIntervalMinutes: z.number().int().min(1).max(1440).catch(60),
		timezone: z.string().catch("UTC"),
		lastSyncTime: z.number().int().optional(),
		createdAt: z.number().int().positive(),
	})
	.loose();

export type ICSSubscription = z.infer<typeof ICSSubscriptionSchema>;

/**
 * ICS subscription sync metadata stored in frontmatter under the icsSubscriptionProp setting.
 * This structure allows tracking which subscription owns each event and detecting changes.
 */
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

export const ICSSubscriptionSettingsSchema = z
	.object({
		subscriptions: z.array(ICSSubscriptionSchema).catch([]),
		enableAutoSync: z.boolean().catch(true),
		syncOnStartup: z.boolean().catch(true),
		notifyOnSync: z.boolean().catch(true),
	})
	.loose();

export type ICSSubscriptionSettings = z.infer<typeof ICSSubscriptionSettingsSchema>;
