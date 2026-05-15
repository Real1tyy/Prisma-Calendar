import type { Calendar } from "@fullcalendar/core";

interface CalendarViewState {
	/** Current view type (e.g., 'dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek') */
	viewType: string;
	/** Current date being viewed as ISO string */
	currentDate: string;
	/** Current zoom level (slot duration in minutes) */
	zoomLevel: number;
}

export class CalendarViewStateManager {
	private state: CalendarViewState | null = null;

	saveState(calendar: Calendar, zoomLevel: number): void {
		// FullCalendar's typings say `view` is always present, but in practice it
		// can be null while the calendar is mid-init/destroy. The guard matters
		// for tests and for save-on-unload paths that fire before render.
		const view = calendar.view as Calendar["view"] | null;
		if (!view) return;
		this.state = {
			viewType: view.type,
			currentDate: calendar.getDate().toISOString(),
			zoomLevel: zoomLevel,
		};
	}

	restoreState(calendar: Calendar): void {
		if (!this.state) return;

		calendar.changeView(this.state.viewType);
		calendar.gotoDate(new Date(this.state.currentDate));
	}

	getSavedZoomLevel(): number | null {
		return this.state?.zoomLevel ?? null;
	}

	getCurrentState(): CalendarViewState | null {
		return this.state;
	}

	clear(): void {
		this.state = null;
	}

	hasState(): boolean {
		return this.state !== null;
	}
}
