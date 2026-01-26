import type { App } from "obsidian";
import { Notice } from "obsidian";
import type { Subscription } from "rxjs";
import { CategoryAssignModal } from "../components/modals/category-assign-modal";
import { EventCreateModal, EventEditModal } from "../components/modals";
import type { StopwatchSnapshot } from "../components/stopwatch";
import type { Frontmatter } from "../types";
import type { EventPreset } from "../types/settings";
import { getEventName } from "../utils/calendar-events";
import { getCategoriesFromFilePath } from "../utils/obsidian";
import { formatMsToHHMMSS, formatMsToMMSS } from "../utils/time-formatter";
import type { CalendarBundle } from "./calendar-bundle";
import { AssignCategoriesCommand } from "./commands/event-commands";
import type { IndexerEvent } from "./indexer";

/**
 * Base form data shared between presets and modal state.
 * Excludes date/time values which are only needed for modal restoration.
 */
export type PresetFormData = Omit<EventPreset, "id" | "name" | "createdAt" | "updatedAt">;

/**
 * Full form data extracted from modals for restoration.
 * Extends PresetFormData with date/time values for restoring modal state.
 */
export interface FormData extends PresetFormData {
	date?: string; // Date for all-day events (YYYY-MM-DD format)
	startDate?: string; // Start datetime for timed events (ISO string)
	endDate?: string; // End datetime for timed events (ISO string)
}

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
	originalFrontmatter: Frontmatter;

	// References needed to reopen
	calendarId: string;
}

/**
 * Singleton manager for tracking minimized event modals.
 * Stores the form state and continues tracking stopwatch time
 * while the modal is closed.
 *
 * Automatically updates the saved state when the underlying event file
 * is modified, but only if the stopwatch is actively running.
 */
class MinimizedModalManagerClass {
	private savedState: MinimizedModalState | null = null;
	private intervalId: number | null = null;
	private indexerSubscription: Subscription | null = null;

	/**
	 * Save modal state and start internal time tracking if stopwatch was active.
	 * Also subscribes to indexer events to auto-update when the file changes.
	 */
	saveState(state: MinimizedModalState, bundle: CalendarBundle): void {
		// Clear any existing state
		this.clear();

		this.savedState = state;

		// If stopwatch was running or paused, we track time based on timestamps
		// No interval needed since we calculate elapsed time on demand
		if (state.stopwatch.state === "running" || state.stopwatch.state === "paused") {
			this.startInternalTracking();
		}

		// Subscribe to indexer events to update the minimized modal when the file changes
		// Only update if stopwatch is running (not idle/stopped)
		if (state.stopwatch.state === "running" || state.stopwatch.state === "paused") {
			this.subscribeToFileChanges(bundle);
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
		this.unsubscribeFromFileChanges();
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

	private subscribeToFileChanges(bundle: CalendarBundle): void {
		this.unsubscribeFromFileChanges();

		this.indexerSubscription = bundle.indexer.events$.subscribe((event: IndexerEvent) => {
			if (!this.savedState || !this.savedState.filePath) {
				return;
			}

			// Only update if the event matches our minimized modal's file
			const isOurFile = event.filePath === this.savedState.filePath || event.oldPath === this.savedState.filePath;
			if (!isOurFile) {
				return;
			}

			// Only update if stopwatch is running/paused (not idle/stopped)
			// This ensures we don't override preset saves
			const isStopwatchActive =
				this.savedState.stopwatch.state === "running" || this.savedState.stopwatch.state === "paused";
			if (!isStopwatchActive) {
				return;
			}

			if (event.type === "file-deleted" && !event.isRename) {
				this.clear();
				new Notice("Minimized event was deleted");
				return;
			}

			if (event.type === "file-changed" && event.source) {
				const settings = bundle.settingsStore.currentSettings;
				const frontmatter = event.source.frontmatter;

				// Update the saved state with new frontmatter values
				// Keep stopwatch state intact - only update form data
				this.savedState = {
					...this.savedState,
					filePath: event.filePath,
					originalFrontmatter: frontmatter,
					title: getEventName(settings.titleProp, frontmatter, event.filePath),
					categories: settings.categoryProp ? (frontmatter[settings.categoryProp] as string | undefined) : undefined,
					date: frontmatter[settings.dateProp] as string | undefined,
					startDate: frontmatter[settings.startProp] as string | undefined,
					endDate: frontmatter[settings.endProp] as string | undefined,
					allDay: event.source.isAllDay,
				};
			}
		});
	}

	private unsubscribeFromFileChanges(): void {
		if (this.indexerSubscription) {
			this.indexerSubscription.unsubscribe();
			this.indexerSubscription = null;
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
			modal = new EventEditModal(app, bundle, eventData);
		} else {
			modal = new EventCreateModal(app, bundle, eventData);
		}

		modal.setRestoreState(state);
		this.clear();
		modal.open();
	}

	/**
	 * Opens category assignment modal for the minimized event.
	 * Persists category changes to the file and updates the saved state.
	 */
	assignCategories(app: App, calendarBundles: CalendarBundle[]): void {
		const state = this.getState();
		if (!state || !state.filePath) {
			new Notice("No minimized modal to assign categories to");
			return;
		}

		const bundle = calendarBundles.find((b) => b.calendarId === state.calendarId);
		if (!bundle) {
			new Notice("Calendar not found for minimized modal. This should not happen, please report this as a bug.");
			this.clear();
			return;
		}

		const settings = bundle.settingsStore.currentSettings;
		const currentCategories = getCategoriesFromFilePath(app, state.filePath, settings.categoryProp);
		const categories = bundle.categoryTracker.getCategoriesWithColors();
		const defaultColor = settings.defaultNodeColor;

		const modal = new CategoryAssignModal(
			app,
			categories,
			defaultColor,
			currentCategories,
			async (selectedCategories: string[]) => {
				try {
					const command = new AssignCategoriesCommand(app, bundle, state.filePath!, selectedCategories);
					await bundle.commandManager.executeCommand(command);
					// the indexer will detect the file change and automatically update the minimized modal state
					new Notice("Categories updated for minimized event");
				} catch (error) {
					console.error("Failed to assign categories:", error);
					new Notice("Failed to assign categories");
				}
			}
		);

		modal.open();
	}
}

export const MinimizedModalManager = new MinimizedModalManagerClass();
