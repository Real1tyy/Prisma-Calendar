/**
 * Regression tests for MinimizedModalManager after the React modal migration.
 *
 * The legacy manager imported the imperative EventCreateModal/EventEditModal
 * from src/components/modals and instantiated them on restore. After the
 * migration to React the manager must route through the React openers
 * (`openEventCreateModal` / `openEventEditModal`) and provide a no-mount
 * "silent stop & save" path.
 *
 * Mapping: this file pins findings #1, #2, #11 from
 * docs/specs/2026-05-15-event-modal-react-migration-parity.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultState } from "../../src/components/modals/event/event-form-state";
import type { CalendarBundle } from "../../src/core/calendar-bundle";
import { MinimizedModalManager, type MinimizedModalState } from "../../src/core/minimized-modal-manager";
import type { StopwatchSnapshot } from "../../src/react/views/stopwatch";

const openCreateSpy = vi.fn();
const openEditSpy = vi.fn();

vi.mock("../../src/react/modals/event/event-create-modal", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		openEventCreateModal: (...args: unknown[]) => openCreateSpy(...args),
	};
});

vi.mock("../../src/react/modals/event/event-edit-modal", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		openEventEditModal: (...args: unknown[]) => openEditSpy(...args),
	};
});

function mockBundle(overrides: Partial<CalendarBundle> = {}): CalendarBundle {
	return {
		calendarId: "test-calendar",
		plugin: {
			app: {} as never,
			syncStore: { data: { readOnly: false } },
		} as never,
		fileRepository: { events$: { subscribe: () => ({ unsubscribe: () => undefined }) } } as never,
		settingsStore: {
			currentSettings: {
				titleProp: "Title",
				startProp: "Start Date",
				endProp: "End Date",
				dateProp: "Date",
				allDayProp: "All Day",
				categoryProp: "Category",
				participantsProp: "Participants",
				prerequisiteProp: "Prerequisites",
				skipProp: "Skip",
				rruleProp: "RRule",
				rruleSpecProp: "RRuleSpec",
				rruleUntilProp: "RRuleUntil",
				rruleIdProp: "RRuleID",
				futureInstancesCountProp: "FutureCount",
				generatePastEventsProp: "GenPast",
				minutesBeforeProp: "MinBefore",
				daysBeforeProp: "DaysBefore",
				zettelIdProp: "ZettelID",
				notesProp: "Notes",
				breakProp: "Break",
				locationProp: "Location",
				iconProp: "Icon",
				statusProperty: "Status",
				skipNewlyCreatedNotifications: false,
				enableNotifications: false,
				categoryAssignmentPresets: [],
				frontmatterDisplayProperties: [],
				frontmatterDisplayPropertiesAllDay: [],
			} as never,
		} as never,
		updateEvent: vi.fn().mockResolvedValue(null),
		createEvent: vi.fn().mockResolvedValue(null),
		...overrides,
	} as unknown as CalendarBundle;
}

function snapshot(overrides: Partial<StopwatchSnapshot> = {}): StopwatchSnapshot {
	return {
		state: "idle",
		startTime: null,
		breakStartTime: null,
		sessionStartTime: null,
		totalBreakMs: 0,
		...overrides,
	};
}

function buildState(overrides: Partial<MinimizedModalState> = {}): MinimizedModalState {
	return {
		formState: createDefaultState(),
		stopwatch: snapshot(),
		modalType: "create",
		filePath: null,
		originalFrontmatter: {},
		calendarId: "test-calendar",
		...overrides,
	};
}

beforeEach(() => {
	openCreateSpy.mockClear();
	openEditSpy.mockClear();
	MinimizedModalManager.clear();
});

afterEach(() => {
	MinimizedModalManager.clear();
});

describe("MinimizedModalManager.restoreModal — regression #1: routes through React openers", () => {
	it("calls openEventCreateModal when modalType is 'create'", () => {
		const bundle = mockBundle();
		const state = buildState({ modalType: "create" });
		MinimizedModalManager.saveState(state, bundle);

		MinimizedModalManager.restoreModal(bundle.plugin.app, [bundle]);

		expect(openCreateSpy).toHaveBeenCalledTimes(1);
		expect(openEditSpy).not.toHaveBeenCalled();
		// React opener is called with the state passed in options.
		const args = openCreateSpy.mock.calls[0]!;
		const options = args[3] as { restoreState?: MinimizedModalState };
		expect(options?.restoreState).toBeDefined();
		expect(options!.restoreState).toEqual(state);
	});

	it("calls openEventEditModal when modalType is 'edit' and filePath is set", () => {
		const bundle = mockBundle();
		const state = buildState({ modalType: "edit", filePath: "events/test.md" });
		MinimizedModalManager.saveState(state, bundle);

		MinimizedModalManager.restoreModal(bundle.plugin.app, [bundle]);

		expect(openEditSpy).toHaveBeenCalledTimes(1);
		expect(openCreateSpy).not.toHaveBeenCalled();
		const args = openEditSpy.mock.calls[0]!;
		const options = args[3] as { restoreState?: MinimizedModalState };
		expect(options?.restoreState).toEqual(state);
	});

	it("falls back to openEventCreateModal when modalType is 'edit' but no filePath was saved", () => {
		const bundle = mockBundle();
		const state = buildState({ modalType: "edit", filePath: null });
		MinimizedModalManager.saveState(state, bundle);

		MinimizedModalManager.restoreModal(bundle.plugin.app, [bundle]);

		expect(openCreateSpy).toHaveBeenCalledTimes(1);
		expect(openEditSpy).not.toHaveBeenCalled();
	});

	it("clears its saved state once the restore is dispatched", () => {
		const bundle = mockBundle();
		MinimizedModalManager.saveState(buildState(), bundle);
		expect(MinimizedModalManager.hasMinimizedModal()).toBe(true);

		MinimizedModalManager.restoreModal(bundle.plugin.app, [bundle]);
		expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
	});
});

describe("MinimizedModalManager.stopAndSaveCurrentEvent — regression #2: silent stop & save", () => {
	it("clears the manager state when no stopwatch is running", () => {
		const bundle = mockBundle();
		MinimizedModalManager.saveState(buildState({ stopwatch: snapshot({ state: "idle" }) }), bundle);

		MinimizedModalManager.stopAndSaveCurrentEvent(bundle.plugin.app, [bundle]);

		expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
		expect(openCreateSpy).not.toHaveBeenCalled();
		expect(openEditSpy).not.toHaveBeenCalled();
	});

	it("does NOT mount a modal — neither React opener should be invoked", () => {
		const bundle = mockBundle();
		const running = snapshot({
			state: "running",
			startTime: Date.now(),
			sessionStartTime: Date.now(),
		});
		MinimizedModalManager.saveState(
			buildState({ stopwatch: running, modalType: "edit", filePath: "events/active.md" }),
			bundle
		);

		MinimizedModalManager.stopAndSaveCurrentEvent(bundle.plugin.app, [bundle]);

		// After the migration the manager should drive the save in-memory and clear its state.
		// Neither React opener is allowed to mount a modal for this silent path.
		expect(openCreateSpy).not.toHaveBeenCalled();
		expect(openEditSpy).not.toHaveBeenCalled();
		expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
	});

	it("rolls additional paused-break time into the saved breakMinutes (imperative parity)", async () => {
		// Mirrors the imperative silent-stop path: stopwatch.stop() fires
		// onBreakUpdate(finalBreakMs) which writes initial + accumulated break
		// into the form, THEN saveEvent reads it. The React direct path must
		// add any break that accrued between minimize and silent-stop.
		const updateEvent = vi.fn().mockResolvedValue("events/active.md");
		const bundle = mockBundle({ updateEvent });
		const breakStartedTwoMinutesAgo = Date.now() - 2 * 60 * 1000;
		const paused = snapshot({
			state: "paused",
			startTime: Date.now() - 10 * 60 * 1000,
			sessionStartTime: Date.now() - 10 * 60 * 1000,
			breakStartTime: breakStartedTwoMinutesAgo,
			totalBreakMs: 60_000, // 1 minute already accumulated before minimize
		});
		MinimizedModalManager.saveState(
			buildState({
				stopwatch: paused,
				modalType: "edit",
				filePath: "events/active.md",
				formState: {
					...createDefaultState(),
					title: "Active",
					start: "2026-05-15T09:00",
					end: "2026-05-15T10:00",
					breakMinutes: "1", // baked-in pre-minimize total
				},
			}),
			bundle
		);

		MinimizedModalManager.stopAndSaveCurrentEvent(bundle.plugin.app, [bundle]);

		await Promise.resolve();
		await Promise.resolve();

		expect(updateEvent).toHaveBeenCalledTimes(1);
		const saveData = updateEvent.mock.calls[0]![0] as { preservedFrontmatter: Record<string, unknown> };
		const writtenBreak = Number(saveData.preservedFrontmatter["Break"]);
		// 1 (pre-minimize) + ~2 (paused for 2 min while minimized) ≈ 3.
		expect(writtenBreak).toBeGreaterThanOrEqual(2.5);
		expect(writtenBreak).toBeLessThanOrEqual(3.5);
	});

	it("leaves breakMinutes unchanged when the stopwatch was running (not paused) at stop", async () => {
		const updateEvent = vi.fn().mockResolvedValue("events/active.md");
		const bundle = mockBundle({ updateEvent });
		const running = snapshot({
			state: "running",
			startTime: Date.now() - 10 * 60 * 1000,
			sessionStartTime: Date.now() - 10 * 60 * 1000,
			totalBreakMs: 60_000,
		});
		MinimizedModalManager.saveState(
			buildState({
				stopwatch: running,
				modalType: "edit",
				filePath: "events/active.md",
				formState: {
					...createDefaultState(),
					title: "Active",
					start: "2026-05-15T09:00",
					end: "2026-05-15T10:00",
					breakMinutes: "1",
				},
			}),
			bundle
		);

		MinimizedModalManager.stopAndSaveCurrentEvent(bundle.plugin.app, [bundle]);

		await Promise.resolve();
		await Promise.resolve();

		const saveData = updateEvent.mock.calls[0]![0] as { preservedFrontmatter: Record<string, unknown> };
		expect(Number(saveData.preservedFrontmatter["Break"])).toBe(1);
	});

	it("persists the stopped event by calling bundle.updateEvent for an edit-mode entry", async () => {
		const updateEvent = vi.fn().mockResolvedValue("events/active.md");
		const bundle = mockBundle({ updateEvent });
		const running = snapshot({
			state: "running",
			startTime: Date.now() - 10 * 60 * 1000,
			sessionStartTime: Date.now() - 10 * 60 * 1000,
		});
		MinimizedModalManager.saveState(
			buildState({
				stopwatch: running,
				modalType: "edit",
				filePath: "events/active.md",
				formState: { ...createDefaultState(), title: "Active", start: "2026-05-15T09:00", end: "2026-05-15T10:00" },
			}),
			bundle
		);

		MinimizedModalManager.stopAndSaveCurrentEvent(bundle.plugin.app, [bundle]);

		// Allow the promise chain to settle.
		await Promise.resolve();
		await Promise.resolve();

		expect(updateEvent).toHaveBeenCalledTimes(1);
		expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
	});
});

describe("MinimizedModalManager — regression #10: after-rename filePath sync (covered via direct API)", () => {
	it("exposes a way to update the stored filePath when the underlying event file is renamed", () => {
		const bundle = mockBundle();
		const running = snapshot({ state: "running", startTime: Date.now(), sessionStartTime: Date.now() });
		const initial = buildState({ stopwatch: running, modalType: "edit", filePath: "events/before.md" });
		MinimizedModalManager.saveState(initial, bundle);

		// The fix patches the saved state when a rename happens in handleEditSubmit.
		// The test verifies the public surface: save under one path, then re-save
		// the same state with the new path — manager should adopt the new path.
		const renamed: MinimizedModalState = { ...initial, filePath: "events/after.md" };
		MinimizedModalManager.saveState(renamed, bundle);

		const current = MinimizedModalManager.getState();
		expect(current?.filePath).toBe("events/after.md");
	});
});

// ─── Bug D: restore opens the React modal with the saved state ──────────
//
// User report: starting the stopwatch then closing the modal produces a
// state the manager cannot restore from. This pins the contract: restoreModal
// must dispatch through the React opener AND forward the stopwatch snapshot
// in `restoreState` so the new EventForm boots running.

describe("MinimizedModalManager.restoreModal — forwards stopwatch + filePath", () => {
	it("forwards a 'running' stopwatch snapshot to the React opener", () => {
		const bundle = mockBundle();
		const runningSnapshot = snapshot({
			state: "running",
			startTime: Date.now(),
			sessionStartTime: Date.now(),
		});
		const state = buildState({ modalType: "create", stopwatch: runningSnapshot });
		MinimizedModalManager.saveState(state, bundle);

		MinimizedModalManager.restoreModal(bundle.plugin.app, [bundle]);

		expect(openCreateSpy).toHaveBeenCalledTimes(1);
		const options = openCreateSpy.mock.calls[0]![3] as { restoreState?: MinimizedModalState };
		expect(options.restoreState?.stopwatch.state).toBe("running");
		expect(options.restoreState?.stopwatch.startTime).toBe(runningSnapshot.startTime);
	});

	it("forwards the saved filePath for edit-mode restore so the same file is reopened", () => {
		const bundle = mockBundle();
		const state = buildState({
			modalType: "edit",
			filePath: "events/work-session.md",
			stopwatch: snapshot({ state: "running", startTime: Date.now(), sessionStartTime: Date.now() }),
		});
		MinimizedModalManager.saveState(state, bundle);

		MinimizedModalManager.restoreModal(bundle.plugin.app, [bundle]);

		expect(openEditSpy).toHaveBeenCalledTimes(1);
		const eventData = openEditSpy.mock.calls[0]![2] as { extendedProps?: { filePath?: string | null } };
		expect(eventData.extendedProps?.filePath).toBe("events/work-session.md");
		const options = openEditSpy.mock.calls[0]![3] as { restoreState?: MinimizedModalState };
		expect(options.restoreState?.filePath).toBe("events/work-session.md");
	});

	it("does NOT call any opener when there is no saved state", () => {
		const bundle = mockBundle();
		MinimizedModalManager.clear();

		MinimizedModalManager.restoreModal(bundle.plugin.app, [bundle]);

		expect(openCreateSpy).not.toHaveBeenCalled();
		expect(openEditSpy).not.toHaveBeenCalled();
	});
});
