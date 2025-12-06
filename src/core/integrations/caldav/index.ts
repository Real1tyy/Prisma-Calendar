// CalDAV Integration Module
// Re-exports all CalDAV-related functionality

export {
	CalDAVClientService,
	type CalDAVConnectionResult,
	type CalDAVFetchEventsOptions,
	type CalDAVFetchedEvent,
} from "./client";
export { obsidianFetch, patchGlobalFetch, restoreGlobalFetch } from "./obsidian-fetch";
export { CalDAVSyncService, type CalDAVSyncServiceOptions } from "./sync";
export {
	// Presets
	CALDAV_PRESETS,
	// Types
	type CalDAVAccount,
	// Schemas
	CalDAVAccountSchema,
	type CalDAVAuthMethod,
	CalDAVAuthMethodSchema,
	type CalDAVBasicCredentials,
	CalDAVBasicCredentialsSchema,
	type CalDAVCalendarInfo,
	type CalDAVOAuthCredentials,
	CalDAVOAuthCredentialsSchema,
	type CalDAVPresetKey,
	type CalDAVSettings,
	CalDAVSettingsSchema,
	type CalDAVStoredCalendar,
	type CalDAVStoredObject,
	type CalDAVSyncMetadata,
	CalDAVSyncMetadataSchema,
	type CalDAVSyncResult,
} from "./types";
