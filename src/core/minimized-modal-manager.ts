import { ensureISOSuffix, formatMsToHHMMSS, formatMsToMMSS, toLocalISOString } from "@real1ty-obsidian-plugins";
import { Notice, TFile, type App } from "obsidian";
import type { Subscription } from "rxjs";

import type { EventFormState } from "../components/modals/event/event-form-state";
import { buildEventSaveData } from "../react/event-form/build-event-save-data";
import type { EventFormValues } from "../react/event-form/event-form";
import { openCategoryAssignModal } from "../react/modals";
import { openEventCreateModal, type EventModalData } from "../react/modals/event/event-create-modal";
import { deriveEditFormState, openEventEditModal } from "../react/modals/event/event-edit-modal";
import type { StopwatchSnapshot } from "../react/views/stopwatch";
import type { Frontmatter } from "../types";
import type { UpdateEventData } from "../types/event-boundaries";
import type { IndexerEvent } from "../types/event-source";
import type { EventPreset, SingleCalendarConfig } from "../types/settings";
import { getEventName } from "../utils/events/naming";
import { formatDateTimeForInput } from "../utils/format";
import { getCategoriesFromFilePath } from "../utils/obsidian";
import type { CalendarBundle } from "./calendar-bundle";
import { assignCategories } from "./commands/frontmatter-update-command";

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
	date?: string | undefined;
	startDate?: string | undefined;
	endDate?: string | undefined;
}

/**
 * State captured from a minimized event modal.
 * Extends FormData with stopwatch and modal metadata.
 */
export interface MinimizedModalState extends FormData {
	formState: EventFormState;

	stopwatch: StopwatchSnapshot;

	modalType: "create" | "edit";
	filePath: string | null;
	originalFrontmatter: Frontmatter;

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
export const END_TIME_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

class MinimizedModalManagerClass {
	private savedState: MinimizedModalState | null = null;
	private intervalId: number | null = null;
	private indexerSubscription: Subscription | null = null;
	private app: App | null = null;
	private bundle: CalendarBundle | null = null;

	// ─── State Management ─────────────────────────────────────────

	/**
	 * Save modal state and start internal time tracking if stopwatch was active.
	 * Also subscribes to indexer events to auto-update when the file changes.
	 */
	saveState(state: MinimizedModalState, bundle: CalendarBundle): void {
		// Clear any existing state
		this.clear();

		this.savedState = state;
		this.app = bundle.plugin.app;
		this.bundle = bundle;

		// If stopwatch was running or paused, periodically persist end time to file
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
	 * Clear the saved state and stop internal tracking.
	 */
	clear(): void {
		this.stopInternalTracking();
		this.unsubscribeFromFileChanges();
		this.savedState = null;
		this.app = null;
		this.bundle = null;
	}

	/**
	 * Check if there's a minimized modal state saved.
	 */
	hasMinimizedModal(): boolean {
		return this.savedState !== null;
	}

	/**
	 * Get the saved state, including updated stopwatch times.
	 */
	getState(): MinimizedModalState | null {
		return this.savedState;
	}

	/**
	 * Rebind a pending "create" state to "edit" once the underlying file has
	 * been persisted. Called after `bundle.createEvent` resolves with a path,
	 * so that a subsequent `restoreModal` opens the edit modal targeting the
	 * just-created file instead of opening a fresh create modal and duplicating
	 * the event.
	 *
	 * No-op when no state is saved, when the state is already an edit, or when
	 * a `create` state already has a `filePath` (defensive — shouldn't happen,
	 * but means "someone else already linked it").
	 */
	upgradeCreateToEdit(filePath: string, originalFrontmatter?: Frontmatter): void {
		if (!this.savedState) return;
		if (this.savedState.modalType !== "create" || this.savedState.filePath !== null) return;
		this.savedState.modalType = "edit";
		this.savedState.filePath = filePath;
		if (originalFrontmatter) {
			this.savedState.originalFrontmatter = { ...originalFrontmatter };
		}
	}

	// ─── Internal Time Tracking ───────────────────────────────────

	/**
	 * Start internal tracking interval that periodically persists the
	 * current end time to the event file while the stopwatch is running.
	 */
	private startInternalTracking(): void {
		this.stopInternalTracking();
		this.intervalId = window.setInterval(() => void this.persistEndTime(), END_TIME_SYNC_INTERVAL_MS);
	}

	/**
	 * Write the current time as the event's end time to the file frontmatter.
	 */
	private async persistEndTime(): Promise<void> {
		if (!this.savedState?.filePath || !this.app || !this.bundle) return;
		if (this.savedState.stopwatch.state !== "running") return;

		const settings = this.bundle.settingsStore.currentSettings;
		const file = this.app.vault.getAbstractFileByPath(this.savedState.filePath);
		if (!(file instanceof TFile)) return;

		const now = ensureISOSuffix(toLocalISOString(new Date()));
		await this.app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
			fm[settings.endProp] = now;
		});
	}

