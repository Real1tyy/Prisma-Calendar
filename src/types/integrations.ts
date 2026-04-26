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
	description?: string | undefined;
	color?: string | undefined;
	ctag?: string | undefined;
	syncToken?: string | undefined;
	components?: string[] | undefined;
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

/**
 * Per-(account, calendar) sync-collection state. Deliberately NOT part of the
 * settings schema — the sync-token is a per-device server cursor, and routing
 * it through `data.json` would replicate it via vault-sync (iCloud / Syncthing
 * / OneDrive) to every machine the vault is open on. Device B would then send
 * device A's cursor, the server would accept it, and B would silently miss
 * everything that changed in between. Persisted via `LocalKV` in
 * `src/core/integrations/caldav/sync.ts` (device-local `localStorage`).
 */
export const CalDAVCalendarSyncStateSchema = z
	.object({
		syncToken: z.string().optional(),
		lastSuccessfulSyncAt: z.number().int().optional(),
	})
	.loose();

export type CalDAVCalendarSyncState = z.infer<typeof CalDAVCalendarSyncStateSchema>;

export const CalDAVSettingsSchema = z
	.object({
		accounts: z.array(CalDAVAccountSchema).catch([]),
		enableAutoSync: z
			.boolean()
			.catch(true)
			.describe("Enable automatic periodic syncing based on each account's sync interval")
			.meta({ title: "Allow auto-sync" }),
		syncOnStartup: z.boolean().catch(true).describe("Automatically sync calendars when the app starts"),
		notifyOnSync: z
			.boolean()
			.catch(true)
			.describe("Show notifications when calendar sync completes")
			.meta({ title: "Show sync notifications" }),
		integrationEventColor: z
			.string()
			.catch("#8b5cf6")
			.describe("Default color for CalDAV-synced events on the calendar")
			.meta({ title: "Integration event color", widget: "color" }),
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
		enableAutoSync: z
			.boolean()
			.catch(true)
			.describe("Enable automatic periodic syncing based on subscription sync intervals")
			.meta({ title: "Allow auto-sync" }),
		syncOnStartup: z.boolean().catch(true).describe("Automatically sync subscriptions when the app starts"),
		notifyOnSync: z
			.boolean()
			.catch(true)
			.describe("Show notifications when subscription sync completes")
			.meta({ title: "Show sync notifications" }),
		integrationEventColor: z
			.string()
			.catch("#8b5cf6")
			.describe("Default color for ICS-synced events on the calendar")
			.meta({ title: "Integration event color", widget: "color" }),
	})
	.loose();
