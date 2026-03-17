import { z } from "zod";

// ─── CalDAV Settings Schema ─────────────────────────────────

const CalDAVAuthMethodSchema = z.enum(["Basic", "Oauth"]);

const CalDAVBasicCredentialsSchema = z
	.object({
		username: z.string().min(1),
		passwordSecretName: z.string().min(1),
	})
	.loose();

const CalDAVOAuthCredentialsSchema = z
	.object({
		tokenUrl: z.url(),
		username: z.string().min(1),
		refreshTokenSecretName: z.string().min(1),
		clientId: z.string().min(1),
		clientSecretSecretName: z.string().min(1),
	})
	.loose();

export const CalDAVAccountSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1),
		serverUrl: z.url(),
		authMethod: CalDAVAuthMethodSchema,
		credentials: z.union([CalDAVBasicCredentialsSchema, CalDAVOAuthCredentialsSchema]),
		enabled: z.boolean().catch(true),
		calendarId: z.string().min(1),
		selectedCalendars: z.array(z.string()).catch([]),
		syncIntervalMinutes: z.number().int().min(1).max(1440).catch(15),
		timezone: z.string().catch("UTC"),
		lastSyncTime: z.number().int().optional(),
		createdAt: z.number().int().positive(),
		icon: z.string().optional(),
	})
	.loose();

export type CalDAVAccount = z.infer<typeof CalDAVAccountSchema>;

export type CalDAVBasicCredentials = z.infer<typeof CalDAVBasicCredentialsSchema>;
export type CalDAVOAuthCredentials = z.infer<typeof CalDAVOAuthCredentialsSchema>;

export interface CalDAVCalendarInfo {
	url: string;
	displayName: string;
	description?: string;
	color?: string;
	ctag?: string;
	syncToken?: string;
	components?: string[];
}

export type CalDAVPresetKey = keyof typeof CALDAV_PRESETS;

export const CALDAV_PRESETS = {
	nextcloud: {
		name: "Nextcloud",
		serverUrl: "https://your-server.com/remote.php/dav",
		authMethod: "Basic" as const,
	},
	icloud: {
		name: "iCloud",
		serverUrl: "https://caldav.icloud.com/",
		authMethod: "Basic" as const,
	},
	google: {
		name: "Google Calendar",
		serverUrl: "https://apidata.googleusercontent.com/caldav/v2/",
		authMethod: "Oauth" as const,
	},
	fastmail: {
		name: "Fastmail",
		serverUrl: "https://caldav.fastmail.com/dav/",
		authMethod: "Basic" as const,
	},
	zimbra: {
		name: "Zimbra",
		serverUrl: "https://your-server.com/dav/",
		authMethod: "Basic" as const,
	},
} as const;

export const CalDAVSettingsSchema = z
	.object({
		accounts: z.array(CalDAVAccountSchema).catch([]),
		enableAutoSync: z.boolean().catch(true),
		syncOnStartup: z.boolean().catch(true),
		notifyOnSync: z.boolean().catch(true),
		integrationEventColor: z.string().catch("#8b5cf6"),
	})
	.loose();

// ─── ICS Subscription Settings Schema ───────────────────────

export const ICSSubscriptionSchema = z
	.object({
		id: z.string(),
		name: z.string().min(1),
		urlSecretName: z.string().catch(""),
		enabled: z.boolean().catch(true),
		calendarId: z.string().min(1),
		syncIntervalMinutes: z.number().int().min(1).max(1440).catch(60),
		timezone: z.string().catch("UTC"),
		lastSyncTime: z.number().int().optional(),
		createdAt: z.number().int().positive(),
		icon: z.string().optional(),
	})
	.loose();

export type ICSSubscription = z.infer<typeof ICSSubscriptionSchema>;

export const ICSSubscriptionSettingsSchema = z
	.object({
		subscriptions: z.array(ICSSubscriptionSchema).catch([]),
		enableAutoSync: z.boolean().catch(true),
		syncOnStartup: z.boolean().catch(true),
		notifyOnSync: z.boolean().catch(true),
		integrationEventColor: z.string().catch("#8b5cf6"),
	})
	.loose();