	private stopInternalTracking(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	// ─── File Change Subscription ─────────────────────────────────

	private subscribeToFileChanges(bundle: CalendarBundle): void {
		this.unsubscribeFromFileChanges();

		this.indexerSubscription = bundle.fileRepository.events$.subscribe((event: IndexerEvent) => {
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
				const metadata = event.source.metadata;

				// Update the saved state with new frontmatter values
				// Keep stopwatch state intact - only update form data
				this.savedState = {
					...this.savedState,
					filePath: event.filePath,
					originalFrontmatter: frontmatter,
					title: getEventName(settings.titleProp, frontmatter, event.filePath, settings.calendarTitleProp),
					categories: metadata.categories?.join(", "),
					location: metadata.location,
					participants: metadata.participants?.join(", "),
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

	// ─── Modal Operations ─────────────────────────────────────────

	/**
	 * Stop any running stopwatch session, then immediately start a new one
	 * for the given event and stash it as a minimized modal — no modal mount.
	 *
	 * Mirrors the old imperative `setStartStopwatchAndMinimize` flow:
	 *  - converts all-day → timed
	 *  - writes start/end to frontmatter so the file shows the new session
	 *  - leaves the stopwatch running until the user stops & saves
	 */
	startStopwatchSession(app: App, bundle: CalendarBundle, eventData: EventModalData): void {
		this.stopAndSaveCurrentEvent(app, bundle.plugin.calendarBundles);

		const settings = bundle.settingsStore.currentSettings;
		const filePath = eventData.extendedProps?.filePath ?? null;

		const derived = deriveEditFormState(app, bundle, eventData);
		const now = new Date();
		const end = new Date(now.getTime() + 5 * 60 * 1000);
		const nowIso = toLocalISOString(now);
		const endIso = toLocalISOString(end);

		const formState: EventFormState = {
			...derived.initialState,
			allDay: false,
			start: formatDateTimeForInput(now),
			end: formatDateTimeForInput(end),
			date: "",
		};

		const stopwatch: StopwatchSnapshot = {
			state: "running",
			startTime: now.getTime(),
			sessionStartTime: now.getTime(),
			breakStartTime: null,
			totalBreakMs: 0,
		};

		const state: MinimizedModalState = {
			formState,
			stopwatch,
			modalType: "edit",
			filePath,
			originalFrontmatter: derived.originalFrontmatter,
			calendarId: bundle.calendarId,
			title: formState.title,
			allDay: false,
			categories: formState.categories.join(", "),
			location: formState.location,
			participants: formState.participants.join(", "),
			startDate: nowIso,
			endDate: endIso,
		};

		this.saveState(state, bundle);

		if (filePath) {
			void this.writeStopwatchStart(app, filePath, settings, nowIso, endIso);
		}

		new Notice("Time tracker started");
	}

	private async writeStopwatchStart(
		app: App,
		filePath: string,
		settings: SingleCalendarConfig,
		startIso: string,
		endIso: string
	): Promise<void> {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!(file instanceof TFile)) return;
		try {
			await app.fileManager.processFrontMatter(file, (fm: Frontmatter) => {
				fm[settings.startProp] = ensureISOSuffix(startIso);
				fm[settings.endProp] = ensureISOSuffix(endIso);
				if (settings.allDayProp && fm[settings.allDayProp]) {
					fm[settings.allDayProp] = false;
				}
			});
		} catch (error) {
			console.error("[MinimizedModal] Failed to write stopwatch start:", error);
		}
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
			new Notice("Planning system not found for minimized modal");
			this.clear();
			return;
		}

		this.openRestoredModal(app, bundle, state);
	}

	/**
	 * Stop the running stopwatch and save the current minimized event without
	 * mounting a modal. Drives the React save path (`buildEventSaveData` →
	 * `bundle.updateEvent` / `bundle.createEvent`) directly with the in-memory
	 * snapshot, mirroring what the imperative `setSilentStopAndSave` flow did
	 * via a hidden modal mount (see base-event-modal.ts:217-222).
	 */
	stopAndSaveCurrentEvent(_app: App, calendarBundles: CalendarBundle[]): void {
		const state = this.getState();
		if (!state) return;

		const isStopwatchActive = state.stopwatch.state === "running" || state.stopwatch.state === "paused";
		if (!isStopwatchActive) {
			this.clear();
			return;
		}

		const bundle = calendarBundles.find((b) => b.calendarId === state.calendarId);
		if (!bundle) {
			this.clear();
			return;
		}

		// Snapshot the inputs we need before we clear our state.
		const settings = bundle.settingsStore.currentSettings;
		const originalFrontmatter = state.originalFrontmatter;
		const customProperties = state.customProperties ?? {};
		const filePath = state.filePath;
		const modalType = state.modalType;

		// Compute the "stopped" snapshot — applyStop folds any pending paused
		// break (now − breakStartTime) into totalBreakMs so the additional
		// break time accrued between minimize and silent-stop is captured.
		const stoppedSnapshot = applyStop(state.stopwatch);

		// Mirror the imperative onStop + onBreakUpdate callbacks: write the
		// current time as End, and roll any additional break minutes since the
		// modal was minimized into the form's breakMinutes field so the saved
		// frontmatter matches what stopwatch.stop() would have produced.
		const now = new Date();
		const additionalBreakMs = stoppedSnapshot.totalBreakMs - state.stopwatch.totalBreakMs;
		const breakMinutes =
			additionalBreakMs > 0
				? mergeBreakMinutes(state.formState.breakMinutes, additionalBreakMs)
				: state.formState.breakMinutes;
		const formState: EventFormState = {
			...state.formState,
			end: formatDateTimeForInput(now),
			breakMinutes,
		};

		const values: EventFormValues = {
			formState,
			customProperties,
			stopwatchSnapshot: stoppedSnapshot,
			// initialMarkAsDone: best-effort from the saved formState; we don't
			// track the original explicitly in MinimizedModalState.
			// writeMetadataToFrontmatter compares before/after, so when the saved
			// formState already has markAsDone=true, replaying it is a no-op.
			initialMarkAsDoneState: formState.markAsDone,
		};

		const saveData = buildEventSaveData(
			values,
			settings,
			originalFrontmatter,
			new Set(Object.keys(customProperties)),
			bundle.plugin.syncStore.data.readOnly
		);

		this.clear();

		if (modalType === "edit" && filePath) {
			const updateData: UpdateEventData = { ...saveData, filePath };
			bundle
				.updateEvent(updateData, { ensureZettelId: true })
				.catch((error: unknown) => console.error("[MinimizedModal] silent stop & save (edit) failed:", error));
			return;
		}

		bundle
			.createEvent(saveData)
			.catch((error: unknown) => console.error("[MinimizedModal] silent stop & save (create) failed:", error));
	}

	private openRestoredModal(app: App, bundle: CalendarBundle, state: MinimizedModalState): void {
		const eventData = this.buildEventDataFromState(state);

		this.clear();

		if (state.modalType === "edit" && state.filePath) {
			openEventEditModal(app, bundle, eventData, { restoreState: state });
		} else {
			openEventCreateModal(app, bundle, eventData, { restoreState: state });
		}
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
			new Notice("Planning system not found for minimized modal. This should not happen, please report this as a bug.");
			this.clear();
			return;
		}

		const settings = bundle.settingsStore.currentSettings;
		const currentCategories = getCategoriesFromFilePath(app, state.filePath, settings.categoryProp);
		const categories = bundle.categoryTracker.getCategoriesWithColors();
		const defaultColor = settings.defaultNodeColor;

		void openCategoryAssignModal(app, categories, defaultColor, currentCategories).then(async (selectedCategories) => {
			if (!selectedCategories) return;
			try {
				if (!state.filePath) return;
				const command = assignCategories(bundle, state.filePath, selectedCategories);
				await bundle.commandManager.executeCommand(command);
				new Notice("Categories updated for minimized event");
			} catch (error) {
				console.error("[MinimizedModal] Failed to assign categories:", error);
				new Notice("Failed to assign categories");
			}
		});
	}

	/**
	 * Build event data object from minimized modal state.
	 */
	private buildEventDataFromState(state: MinimizedModalState) {
		return {
			title: state.title ?? "",
			start: state.startDate ?? (state.formState.start || null),
			end: state.endDate ?? (state.formState.end || null),
			allDay: state.allDay ?? false,
			extendedProps: {
				filePath: state.filePath,
			},
		};
	}

	// ─── Public Query API ──────────────────────────────────────────

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

	formatElapsed(): string {
		return formatMsToHHMMSS(this.getElapsedMs());
	}

	formatBreak(): string {
		return formatMsToMMSS(this.getBreakMs());
	}
}

export const MinimizedModalManager = new MinimizedModalManagerClass();

/**
 * Compute the snapshot a stopwatch would have after firing `stop()`. Used by
 * the silent-stop-and-save path so the saved frontmatter / values reflect the
 * final break time. Mirrors stopwatch.tsx:139-153.
 */
function applyStop(snapshot: StopwatchSnapshot): StopwatchSnapshot {
	let totalBreakMs = snapshot.totalBreakMs;
	if (snapshot.state === "paused" && snapshot.breakStartTime !== null) {
		totalBreakMs += Date.now() - snapshot.breakStartTime;
	}
	return {
		...snapshot,
		state: "stopped",
		breakStartTime: null,
		totalBreakMs,
	};
}

/**
 * Add additional break milliseconds to the form's breakMinutes field.
 * Mirrors the imperative onBreakUpdate handler:
 * `setSimpleFieldValues({ breakMinutes: initial + accumulated })`. The
 * pre-minimize total is already baked into `current`, so we only need to
 * fold in the delta since minimize.
 */
function mergeBreakMinutes(current: string, additionalMs: number): string {
	const additionalMinutes = Math.round((additionalMs / 60000) * 100) / 100;
	const existing = Number.parseFloat(current || "0");
	const base = Number.isFinite(existing) ? existing : 0;
	const total = Math.round((base + additionalMinutes) * 100) / 100;
	return total.toString();
}
