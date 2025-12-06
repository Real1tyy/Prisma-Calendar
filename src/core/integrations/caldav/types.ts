import { z } from "zod";
import { CALDAV_DEFAULTS } from "../../../constants";

export const CalDAVAuthMethodSchema = z.enum(["Basic", "Oauth"]);
export type CalDAVAuthMethod = z.infer<typeof CalDAVAuthMethodSchema>;

export const CalDAVBasicCredentialsSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

export const CalDAVOAuthCredentialsSchema = z.object({
	tokenUrl: z.url(),
	username: z.string().min(1),
	refreshToken: z.string().min(1),
	clientId: z.string().min(1),
	clientSecret: z.string().min(1),
});

export const CalDAVAccountSchema = z.object({
	id: z.string(),
	name: z.string().min(1),
	serverUrl: z.url(),
	authMethod: CalDAVAuthMethodSchema,
	credentials: z.union([CalDAVBasicCredentialsSchema, CalDAVOAuthCredentialsSchema]),
	enabled: z.boolean().default(true),
	syncDirectory: z.string().min(1),
	selectedCalendars: z.array(z.string()).default([]),
	syncIntervalMinutes: z.number().int().min(1).max(1440).default(15),
	lastSyncTime: z.number().int().optional(),
	createdAt: z.number().int().positive(),
});

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

export const CalDAVSyncMetadataSchema = z.object({
	href: z.string(),
	etag: z.string(),
	accountId: z.string(),
	calendarUrl: z.string(),
	uid: z.string(),
});

export type CalDAVSyncMetadata = z.infer<typeof CalDAVSyncMetadataSchema>;

export interface CalDAVStoredCalendar {
	url: string;
	displayName: string;
	accountId: string;
	ctag?: string;
	syncToken?: string;
	objects: CalDAVStoredObject[];
}

export interface CalDAVStoredObject {
	url: string;
	etag: string;
	uid: string;
	localFilePath?: string;
}

export interface CalDAVSyncResult {
	success: boolean;
	accountId: string;
	calendarUrl: string;
	created: number;
	updated: number;
	deleted: number;
	errors: string[];
}

export const CalDAVSyncStateDataSchema = z.record(
	z.string(),
	z.object({
		calendars: z.array(
			z.object({
				url: z.string(),
				displayName: z.string(),
				accountId: z.string(),
				ctag: z.string().optional(),
				syncToken: z.string().optional(),
				objects: z.array(
					z.object({
						url: z.string(),
						etag: z.string(),
						uid: z.string(),
						localFilePath: z.string().optional(),
					})
				),
			})
		),
		lastSyncTime: z.number(),
	})
);

export type CalDAVSyncStateData = z.infer<typeof CalDAVSyncStateDataSchema>;

export const CalDAVSettingsSchema = z.object({
	accounts: z.array(CalDAVAccountSchema).default([]),
	enableAutoSync: z.boolean().default(false),
	syncOnStartup: z.boolean().default(true),
	caldavProp: z.string().default(CALDAV_DEFAULTS.CALDAV_PROP),
	syncState: CalDAVSyncStateDataSchema.default({}),
});

export type CalDAVSettings = z.infer<typeof CalDAVSettingsSchema>;

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

export type CalDAVPresetKey = keyof typeof CALDAV_PRESETS;
