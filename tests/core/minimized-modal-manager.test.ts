import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StopwatchSnapshot } from "../../src/components/stopwatch";
import { MinimizedModalManager, type MinimizedModalState } from "../../src/core/minimized-modal-manager";

describe("MinimizedModalManager", () => {
	beforeEach(() => {
		MinimizedModalManager.clear();
		vi.useFakeTimers();
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
			MinimizedModalManager.saveState(state);

			const retrieved = MinimizedModalManager.getState();
			expect(retrieved).toEqual(state);
		});

		it("should return null when no state is saved", () => {
			expect(MinimizedModalManager.getState()).toBeNull();
		});

		it("should overwrite previous state when saving new state", () => {
			const state1 = createMockState({ title: "First Event" });
			const state2 = createMockState({ title: "Second Event" });

			MinimizedModalManager.saveState(state1);
			MinimizedModalManager.saveState(state2);

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

			MinimizedModalManager.saveState(state);
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

			MinimizedModalManager.saveState(state);
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
			MinimizedModalManager.saveState(createMockState());
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(true);
		});

		it("should return false after clearing state", () => {
			MinimizedModalManager.saveState(createMockState());
			MinimizedModalManager.clear();
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(false);
		});
	});

	describe("clear", () => {
		it("should clear saved state", () => {
			MinimizedModalManager.saveState(createMockState());
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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

			expect(MinimizedModalManager.getBreakMinutes()).toBe(1.5);
		});

		it("should round to 2 decimal places", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 100000, // 1.666... minutes
				}),
			});
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

			expect(MinimizedModalManager.formatBreak()).toBe("00:30");
		});

		it("should format minutes and seconds correctly", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 125000, // 2 minutes 5 seconds
				}),
			});
			MinimizedModalManager.saveState(state);

			expect(MinimizedModalManager.formatBreak()).toBe("02:05");
		});

		it("should handle large minute values", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({
					state: "running",
					totalBreakMs: 3600000, // 60 minutes
				}),
			});
			MinimizedModalManager.saveState(state);

			expect(MinimizedModalManager.formatBreak()).toBe("60:00");
		});
	});

	describe("stopwatch state handling", () => {
		it("should preserve idle stopwatch state", () => {
			const state = createMockState({
				stopwatch: createMockStopwatchSnapshot({ state: "idle" }),
			});
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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
			MinimizedModalManager.saveState(state);

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

			MinimizedModalManager.saveState(state);

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

			MinimizedModalManager.saveState(state);

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

			MinimizedModalManager.saveState(state1);
			expect(MinimizedModalManager.getState()?.title).toBe("First");

			// Saving new state should replace old state
			MinimizedModalManager.saveState(state2);
			expect(MinimizedModalManager.getState()?.title).toBe("Second");

			// Only one state should exist
			expect(MinimizedModalManager.hasMinimizedModal()).toBe(true);
		});

		it("should clear state after restore", () => {
			MinimizedModalManager.saveState(createMockState());
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
				startDate: undefined,
				endDate: undefined,
			});

			MinimizedModalManager.saveState(state);
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

			MinimizedModalManager.saveState(state);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.rruleType).toBe("bi-weekly");
			expect(retrieved?.rruleSpec).toBe("tuesday, thursday");
			expect(retrieved?.futureInstancesCount).toBe(10);
		});

		it("should handle empty custom properties", () => {
			const state = createMockState({
				customProperties: {},
			});

			MinimizedModalManager.saveState(state);
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

			MinimizedModalManager.saveState(state);
			const retrieved = MinimizedModalManager.getState();

			expect(retrieved?.customProperties).toEqual({
				tags: ["work", "urgent"],
				priority: 1,
				completed: false,
				notes: "Some notes here",
			});
		});
	});
});
