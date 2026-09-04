import { z } from "zod";

export const CalDAVSyncMetadataSchema = z.object({
	accountId: z.string(),
	calendarHref: z.string(),
	objectHref: z.string(),
	etag: z.string(),
	uid: z.string(),
	lastModified: z.number().int().positive().optional(),
	// Legacy: the write moment on the writing device, dropped from every new
	// write because two devices can never agree on it. Still accepted so notes
	// written before the change parse; the next update removes it.
	lastSyncedAt: z.number().int().positive().optional(),
});

export type CalDAVSyncMetadata = z.infer<typeof CalDAVSyncMetadataSchema>;

export interface CalDAVStoredCalendar {
	url: string;
	displayName: string;
	accountId: string;
	ctag?: string | undefined;
	syncToken?: string | undefined;
	objects: CalDAVStoredObject[];
}

interface CalDAVStoredObject {
	url: string;
	etag: string;
	uid: string;
	localFilePath?: string | undefined;
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
