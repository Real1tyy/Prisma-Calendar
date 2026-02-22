import type { ICSExportOptions } from "../../src/core/integrations/ics-export";
import type { ImportedEvent } from "../../src/core/integrations/ics-import";

/** Factory for ICSExportOptions with sensible test defaults. */
export function createICSExportOptions(overrides: Partial<ICSExportOptions> = {}): ICSExportOptions {
	return {
		calendarName: "Test Calendar",
		vaultName: "TestVault",
		timezone: "UTC",
		noteContents: new Map(),
		categoryProp: "Category",
		locationProp: "Location",
		participantsProp: "Participants",
		notifications: {
			minutesBeforeProp: "Minutes Before",
			daysBeforeProp: "Days Before",
		},
		excludeProps: {
			startProp: "Start Date",
			endProp: "End Date",
			dateProp: "Date",
			allDayProp: "All Day",
			titleProp: "Title",
		},
		...overrides,
	};
}

/** Factory for ImportedEvent (ICS import result). Dates are Date objects, not strings. */
export function createImportedEvent(overrides: Partial<ImportedEvent> = {}): ImportedEvent {
	return {
		title: "Test Event",
		start: new Date("2025-01-15T13:00:00.000Z"),
		end: new Date("2025-01-15T14:00:00.000Z"),
		allDay: false,
		uid: "test-uid",
		...overrides,
	};
}
