// CalDAV Integration Module
// Re-exports all CalDAV-related functionality

export { CalDAVClientService } from "./client";

export {
	// Presets
	CALDAV_PRESETS,
	// Types
	type CalDAVAccount,
	// Schemas

	type CalDAVCalendarInfo,
	type CalDAVPresetKey,
	CalDAVSettingsSchema,
} from "./types";
