import type { App } from "obsidian";
import { Notice } from "obsidian";
import { EventCreateModal, EventEditModal } from "../components/modals";
import type { StopwatchSnapshot } from "../components/stopwatch";
import type { EventPreset } from "../types/settings";
import { formatMsToHHMMSS, formatMsToMMSS } from "../utils/time-formatter";
import type { CalendarBundle } from "./calendar-bundle";

/**
 * Form data extracted from modals - uses EventPreset fields.
 * Omits id, name, createdAt, updatedAt since those are preset-specific.
 */
export type FormData = Omit<EventPreset, "id" | "name" | "createdAt" | "updatedAt">;

/**
 * State captured from a minimized event modal.
 * Extends FormData with stopwatch and modal metadata.
 */
export interface MinimizedModalState extends FormData {
	// Stopwatch state (for continuing time tracking)
	stopwatch: StopwatchSnapshot;

	// Modal metadata
	modalType: "create" | "edit";
	filePath: string | null;
	originalFrontmatter: Record<string, unknown>;

	// References needed to reopen
	calendarId: string;
}

/**
 * Singleton manager for tracking minimized event modals.
 * Stores the form state and continues tracking stopwatch time
 * while the modal is closed.
 */
class MinimizedModalManagerClass {
	private savedState: MinimizedModalState | null = null;
	private intervalId: number | null = null;

	/**
	 * Save modal state and start internal time tracking if stopwatch was active.
	 */
	saveState(state: MinimizedModalState): void {
		// Clear any existing state
		this.clear();

		this.savedState = state;

		// If stopwatch was running or paused, we track time based on timestamps
		// No interval needed since we calculate elapsed time on demand
		if (state.stopwatch.state === "running" || state.stopwatch.state === "paused") {
			this.startInternalTracking();
		}
	}

	/**
	 * Get the saved state, including updated stopwatch times.
	 */
	getState(): MinimizedModalState | null {
		return this.savedState;
	}

	/**
	 * Check if there's a minimized modal state saved.
	 */
	hasMinimizedModal(): boolean {
		return this.savedState !== null;
	}

	/**
	 * Clear the saved state and stop internal tracking.
	 */
	clear(): void {
		this.stopInternalTracking();
		this.savedState = null;
	}

	/**
	 * Get the current stopwatch elapsed time in milliseconds.
	 * Returns 0 if no active stopwatch.
	 */
	getElapsedMs(): number {
		if (!this.savedState?.stopwatch.startTime) {
			return 0;
		}
		return Date.now() - this.savedState.stopwatch.startTime;
	}

	/**
	 * Get the current break time in milliseconds.
	 */
	getBreakMs(): number {
		if (!this.savedState) {
			return 0;
		}

		let breakMs = this.savedState.stopwatch.totalBreakMs;

		// If currently on break, add time since break started
		if (this.savedState.stopwatch.state === "paused" && this.savedState.stopwatch.breakStartTime) {
			breakMs += Date.now() - this.savedState.stopwatch.breakStartTime;
		}

		return breakMs;
	}

	/**
	 * Get break time in minutes (decimal).
	 */
	getBreakMinutes(): number {
		return Math.round((this.getBreakMs() / 60000) * 100) / 100;
	}

	/**
	 * Start internal time tracking interval.
	 * This keeps time running even though modal is closed.
	 */
	private startInternalTracking(): void {
		// We don't actually need an interval since we track based on timestamps
		// But we could use this to periodically update UI indicators if needed
		this.stopInternalTracking();
	}

	private stopInternalTracking(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	formatElapsed(): string {
		return formatMsToHHMMSS(this.getElapsedMs());
	}

	formatBreak(): string {
		return formatMsToMMSS(this.getBreakMs());
	}

	/**
	 * Restore a minimized modal by reopening it with the saved state.
	 * Requires the app instance and calendar bundles to find the correct calendar.
	 */
	restoreModal(app: App, calendarBundles: CalendarBundle[]): void {
		const state = this.getState();
		if (!state) {
			new Notice("No minimized modal to restore");
			return;
		}

		const bundle = calendarBundles.find((b) => b.calendarId === state.calendarId);
		if (!bundle) {
			new Notice("Calendar not found for minimized modal");
			this.clear();
			return;
		}

		const eventData = {
			title: state.title ?? "",
			start: state.startDate ?? null,
			end: state.endDate ?? null,
			allDay: state.allDay ?? false,
			extendedProps: {
				filePath: state.filePath,
			},
		};

		let modal: EventCreateModal | EventEditModal;
		if (state.modalType === "edit" && state.filePath) {
			modal = new EventEditModal(app, bundle, eventData, (saveData) => {
				void bundle.updateEvent(saveData);
			});
		} else {
			modal = new EventCreateModal(app, bundle, eventData, (saveData) => {
				void bundle.createEvent(saveData);
			});
		}

		modal.setRestoreState(state);
		this.clear();
		modal.open();
	}
}

export const MinimizedModalManager = new MinimizedModalManagerClass();
