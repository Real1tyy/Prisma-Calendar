import { z } from "zod";

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
	calendarId: z.string().min(1),
	selectedCalendars: z.array(z.string()).default([]),
	syncIntervalMinutes: z.number().int().min(1).max(1440).default(15),
	timezone: z.string().default("UTC"),
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

/**
 * CalDAV sync metadata stored in frontmatter under the caldavProp setting
 * This structure allows incremental sync using etags and UIDs
 */
export const CalDAVSyncMetadataSchema = z.object({
	accountId: z.string(),
	calendarHref: z.string(),
	objectHref: z.string(),
	etag: z.string(),
	uid: z.string(),
	lastModified: z.number().int().positive().optional(),
	lastSyncedAt: z.number().int().positive(),
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

export const CalDAVSettingsSchema = z.object({
	accounts: z.array(CalDAVAccountSchema).default([]),
	enableAutoSync: z.boolean().default(true),
	syncOnStartup: z.boolean().default(true),
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
