import { ensureISOSuffix, toLocalISOString } from "@real1ty-obsidian-plugins";
import { Subject } from "rxjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDefaultState } from "../../src/components/modals/event/event-form-state";
import type { CalendarBundle } from "../../src/core/calendar-bundle";
import {
	END_TIME_SYNC_INTERVAL_MS,
	MinimizedModalManager,
	type MinimizedModalState,
} from "../../src/core/minimized-modal-manager";
import type { StopwatchSnapshot } from "../../src/react/views/stopwatch";
import type { Frontmatter } from "../../src/types";
import type { IndexerEvent } from "../../src/types/event-source";
import { formatDateTimeForInput } from "../../src/utils/format";
import { TFile } from "../mocks/obsidian";

describe("MinimizedModalManager", () => {
	let mockBundle: Partial<CalendarBundle>;
	let mockIndexerEventsSubject: Subject<IndexerEvent>;

	beforeEach(() => {
		MinimizedModalManager.clear();
		vi.useFakeTimers();

		// Create a mock indexer events subject
		mockIndexerEventsSubject = new Subject();

		// Create a mock bundle with minimal required properties
		mockBundle = {
			plugin: {
				app: {},
			} as any,
			fileRepository: {
				events$: mockIndexerEventsSubject.asObservable(),
			} as any,
			settingsStore: {
				currentSettings: {
					titleProp: "Title",
					categoryProp: "Category",
					statusProperty: "Status",
					notesProp: "Notes",
					dateProp: "Date",
					startProp: "Start Date",
					endProp: "End Date",
					allDayProp: "All Day",
				},
			} as any,
		};
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	const createMockStopwatchSnapshot = (overrides: Partial<StopwatchSnapshot> = {}): StopwatchSnapshot => ({
		state: "idle",
		startTime: null,
		breakStartTime: null,
		sessionStartTime: null,
		totalBreakMs: 0,
		...overrides,
	});

	const createMockState = (overrides: Partial<MinimizedModalState> = {}): MinimizedModalState => ({
		formState: createDefaultState(),
		stopwatch: createMockStopwatchSnapshot(),
		modalType: "create",
		filePath: null,
		originalFrontmatter: {},
		calendarId: "test-calendar",
		...overrides,
	});

	describe("saveState and getState", () => {
		it("should save and retrieve state", () => {
			const state = createMockState({ title: "Test Event" });
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			const retrieved = MinimizedModalManager.getState();
			expect(retrieved).toEqual(state);
		});

		it("should return null when no state is saved", () => {
			expect(MinimizedModalManager.getState()).toBeNull();
		});

		it("should overwrite previous state when saving new state", () => {
			const state1 = createMockState({ title: "First Event" });
			const state2 = createMockState({ title: "Second Event" });

			MinimizedModalManager.saveState(state1, mockBundle as CalendarBundle);
			MinimizedModalManager.saveState(state2, mockBundle as CalendarBundle);

			const retrieved = MinimizedModalManager.getState();
			expect(retrieved?.title).toBe("Second Event");
		});

		it("should preserve all form data fields", () => {
			const state = createMockState({
				title: "Meeting",
				allDay: false,
				startDate: "2025-01-15T10:00:00",
				endDate: "2025-01-15T11:00:00",
				categories: "work, important",
				breakMinutes: 15,
				rruleType: "weekly",
				rruleSpec: "monday, wednesday",
				futureInstancesCount: 5,
				customProperties: { priority: "high" },
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.title).toBe("Meeting");
			expect(retrieved?.allDay).toBe(false);
			expect(retrieved?.startDate).toBe("2025-01-15T10:00:00");
			expect(retrieved?.endDate).toBe("2025-01-15T11:00:00");
			expect(retrieved?.categories).toBe("work, important");
			expect(retrieved?.breakMinutes).toBe(15);
			expect(retrieved?.rruleType).toBe("weekly");
			expect(retrieved?.rruleSpec).toBe("monday, wednesday");
			expect(retrieved?.futureInstancesCount).toBe(5);
			expect(retrieved?.customProperties).toEqual({ priority: "high" });
		});

		it("should preserve modal metadata", () => {
			const state = createMockState({
				modalType: "edit",
				filePath: "/path/to/event.md",
				originalFrontmatter: { existingProp: "value" },
				calendarId: "my-calendar",
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.modalType).toBe("edit");
			expect(retrieved?.filePath).toBe("/path/to/event.md");
			expect(retrieved?.originalFrontmatter).toEqual({ existingProp: "value" });
			expect(retrieved?.calendarId).toBe("my-calendar");
		});
	});

	describe("hasMinimizedModal", () => {
		it("should return false when no state is saved", () => {
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
		});

		it("should return true when state is saved", () => {
			MinimizedModalManager.saveState(createMockState(), mockBundle as CalendarBundle);
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(true);
		});

		it("should return false after clearing state", () => {
			MinimizedModalManager.saveState(createMockState(), mockBundle as CalendarBundle);
			MinimizedModalManager.clear();
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
		});
	});

	describe("clear", () => {
		it("should clear saved state", () => {
			MinimizedModalManager.saveState(createMockState(), mockBundle as CalendarBundle);
			MinimizedModalManager.clear();

			expect(MinimizedModalManager.getState()).toBeNull();
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
		});

		it("should be safe to call when no state exists", () => {
			expect(() => MinimizedModalManager.clear()).not.toThrow();
		});
	});

	describe("getElapsedMs", () => {
		it("should return 0 when no state is saved", () => {
			expect(MinimizedModalManager.getElapsedMs()).toBe(0);
		});

		it("should return 0 when stopwatch has no start time", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({ startTime: null }),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getElapsedMs()).toBe(0);
		});

		it("should calculate elapsed time from start time to now", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const startTime = now - 60000; // 1 minute ago
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getElapsedMs()).toBe(60000);
		});

		it("should update elapsed time as time passes", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const startTime = now;
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getElapsedMs()).toBe(0);

			// Advance time by 30 seconds
			vi.advanceTimersByTime(30000);
			expect(MinimizedModalManager.getElapsedMs()).toBe(30000);

			// Advance time by another 30 seconds
			vi.advanceTimersByTime(30000);
			expect(MinimizedModalManager.getElapsedMs()).toBe(60000);
		});
	});

	describe("getBreakMs", () => {
		it("should return 0 when no state is saved", () => {
			expect(MinimizedModalManager.getBreakMs()).toBe(0);
		});

		it("should return totalBreakMs when not currently on break", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 120000, // 2 minutes
					breakStartTime: null,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getBreakMs()).toBe(120000);
		});

		it("should include current break time when paused", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const breakStartTime = now - 30000; // Break started 30 seconds ago
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "paused",
					totalBreakMs: 60000, // 1 minute of previous breaks
					breakStartTime,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			// Should be 60000 + 30000 = 90000
			expect(MinimizedModalManager.getBreakMs()).toBe(90000);
		});

		it("should not add current break when running (not paused)", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// Even if breakStartTime is set, it shouldn't count if state is "running"
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 60000,
					breakStartTime: now - 30000, // This should be ignored
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getBreakMs()).toBe(60000);
		});

		it("should update break time as time passes when paused", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "paused",
					totalBreakMs: 0,
					breakStartTime: now,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getBreakMs()).toBe(0);

			vi.advanceTimersByTime(15000);
			expect(MinimizedModalManager.getBreakMs()).toBe(15000);

			vi.advanceTimersByTime(15000);
			expect(MinimizedModalManager.getBreakMs()).toBe(30000);
		});
	});

	describe("getBreakMinutes", () => {
		it("should return 0 when no break time", () => {
			expect(MinimizedModalManager.getBreakMinutes()).toBe(0);
		});

		it("should convert milliseconds to minutes with 2 decimal places", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 90000, // 1.5 minutes
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getBreakMinutes()).toBe(1.5);
		});

		it("should round to 2 decimal places", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 100000, // 1.666... minutes
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.getBreakMinutes()).toBe(1.67);
		});
	});

	describe("formatElapsed", () => {
		it("should format 0 as 00:00:00", () => {
			expect(MinimizedModalManager.formatElapsed()).toBe("00:00:00");
		});

		it("should format seconds correctly", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime: now - 45000, // 45 seconds
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.formatElapsed()).toBe("00:00:45");
		});

		it("should format minutes correctly", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime: now - 185000, // 3 minutes 5 seconds
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.formatElapsed()).toBe("00:03:05");
		});

		it("should format hours correctly", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime: now - 3723000, // 1 hour 2 minutes 3 seconds
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.formatElapsed()).toBe("01:02:03");
		});

		it("should handle large values", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime: now - 36000000, // 10 hours
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.formatElapsed()).toBe("10:00:00");
		});
	});

	describe("formatBreak", () => {
		it("should format 0 as 00:00", () => {
			expect(MinimizedModalManager.formatBreak()).toBe("00:00");
		});

		it("should format seconds correctly", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 30000, // 30 seconds
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.formatBreak()).toBe("00:30");
		});

		it("should format minutes and seconds correctly", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 125000, // 2 minutes 5 seconds
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.formatBreak()).toBe("02:05");
		});

		it("should handle large minute values", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 3600000, // 60 minutes
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			expect(MinimizedModalManager.formatBreak()).toBe("60:00");
		});
	});

	describe("stopwatch state handling", () => {
		it("should preserve idle stopwatch state", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({ state: "idle" }),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			const retrieved = MinimizedModalManager.getState();
			expect(retrieved?.stopwatch.state).toBe("idle");
		});

		it("should preserve running stopwatch state", () => {
			const now = Date.now();
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime: now - 60000,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			const retrieved = MinimizedModalManager.getState();
			expect(retrieved?.stopwatch.state).toBe("running");
		});

		it("should preserve paused stopwatch state", () => {
			const now = Date.now();
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "paused",
					startTime: now - 120000,
					breakStartTime: now - 30000,
					totalBreakMs: 15000,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			const retrieved = MinimizedModalManager.getState();
			expect(retrieved?.stopwatch.state).toBe("paused");
			expect(retrieved?.stopwatch.breakStartTime).toBe(now - 30000);
		});

		it("should preserve stopped stopwatch state", () => {
			const now = Date.now();
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "stopped",
					startTime: now - 300000,
					totalBreakMs: 60000,
				}),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			const retrieved = MinimizedModalManager.getState();
			expect(retrieved?.stopwatch.state).toBe("stopped");
		});
	});

	describe("integration scenarios", () => {
		it("should handle create modal workflow", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// User starts creating an event with stopwatch running
			const state = createMockState({
				modalType: "create",
				filePath: null,
				title: "New Task",
				startDate: new Date(now).toISOString(),
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					startTime: now,
				}),
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			// Time passes while modal is minimized
			vi.advanceTimersByTime(300000); // 5 minutes

			// User restores modal
			const restored = MinimizedModalManager.getState();
			expect(restored?.modalType).toBe("create");
			expect(restored?.filePath).toBeNull();
			expect(MinimizedModalManager.getElapsedMs()).toBe(300000);
			expect(MinimizedModalManager.formatElapsed()).toBe("00:05:00");
		});

		it("should handle edit modal workflow with file path", () => {
			const now = Date.now();
			vi.setSystemTime(now);

			// User is editing an existing event
			const state = createMockState({
				modalType: "edit",
				filePath: "/Events/meeting.md",
				title: "Team Meeting",
				originalFrontmatter: {
					"Start Date": "2025-01-15T10:00:00",
					"End Date": "2025-01-15T11:00:00",
				},
				stopwatch: createMockStopwatchSnapshot({
					state: "paused",
					startTime: now - 1800000, // 30 minutes ago
					breakStartTime: now - 300000, // Break started 5 minutes ago
					totalBreakMs: 600000, // 10 minutes of previous breaks
				}),
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			// Time passes
			vi.advanceTimersByTime(300000); // 5 more minutes

			const restored = MinimizedModalManager.getState();
			expect(restored?.modalType).toBe("edit");
			expect(restored?.filePath).toBe("/Events/meeting.md");
			expect(restored?.originalFrontmatter).toEqual({
				"Start Date": "2025-01-15T10:00:00",
				"End Date": "2025-01-15T11:00:00",
			});

			// Break should be 10 min previous + 5 min when saved + 5 min after = 20 min
			expect(MinimizedModalManager.getBreakMs()).toBe(1200000);
			expect(MinimizedModalManager.getBreakMinutes()).toBe(20);
		});

		it("should handle multiple minimize/restore cycles by replacing state", () => {
			const state1 = createMockState({ title: "First" });
			const state2 = createMockState({ title: "Second" });

			MinimizedModalManager.saveState(state1, mockBundle as CalendarBundle);
			expect(MinimizedModalManager.getState()?.title).toBe("First");

			// Saving new state should replace old state
			MinimizedModalManager.saveState(state2, mockBundle as CalendarBundle);
			expect(MinimizedModalManager.getState()?.title).toBe("Second");

			// Only one state should exist
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(true);
		});

		it("should clear state after restore", () => {
			MinimizedModalManager.saveState(createMockState(), mockBundle as CalendarBundle);
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(true);

			// Simulate restore by getting state and clearing
			const state = MinimizedModalManager.getState();
			expect(state).not.toBeNull();

			MinimizedModalManager.clear();
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
			expect(MinimizedModalManager.getState()).toBeNull();
		});
	});

	describe("edge cases", () => {
		it("should handle all-day event state", () => {
			const state = createMockState({
				allDay: true,
				date: "2025-01-15",
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.allDay).toBe(true);
			expect(retrieved?.date).toBe("2025-01-15");
			expect(retrieved?.startDate).toBeUndefined();
			expect(retrieved?.endDate).toBeUndefined();
		});

		it("should handle recurring event state", () => {
			const state = createMockState({
				rruleType: "bi-weekly",
				rruleSpec: "tuesday, thursday",
				futureInstancesCount: 10,
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.rruleType).toBe("bi-weekly");
			expect(retrieved?.rruleSpec).toBe("tuesday, thursday");
			expect(retrieved?.futureInstancesCount).toBe(10);
		});

		it("should handle empty custom properties", () => {
			const state = createMockState({
				customProperties: {},
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.customProperties).toEqual({});
		});

		it("should handle complex custom properties", () => {
			const state = createMockState({
				customProperties: {
					tags: ["work", "urgent"],
					priority: 1,
					completed: false,
					notes: "Some notes here",
				},
			});

			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.customProperties).toEqual({
				tags: ["work", "urgent"],
				priority: 1,
				completed: false,
				notes: "Some notes here",
			});
		});
	});

	// Regression: creating an event while the stopwatch was running auto-saved
	// the form to MinimizedModalManager with `modalType: "create"` /
	// `filePath: null`, then the user restored — opening a FRESH create modal
	// that, when saved again, persisted a DUPLICATE file instead of editing
	// the original. After bundle.createEvent resolves with the new path,
	// upgradeCreateToEdit must rebind the saved state so a subsequent restore
	// edits the just-created file.
	describe("upgradeCreateToEdit — Bug 2 regression", () => {
		const runningStopwatch = (): StopwatchSnapshot => ({
			state: "running",
			startTime: Date.now(),
			sessionStartTime: Date.now(),
			breakStartTime: null,
			totalBreakMs: 0,
		});

		it("upgrades a pending create state to edit with the new filePath", () => {
			const state = createMockState({
				title: "Tracked Event",
				stopwatch: runningStopwatch(),
				modalType: "create",
				filePath: null,
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			MinimizedModalManager.upgradeCreateToEdit("Tasks/Tracked-Event-20260518193815.md");

			const upgraded = MinimizedModalManager.getState();
			expect(upgraded?.modalType).toBe("edit");
			expect(upgraded?.filePath).toBe("Tasks/Tracked-Event-20260518193815.md");
		});

		it("captures the just-created frontmatter when provided so subsequent saves preserve fields", () => {
			const state = createMockState({
				title: "Tracked Event",
				stopwatch: runningStopwatch(),
				modalType: "create",
				filePath: null,
				originalFrontmatter: {},
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			const persistedFm = { Title: "Tracked Event", Category: "Work" };
			MinimizedModalManager.upgradeCreateToEdit("Tasks/Tracked-Event-20260518193815.md", persistedFm);

			expect(MinimizedModalManager.getState()?.originalFrontmatter).toEqual(persistedFm);
		});

		it("no-ops when no minimized state is saved", () => {
			// Should not throw and should not invent a new state.
			MinimizedModalManager.upgradeCreateToEdit("Tasks/Some-File.md");
			expect(MinimizedModalManager.getState()).toBeNull();
		});

		it("no-ops when the saved state is already an edit", () => {
			const state = createMockState({
				title: "Already Linked Event",
				modalType: "edit",
				filePath: "Tasks/Existing.md",
				stopwatch: runningStopwatch(),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			MinimizedModalManager.upgradeCreateToEdit("Tasks/Different.md");

			const after = MinimizedModalManager.getState();
			expect(after?.modalType).toBe("edit");
			expect(after?.filePath).toBe("Tasks/Existing.md");
		});

		it("no-ops when a create state already has a filePath (defensive)", () => {
			const state = createMockState({
				title: "Already Linked Create",
				modalType: "create",
				filePath: "Tasks/Existing.md",
				stopwatch: runningStopwatch(),
			});
			MinimizedModalManager.saveState(state, mockBundle as CalendarBundle);

			MinimizedModalManager.upgradeCreateToEdit("Tasks/Different.md");

			expect(MinimizedModalManager.getState()?.filePath).toBe("Tasks/Existing.md");
		});
	});

	// Regression: persistEndTime synced End to disk but left formState.end (what
	// restore reads) stale, so a long-running minimized tracker restored with an
	// outdated End. The sync now updates the snapshot too.
	describe("persistEndTime — reflects the file sync into the saved snapshot", () => {
		function buildSyncBundle(writtenFm: Frontmatter): CalendarBundle {
			const file = new TFile("events/active.md");
			return {
				calendarId: "test-calendar",
				plugin: {
					app: {
						vault: { getAbstractFileByPath: vi.fn(() => file) },
						fileManager: {
							processFrontMatter: vi.fn(async (_f: unknown, cb: (fm: Frontmatter) => void) => cb(writtenFm)),
						},
					},
				},
				fileRepository: { events$: mockIndexerEventsSubject.asObservable() },
				settingsStore: { currentSettings: { endProp: "End Date" } },
			} as unknown as CalendarBundle;
		}

		it("advances formState.end and endDate to now while running", async () => {
			const base = new Date("2026-05-20T10:00:00");
			vi.setSystemTime(base);
			const writtenFm: Frontmatter = {};
			const bundle = buildSyncBundle(writtenFm);

			MinimizedModalManager.saveState(
				createMockState({
					modalType: "edit",
					filePath: "events/active.md",
					endDate: "2026-05-20T09:05:00",
					formState: { ...createDefaultState(), end: "2026-05-20T09:05" },
					stopwatch: createMockStopwatchSnapshot({ state: "running", startTime: base.getTime() }),
				}),
				bundle
			);

			await vi.advanceTimersByTimeAsync(END_TIME_SYNC_INTERVAL_MS);

			const now = new Date(base.getTime() + END_TIME_SYNC_INTERVAL_MS);
			const updated = MinimizedModalManager.getState();
			expect(updated?.formState.end).toBe(formatDateTimeForInput(now));
			expect(updated?.endDate).toBe(ensureISOSuffix(toLocalISOString(now)));
			expect(writtenFm["End Date"]).toBe(ensureISOSuffix(toLocalISOString(now)));
		});

		it("leaves the snapshot untouched while paused (break time is not billable)", async () => {
			const base = new Date("2026-05-20T10:00:00");
			vi.setSystemTime(base);
			const bundle = buildSyncBundle({});

			MinimizedModalManager.saveState(
				createMockState({
					modalType: "edit",
					filePath: "events/active.md",
					formState: { ...createDefaultState(), end: "2026-05-20T09:05" },
					stopwatch: createMockStopwatchSnapshot({
						state: "paused",
						startTime: base.getTime(),
						breakStartTime: base.getTime(),
					}),
				}),
				bundle
			);

			await vi.advanceTimersByTimeAsync(END_TIME_SYNC_INTERVAL_MS);

			expect(MinimizedModalManager.getState()?.formState.end).toBe("2026-05-20T09:05");
		});
	});

	describe("file rename — rebind tracking instead of dropping the session", () => {
		const OLD_PATH = "Events/old-meeting.md";
		const NEW_PATH = "Events/new-meeting.md";

		const saveRunningEditState = (filePath: string) =>
			MinimizedModalManager.saveState(
				createMockState({
					modalType: "edit",
					filePath,
					title: "Old Title",
					stopwatch: createMockStopwatchSnapshot({ state: "running", startTime: Date.now() }),
				}),
				mockBundle as CalendarBundle
			);

		const emitRenameTo = (newPath: string, title: string) =>
			mockIndexerEventsSubject.next({
				type: "file-changed",
				filePath: newPath,
				oldPath: OLD_PATH,
				source: {
					filePath: newPath,
					mtime: 1,
					frontmatter: {
						Title: title,
						"Start Date": "2026-05-20T10:00:00",
						"End Date": "2026-05-20T11:00:00",
						"All Day": false,
					},
					folder: "Events",
					isAllDay: false,
					isUntracked: false,
					metadata: { categories: ["Work"], location: "Room 1", participants: ["Alice"] },
				},
			});

		it("keeps the session and rebinds to the new path across a rename's two halves", () => {
			saveRunningEditState(OLD_PATH);

			// Old-path half of the rename carries isRename — must NOT clear.
			mockIndexerEventsSubject.next({ type: "file-deleted", filePath: OLD_PATH, isRename: true });
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(true);

			// New-path half carries oldPath — matches via oldPath and rebinds.
			emitRenameTo(NEW_PATH, "Renamed Title");

			const state = MinimizedModalManager.getState();
			expect(state?.filePath).toBe(NEW_PATH);
			expect(state?.title).toBe("Renamed Title");
		});

		it("still clears when the tracked file is genuinely deleted (no isRename)", () => {
			saveRunningEditState(OLD_PATH);

			mockIndexerEventsSubject.next({ type: "file-deleted", filePath: OLD_PATH });

			expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
		});
	});
});
