const CALENDAR_VIEW_TYPE = "custom-calendar-view";

export function getCalendarViewType(calendarId: string): string {
	return `${CALENDAR_VIEW_TYPE}-${calendarId}`;
}
