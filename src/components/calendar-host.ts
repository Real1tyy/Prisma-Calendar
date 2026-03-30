/**
 * Interface for components that host a FullCalendar instance and support
 * navigation/highlight actions. Used by EventContextMenu to decouple
 * from the concrete CalendarComponent class.
 */
export interface CalendarHost {
	navigateToDate(date: Date, viewType?: string): void;
	highlightEventByPath(filePath: string, durationMs?: number): void;
	enterPrerequisiteSelectionMode(targetFilePath: string): void;
}
