import type { SingleCalendarConfig } from "../../src/types/settings";
import { createMockSingleCalendarSettings } from "../setup";

/** Factory for parser-style settings with standard property names configured. */
export function createParserSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return {
		...createMockSingleCalendarSettings(),
		startProp: "Start Date",
		endProp: "End Date",
		dateProp: "Date",
		allDayProp: "All Day",
		titleProp: "Title",
		minutesBeforeProp: "Minutes Before",
		daysBeforeProp: "Days Before",
		categoryProp: "Category",
		...overrides,
	} as SingleCalendarConfig;
}

/** Factory for notification-manager settings with notification-specific defaults. */
export function createNotificationSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return {
		...createParserSettings(),
		id: "test",
		name: "Test Calendar",
		enabled: true,
		directory: "test-dir",
		enableNotifications: true,
		notificationSound: false,
		defaultMinutesBefore: undefined,
		defaultDaysBefore: undefined,
		alreadyNotifiedProp: "Already Notified",
		...overrides,
	} as SingleCalendarConfig;
}
