import { describe, expect, it } from "vitest";
import type { ParsedEvent } from "../../src/core/parser";
import {
	aggregateMonthlyStats,
	aggregateWeeklyStats,
	formatDuration,
	formatDurationAsDecimalHours,
	formatPercentage,
	getEventDuration,
	getEventsInRange,
	getMonthBounds,
	getWeekBounds,
} from "../../src/utils/weekly-stats";

describe("getEventDuration", () => {
	it("should calculate duration for timed events with end time", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Meeting",
			start: "2025-02-03T10:00:00Z",
			end: "2025-02-03T11:30:00Z",
			allDay: false,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(90 * 60 * 1000); // 90 minutes in milliseconds
	});

	it("should return 0 for timed events without end time", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Meeting",
			start: "2025-02-03T10:00:00Z",
			allDay: false,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(0);
	});

	it("should assume 1 day duration for all-day events without end time", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "All Day Event",
			start: "2025-02-03T00:00:00Z",
			allDay: true,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(24 * 60 * 60 * 1000); // 24 hours in milliseconds
	});

	it("should calculate duration for all-day events with end time", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Multi-day Event",
			start: "2025-02-03T00:00:00Z",
			end: "2025-02-05T00:00:00Z",
			allDay: true,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(2 * 24 * 60 * 60 * 1000); // 2 days in milliseconds
	});

	it("should handle very short durations (15 minutes)", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Quick Standup",
			start: "2025-02-03T09:00:00Z",
			end: "2025-02-03T09:15:00Z",
			allDay: false,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(15 * 60 * 1000);
	});

	it("should handle events spanning multiple days", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Conference",
			start: "2025-02-03T09:00:00Z",
			end: "2025-02-05T17:00:00Z",
			allDay: false,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		// 2 days (48h) + 8 hours = 56 hours
		expect(duration).toBe(56 * 60 * 60 * 1000);
	});

	it("should handle events crossing midnight", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Night Shift",
			start: "2025-02-03T22:00:00Z",
			end: "2025-02-04T06:00:00Z",
			allDay: false,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(8 * 60 * 60 * 1000); // 8 hours
	});

	it("should handle events with same start and end time", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Instant Event",
			start: "2025-02-03T10:00:00Z",
			end: "2025-02-03T10:00:00Z",
			allDay: false,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(0);
	});

	it("should handle all-day events spanning a week", () => {
		const event: ParsedEvent = {
			id: "1",
			ref: { filePath: "test.md" },
			title: "Vacation",
			start: "2025-02-03T00:00:00Z",
			end: "2025-02-10T00:00:00Z",
			allDay: true,
			isVirtual: false,
			skipped: false,
		};

		const duration = getEventDuration(event);
		expect(duration).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
	});
});

describe("getWeekBounds", () => {
	it("should return Monday to Sunday for a date in the middle of the week", () => {
		const date = new Date("2025-02-05T12:00:00"); // Wednesday (local time)
		const { start, end } = getWeekBounds(date);

		expect(start.getDay()).toBe(1); // Monday
		expect(end.getDay()).toBe(1); // Monday (next week)
		expect(start.getHours()).toBe(0);
		expect(start.getMinutes()).toBe(0);
		expect(start.getSeconds()).toBe(0);

		// Check that it's 7 days apart
		const diffInDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
		expect(diffInDays).toBe(7);
	});

	it("should handle Sunday correctly", () => {
		const date = new Date("2025-02-09T12:00:00"); // Sunday (local time)
		const { start, end } = getWeekBounds(date);

		expect(start.getDay()).toBe(1); // Monday
		expect(start.getDate()).toBe(3); // 3rd of February
		expect(end.getDate()).toBe(10); // 10th of February
	});

	it("should handle Monday correctly", () => {
		const date = new Date("2025-02-03T12:00:00"); // Monday (local time)
		const { start, end } = getWeekBounds(date);

		expect(start.getDay()).toBe(1); // Monday
		expect(start.getDate()).toBe(3); // Should stay on the 3rd
		expect(end.getDate()).toBe(10); // 10th of February
	});

	it("should handle Tuesday correctly", () => {
		const date = new Date("2025-02-04T12:00:00"); // Tuesday
		const { start, end } = getWeekBounds(date);

		expect(start.getDay()).toBe(1);
		expect(start.getDate()).toBe(3); // Previous Monday
		expect(end.getDate()).toBe(10);
	});

	it("should handle Saturday correctly", () => {
		const date = new Date("2025-02-08T12:00:00"); // Saturday
		const { start, end } = getWeekBounds(date);

		expect(start.getDay()).toBe(1);
		expect(start.getDate()).toBe(3); // Previous Monday
		expect(end.getDate()).toBe(10);
	});

	it("should set time to midnight for week start", () => {
		const date = new Date("2025-02-05T15:45:30"); // Wednesday afternoon
		const { start } = getWeekBounds(date);

		expect(start.getHours()).toBe(0);
		expect(start.getMinutes()).toBe(0);
		expect(start.getSeconds()).toBe(0);
		expect(start.getMilliseconds()).toBe(0);
	});

	it("should handle month boundaries correctly", () => {
		const date = new Date("2025-03-01T12:00:00"); // March 1st (Saturday)
		const { start, end } = getWeekBounds(date);

		expect(start.getMonth()).toBe(1); // February (0-indexed)
		expect(start.getDate()).toBe(24); // Previous Monday in February
		expect(end.getMonth()).toBe(2); // March
		expect(end.getDate()).toBe(3); // Next Monday in March
	});

	it("should handle year boundaries correctly", () => {
		const date = new Date("2026-01-01T12:00:00"); // Jan 1st (Thursday)
		const { start, end } = getWeekBounds(date);

		expect(start.getFullYear()).toBe(2025); // Previous year
		expect(start.getMonth()).toBe(11); // December
		expect(start.getDate()).toBe(29); // Previous Monday
		expect(end.getFullYear()).toBe(2026);
		expect(end.getMonth()).toBe(0); // January
		expect(end.getDate()).toBe(5);
	});

	it("should always return exactly 7 days difference", () => {
		const testDates = [
			new Date("2025-02-03"), // Monday
			new Date("2025-02-04"), // Tuesday
			new Date("2025-02-05"), // Wednesday
			new Date("2025-02-06"), // Thursday
			new Date("2025-02-07"), // Friday
			new Date("2025-02-08"), // Saturday
			new Date("2025-02-09"), // Sunday
		];

		for (const date of testDates) {
			const { start, end } = getWeekBounds(date);
			const diffInDays = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
			expect(diffInDays).toBe(7);
		}
	});

	it("should handle leap year dates correctly", () => {
		const date = new Date("2024-02-29T12:00:00"); // Feb 29 (Thursday)
		const { start, end } = getWeekBounds(date);

		expect(start.getDate()).toBe(26); // Previous Monday
		expect(end.getDate()).toBe(4); // March 4
	});
});

describe("getEventsInRange", () => {
	const weekStart = new Date("2025-02-03T00:00:00Z"); // Monday
	const weekEnd = new Date("2025-02-10T00:00:00Z"); // Next Monday

	it("should include events that start within the week", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
	});

	it("should include events that span across the week", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-01T10:00:00Z", // Before week starts
				end: "2025-02-05T11:00:00Z", // Ends in week
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
	});

	it("should exclude events outside the week", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-01T10:00:00Z",
				end: "2025-02-02T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(0);
	});

	it("should handle events without end time", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-05T10:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
	});

	it("should include events starting exactly at week start", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-03T00:00:00Z",
				end: "2025-02-03T01:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
	});

	it("should exclude events starting exactly at week end", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-10T00:00:00Z",
				end: "2025-02-10T01:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(0);
	});

	it("should include events ending just before week end", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-09T23:00:00Z",
				end: "2025-02-09T23:59:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
	});

	it("should include events that span the entire week", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-01T00:00:00Z",
				end: "2025-02-15T00:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
	});

	it("should handle multiple events at different positions in the week", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Monday Event",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "event2.md" },
				title: "Wednesday Event",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "3",
				ref: { filePath: "event3.md" },
				title: "Sunday Event",
				start: "2025-02-09T10:00:00Z",
				end: "2025-02-09T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(3);
	});

	it("should handle all-day events spanning multiple days within the week", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Multi-day Event",
				start: "2025-02-03T00:00:00Z",
				end: "2025-02-05T00:00:00Z",
				allDay: true,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
	});

	it("should filter out events both before and after the week", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "before.md" },
				title: "Before Week",
				start: "2025-01-15T10:00:00Z",
				end: "2025-01-15T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "during.md" },
				title: "During Week",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "3",
				ref: { filePath: "after.md" },
				title: "After Week",
				start: "2025-03-15T10:00:00Z",
				end: "2025-03-15T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("During Week");
	});

	it("should handle empty events array", () => {
		const events: ParsedEvent[] = [];
		const result = getEventsInRange(events, weekStart, weekEnd);
		expect(result).toHaveLength(0);
	});
});

describe("aggregateWeeklyStats", () => {
	it("should aggregate timed events by name", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "gym1.md" },
				title: "Gym 20250203140530",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "gym2.md" },
				title: "Gym 20250205140530",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:30:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Gym");
		expect(stats.entries[0].count).toBe(2);
		expect(stats.entries[0].duration).toBe(150 * 60 * 1000); // 150 minutes total
	});

	it("should skip all-day events", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "All Day Event",
				start: "2025-02-03T00:00:00Z",
				allDay: true,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "event2.md" },
				title: "Timed Event",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Timed Event");
	});

	it("should group recurring events by their actual title", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "recurring1.md" },
				title: "Daily Standup",
				start: "2025-02-03T09:00:00Z",
				end: "2025-02-03T09:15:00Z",
				allDay: false,
				isVirtual: true,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "recurring2.md" },
				title: "Daily Standup",
				start: "2025-02-04T09:00:00Z",
				end: "2025-02-04T09:15:00Z",
				allDay: false,
				isVirtual: true,
				skipped: false,
			},
			{
				id: "3",
				ref: { filePath: "normal.md" },
				title: "Meeting",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(2);

		const standupEntry = stats.entries.find((e) => e.name === "Daily Standup");
		expect(standupEntry).toBeDefined();
		expect(standupEntry?.count).toBe(2);
		expect(standupEntry?.isRecurring).toBe(true);

		const normalEntry = stats.entries.find((e) => e.name === "Meeting");
		expect(normalEntry).toBeDefined();
		expect(normalEntry?.count).toBe(1);
		expect(normalEntry?.isRecurring).toBe(false);
	});

	it("should sort entries by duration descending", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "short.md" },
				title: "Short Meeting",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T10:30:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "long.md" },
				title: "Long Meeting",
				start: "2025-02-04T10:00:00Z",
				end: "2025-02-04T12:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries[0].name).toBe("Long Meeting");
		expect(stats.entries[1].name).toBe("Short Meeting");
	});

	it("should calculate total duration correctly", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Event 1",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "event2.md" },
				title: "Event 2",
				start: "2025-02-04T10:00:00Z",
				end: "2025-02-04T11:30:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.totalDuration).toBe(150 * 60 * 1000); // 150 minutes total
	});

	it("should handle empty event list", () => {
		const events: ParsedEvent[] = [];
		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(0);
		expect(stats.totalDuration).toBe(0);
	});

	it("should handle single event", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Gym",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Gym");
		expect(stats.entries[0].count).toBe(1);
		expect(stats.entries[0].duration).toBe(60 * 60 * 1000);
	});

	it("should group all events by their cleaned title regardless of virtual status", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "normal.md" },
				title: "Daily Standup",
				start: "2025-02-03T09:00:00Z",
				end: "2025-02-03T09:15:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "recurring.md" },
				title: "Daily Standup",
				start: "2025-02-04T09:00:00Z",
				end: "2025-02-04T09:15:00Z",
				allDay: false,
				isVirtual: true,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		// Both should be grouped under "Daily Standup" regardless of virtual status
		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Daily Standup");
		expect(stats.entries[0].count).toBe(2);
		expect(stats.entries[0].duration).toBe(30 * 60 * 1000); // 30 minutes total
	});

	it("should handle events with zero duration", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "Meeting",
				start: "2025-02-03T10:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].duration).toBe(0);
		expect(stats.totalDuration).toBe(0);
	});

	it("should handle mixed recurring and non-recurring with different names", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "gym.md" },
				title: "Gym",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "standup1.md" },
				title: "Standup",
				start: "2025-02-04T09:00:00Z",
				end: "2025-02-04T09:15:00Z",
				allDay: false,
				isVirtual: true,
				skipped: false,
			},
			{
				id: "3",
				ref: { filePath: "standup2.md" },
				title: "Standup",
				start: "2025-02-05T09:00:00Z",
				end: "2025-02-05T09:15:00Z",
				allDay: false,
				isVirtual: true,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(2);

		// Virtual events are now grouped by their actual title
		const standupEntry = stats.entries.find((e) => e.name === "Standup");
		expect(standupEntry?.count).toBe(2);
		expect(standupEntry?.isRecurring).toBe(true); // Marked as recurring since they're virtual

		const gymEntry = stats.entries.find((e) => e.name === "Gym");
		expect(gymEntry?.count).toBe(1);
		expect(gymEntry?.isRecurring).toBe(false);
	});

	it("should handle events spanning across week boundaries", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "before.md" },
				title: "Before Week",
				start: "2025-02-01T10:00:00Z",
				end: "2025-02-04T10:00:00Z", // Ends in week
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "after.md" },
				title: "After Week",
				start: "2025-02-08T10:00:00Z", // Starts in week
				end: "2025-02-12T10:00:00Z", // Ends after week
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(2);
	});

	it("should group events with various ID formats correctly", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "gym1.md" },
				title: "Gym 20250203140530",
				start: "2025-02-03T10:00:00Z",
				end: "2025-02-03T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "gym2.md" },
				title: "Gym-20250205140530",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:30:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "3",
				ref: { filePath: "gym3.md" },
				title: "Gym - 2025-02-07",
				start: "2025-02-07T10:00:00Z",
				end: "2025-02-07T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const date = new Date("2025-02-05");
		const stats = aggregateWeeklyStats(events, date);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Gym");
		expect(stats.entries[0].count).toBe(3);
	});

	it("should correctly set week bounds in result", () => {
		const events: ParsedEvent[] = [];
		const date = new Date("2025-02-05T15:30:00"); // Wednesday afternoon

		const stats = aggregateWeeklyStats(events, date);

		expect(stats.periodStart?.getDay()).toBe(1); // Monday
		expect(stats.periodEnd?.getDay()).toBe(1); // Monday (next week)
		expect(stats.periodStart?.getHours()).toBe(0);
		expect(stats.periodStart?.getMinutes()).toBe(0);
	});
});

describe("formatDuration", () => {
	it("should format zero duration", () => {
		expect(formatDuration(0)).toBe("0m");
	});

	it("should format minutes only", () => {
		expect(formatDuration(45 * 60 * 1000)).toBe("45m");
	});

	it("should format hours and minutes", () => {
		expect(formatDuration(150 * 60 * 1000)).toBe("2h 30m");
	});

	it("should format hours only", () => {
		expect(formatDuration(2 * 60 * 60 * 1000)).toBe("2h");
	});

	it("should format days, hours, and minutes", () => {
		expect(formatDuration((1 * 24 * 60 + 4 * 60 + 30) * 60 * 1000)).toBe("1d 4h 30m");
	});

	it("should format days only", () => {
		expect(formatDuration(2 * 24 * 60 * 60 * 1000)).toBe("2d");
	});
});

describe("formatDurationAsDecimalHours", () => {
	it("should format zero duration", () => {
		expect(formatDurationAsDecimalHours(0)).toBe("0.0h");
	});

	it("should format minutes as decimal hours", () => {
		// 30 minutes = 0.5 hours
		expect(formatDurationAsDecimalHours(30 * 60 * 1000)).toBe("0.5h");
	});

	it("should format hours as decimal", () => {
		// 2 hours
		expect(formatDurationAsDecimalHours(2 * 60 * 60 * 1000)).toBe("2.0h");
	});

	it("should format hours and minutes as decimal", () => {
		// 2 hours 30 minutes = 2.5 hours
		expect(formatDurationAsDecimalHours(150 * 60 * 1000)).toBe("2.5h");
	});

	it("should format days as decimal hours", () => {
		// 1 day = 24 hours
		expect(formatDurationAsDecimalHours(24 * 60 * 60 * 1000)).toBe("24.0h");
	});

	it("should format days, hours, and minutes as decimal hours", () => {
		// 1 day, 12 hours, 30 minutes = 36.5 hours
		const ms = (1 * 24 * 60 + 12 * 60 + 30) * 60 * 1000;
		expect(formatDurationAsDecimalHours(ms)).toBe("36.5h");
	});

	it("should round to one decimal place", () => {
		// 1 hour 20 minutes = 1.333... hours -> 1.3h
		expect(formatDurationAsDecimalHours(80 * 60 * 1000)).toBe("1.3h");
	});

	it("should handle large durations", () => {
		// 10 days = 240 hours
		expect(formatDurationAsDecimalHours(10 * 24 * 60 * 60 * 1000)).toBe("240.0h");
	});
});

describe("formatPercentage", () => {
	it("should format percentage correctly", () => {
		expect(formatPercentage(50, 100)).toBe("50.0%");
		expect(formatPercentage(33, 100)).toBe("33.0%");
		expect(formatPercentage(66.7, 100)).toBe("66.7%");
	});

	it("should handle zero total", () => {
		expect(formatPercentage(50, 0)).toBe("0%");
	});

	it("should round to one decimal place", () => {
		expect(formatPercentage(33.333, 100)).toBe("33.3%");
		expect(formatPercentage(66.666, 100)).toBe("66.7%");
	});
});

describe("getMonthBounds", () => {
	it("should return first day to first day of next month", () => {
		const date = new Date("2025-02-15T12:00:00"); // Middle of February
		const { start, end } = getMonthBounds(date);

		expect(start.getDate()).toBe(1); // 1st of February
		expect(start.getMonth()).toBe(1); // February (0-indexed)
		expect(start.getFullYear()).toBe(2025);
		expect(end.getDate()).toBe(1); // 1st of March
		expect(end.getMonth()).toBe(2); // March (0-indexed)
		expect(start.getHours()).toBe(0);
		expect(start.getMinutes()).toBe(0);
		expect(start.getSeconds()).toBe(0);
	});

	it("should handle first day of month correctly", () => {
		const date = new Date("2025-02-01T12:00:00");
		const { start, end } = getMonthBounds(date);

		expect(start.getDate()).toBe(1);
		expect(start.getMonth()).toBe(1); // February
		expect(end.getDate()).toBe(1);
		expect(end.getMonth()).toBe(2); // March
	});

	it("should handle last day of month correctly", () => {
		const date = new Date("2025-02-28T23:59:59");
		const { start, end } = getMonthBounds(date);

		expect(start.getDate()).toBe(1);
		expect(start.getMonth()).toBe(1); // February
		expect(end.getDate()).toBe(1);
		expect(end.getMonth()).toBe(2); // March
	});

	it("should handle January correctly", () => {
		const date = new Date("2025-01-15T12:00:00");
		const { start, end } = getMonthBounds(date);

		expect(start.getMonth()).toBe(0); // January
		expect(end.getMonth()).toBe(1); // February
		expect(start.getFullYear()).toBe(2025);
		expect(end.getFullYear()).toBe(2025);
	});

	it("should handle December correctly (year rollover)", () => {
		const date = new Date("2025-12-15T12:00:00");
		const { start, end } = getMonthBounds(date);

		expect(start.getMonth()).toBe(11); // December
		expect(start.getFullYear()).toBe(2025);
		expect(end.getMonth()).toBe(0); // January
		expect(end.getFullYear()).toBe(2026);
	});

	it("should handle leap year February correctly", () => {
		const date = new Date("2024-02-15T12:00:00"); // 2024 is a leap year
		const { start, end } = getMonthBounds(date);

		expect(start.getDate()).toBe(1);
		expect(start.getMonth()).toBe(1); // February
		expect(end.getDate()).toBe(1);
		expect(end.getMonth()).toBe(2); // March

		// Verify February 2024 has 29 days
		const febDuration = end.getTime() - start.getTime();
		const daysInFeb = febDuration / (24 * 60 * 60 * 1000);
		expect(daysInFeb).toBe(29);
	});

	it("should handle 31-day months correctly", () => {
		const date = new Date("2025-01-15T12:00:00");
		const { start, end } = getMonthBounds(date);

		const monthDuration = end.getTime() - start.getTime();
		const daysInMonth = monthDuration / (24 * 60 * 60 * 1000);
		expect(daysInMonth).toBe(31); // January has 31 days
	});

	it("should handle 30-day months correctly", () => {
		const date = new Date("2025-04-15T12:00:00");
		const { start, end } = getMonthBounds(date);

		const monthDuration = end.getTime() - start.getTime();
		const daysInMonth = monthDuration / (24 * 60 * 60 * 1000);
		expect(daysInMonth).toBe(30); // April has 30 days
	});
});

describe("aggregateMonthlyStats", () => {
	it("should aggregate events within a month", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "gym1.md" },
				title: "Gym Session 2025-02-05",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "gym2.md" },
				title: "Gym Session 2025-02-12",
				start: "2025-02-12T10:00:00Z",
				end: "2025-02-12T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "3",
				ref: { filePath: "gym3.md" },
				title: "Gym Session 2025-02-19",
				start: "2025-02-19T10:00:00Z",
				end: "2025-02-19T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const monthDate = new Date("2025-02-15T12:00:00");
		const stats = aggregateMonthlyStats(events, monthDate);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Gym Session");
		expect(stats.entries[0].count).toBe(3);
		expect(stats.entries[0].duration).toBe(3 * 60 * 60 * 1000); // 3 hours total
		expect(stats.totalDuration).toBe(3 * 60 * 60 * 1000);
	});

	it("should exclude events outside the month", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event1.md" },
				title: "January Event",
				start: "2025-01-28T10:00:00Z",
				end: "2025-01-28T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "event2.md" },
				title: "February Event",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "3",
				ref: { filePath: "event3.md" },
				title: "March Event",
				start: "2025-03-05T10:00:00Z",
				end: "2025-03-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const monthDate = new Date("2025-02-15T12:00:00");
		const stats = aggregateMonthlyStats(events, monthDate);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("February Event");
	});

	it("should skip all-day events", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "allday.md" },
				title: "All Day Event",
				start: "2025-02-05T00:00:00Z",
				allDay: true,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "timed.md" },
				title: "Timed Event",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const monthDate = new Date("2025-02-15T12:00:00");
		const stats = aggregateMonthlyStats(events, monthDate);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Timed Event");
	});

	it("should group events by cleaned name", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "meeting1.md" },
				title: "Team Meeting 2025-02-05",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "meeting2.md" },
				title: "Team Meeting 2025-02-12",
				start: "2025-02-12T14:00:00Z",
				end: "2025-02-12T15:30:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const monthDate = new Date("2025-02-15T12:00:00");
		const stats = aggregateMonthlyStats(events, monthDate);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Team Meeting");
		expect(stats.entries[0].count).toBe(2);
		expect(stats.entries[0].duration).toBe((60 + 90) * 60 * 1000); // 1h + 1.5h
	});

	it("should handle virtual (recurring) events", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "recurring.md" },
				title: "Daily Standup",
				start: "2025-02-05T09:00:00Z",
				end: "2025-02-05T09:15:00Z",
				allDay: false,
				isVirtual: true,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "recurring.md" },
				title: "Daily Standup",
				start: "2025-02-06T09:00:00Z",
				end: "2025-02-06T09:15:00Z",
				allDay: false,
				isVirtual: true,
				skipped: false,
			},
		];

		const monthDate = new Date("2025-02-15T12:00:00");
		const stats = aggregateMonthlyStats(events, monthDate);

		expect(stats.entries).toHaveLength(1);
		expect(stats.entries[0].name).toBe("Daily Standup");
		expect(stats.entries[0].count).toBe(2);
		expect(stats.entries[0].isRecurring).toBe(true);
	});

	it("should return empty results for empty events array", () => {
		const monthDate = new Date("2025-02-15T12:00:00");
		const stats = aggregateMonthlyStats([], monthDate);

		expect(stats.entries).toHaveLength(0);
		expect(stats.totalDuration).toBe(0);
	});

	it("should sort entries by duration descending", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "short.md" },
				title: "Short Meeting",
				start: "2025-02-05T10:00:00Z",
				end: "2025-02-05T10:30:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "long.md" },
				title: "Long Workshop",
				start: "2025-02-05T14:00:00Z",
				end: "2025-02-05T17:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const monthDate = new Date("2025-02-15T12:00:00");
		const stats = aggregateMonthlyStats(events, monthDate);

		expect(stats.entries).toHaveLength(2);
		expect(stats.entries[0].name).toBe("Long Workshop");
		expect(stats.entries[0].duration).toBe(3 * 60 * 60 * 1000);
		expect(stats.entries[1].name).toBe("Short Meeting");
		expect(stats.entries[1].duration).toBe(30 * 60 * 1000);
	});

	it("should correctly set month bounds in result", () => {
		const events: ParsedEvent[] = [];
		const date = new Date("2025-02-15T15:30:00");

		const stats = aggregateMonthlyStats(events, date);

		expect(stats.periodStart?.getDate()).toBe(1);
		expect(stats.periodStart?.getMonth()).toBe(1); // February
		expect(stats.periodEnd?.getDate()).toBe(1);
		expect(stats.periodEnd?.getMonth()).toBe(2); // March
		expect(stats.periodStart?.getHours()).toBe(0);
		expect(stats.periodStart?.getMinutes()).toBe(0);
	});

	it("should handle month with 31 days", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event.md" },
				title: "Event",
				start: "2025-01-01T10:00:00Z",
				end: "2025-01-01T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
			{
				id: "2",
				ref: { filePath: "event2.md" },
				title: "Event",
				start: "2025-01-31T10:00:00Z",
				end: "2025-01-31T11:00:00Z",
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const monthDate = new Date("2025-01-15T12:00:00");
		const stats = aggregateMonthlyStats(events, monthDate);

		expect(stats.entries[0].count).toBe(2);
	});

	it("should handle events spanning across month boundary", () => {
		const events: ParsedEvent[] = [
			{
				id: "1",
				ref: { filePath: "event.md" },
				title: "Event",
				start: "2025-01-31T23:00:00Z", // Last day of January
				end: "2025-02-01T01:00:00Z", // First day of February
				allDay: false,
				isVirtual: false,
				skipped: false,
			},
		];

		const febMonth = new Date("2025-02-15T12:00:00");
		const febStats = aggregateMonthlyStats(events, febMonth);

		// Event should be included in February because it overlaps
		expect(febStats.entries).toHaveLength(1);
	});
});

describe("Category-based aggregation", () => {
	describe("aggregateWeeklyStats with category mode", () => {
		it("should aggregate events by category property", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Team Meeting",
					start: "2025-02-03T10:00:00Z",
					end: "2025-02-03T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Client Call",
					start: "2025-02-04T14:00:00Z",
					end: "2025-02-04T15:30:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "3",
					ref: { filePath: "event3.md" },
					title: "Gym Session",
					start: "2025-02-05T18:00:00Z",
					end: "2025-02-05T19:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Personal",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "category", "Category");

			expect(stats.entries).toHaveLength(2);

			const workEntry = stats.entries.find((e) => e.name === "Work");
			expect(workEntry).toBeDefined();
			expect(workEntry?.count).toBe(2);
			expect(workEntry?.duration).toBe(150 * 60 * 1000); // 150 minutes total

			const personalEntry = stats.entries.find((e) => e.name === "Personal");
			expect(personalEntry).toBeDefined();
			expect(personalEntry?.count).toBe(1);
			expect(personalEntry?.duration).toBe(60 * 60 * 1000); // 60 minutes
		});

		it("should use 'No Category' for events without category property", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Team Meeting",
					start: "2025-02-03T10:00:00Z",
					end: "2025-02-03T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Random Event",
					start: "2025-02-04T14:00:00Z",
					end: "2025-02-04T15:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					// No meta at all
				},
				{
					id: "3",
					ref: { filePath: "event3.md" },
					title: "Another Event",
					start: "2025-02-05T10:00:00Z",
					end: "2025-02-05T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						// Has meta but no Category property
						Status: "Active",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "category", "Category");

			expect(stats.entries).toHaveLength(2);

			const noCategoryEntry = stats.entries.find((e) => e.name === "No Category");
			expect(noCategoryEntry).toBeDefined();
			expect(noCategoryEntry?.count).toBe(2);

			const workEntry = stats.entries.find((e) => e.name === "Work");
			expect(workEntry).toBeDefined();
			expect(workEntry?.count).toBe(1);
		});

		it("should handle custom category property name", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Event 1",
					start: "2025-02-03T10:00:00Z",
					end: "2025-02-03T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Type: "Meeting",
					},
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Event 2",
					start: "2025-02-04T10:00:00Z",
					end: "2025-02-04T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Type: "Task",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "category", "Type");

			expect(stats.entries).toHaveLength(2);
			expect(stats.entries.some((e) => e.name === "Meeting")).toBe(true);
			expect(stats.entries.some((e) => e.name === "Task")).toBe(true);
		});

		it("should still skip all-day events in category mode", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "All Day Event",
					start: "2025-02-03T00:00:00Z",
					allDay: true,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Timed Event",
					start: "2025-02-03T10:00:00Z",
					end: "2025-02-03T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "category", "Category");

			expect(stats.entries).toHaveLength(1);
			expect(stats.entries[0].name).toBe("Work");
			expect(stats.entries[0].count).toBe(1);
		});

		it("should preserve isRecurring flag for virtual events in category mode", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "recurring.md" },
					title: "Standup",
					start: "2025-02-03T09:00:00Z",
					end: "2025-02-03T09:15:00Z",
					allDay: false,
					isVirtual: true,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "2",
					ref: { filePath: "recurring.md" },
					title: "Standup",
					start: "2025-02-04T09:00:00Z",
					end: "2025-02-04T09:15:00Z",
					allDay: false,
					isVirtual: true,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "category", "Category");

			expect(stats.entries).toHaveLength(1);
			expect(stats.entries[0].name).toBe("Work");
			expect(stats.entries[0].isRecurring).toBe(true);
		});

		it("should handle empty category values as 'No Category'", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Event 1",
					start: "2025-02-03T10:00:00Z",
					end: "2025-02-03T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "category", "Category");

			expect(stats.entries).toHaveLength(1);
			expect(stats.entries[0].name).toBe("No Category");
		});

		it("should sort categories by duration descending", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Short Work",
					start: "2025-02-03T10:00:00Z",
					end: "2025-02-03T10:30:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Long Personal",
					start: "2025-02-04T10:00:00Z",
					end: "2025-02-04T13:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Personal",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "category", "Category");

			expect(stats.entries[0].name).toBe("Personal");
			expect(stats.entries[1].name).toBe("Work");
		});

		it("should default to name mode when mode parameter is 'name'", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Meeting 20250203",
					start: "2025-02-03T10:00:00Z",
					end: "2025-02-03T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Meeting 20250204",
					start: "2025-02-04T10:00:00Z",
					end: "2025-02-04T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
			];

			const date = new Date("2025-02-05");
			const stats = aggregateWeeklyStats(events, date, "name", "Category");

			// Should group by cleaned name, not category
			expect(stats.entries).toHaveLength(1);
			expect(stats.entries[0].name).toBe("Meeting");
			expect(stats.entries[0].count).toBe(2);
		});
	});

	describe("aggregateMonthlyStats with category mode", () => {
		it("should aggregate monthly events by category", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Meeting 1",
					start: "2025-02-05T10:00:00Z",
					end: "2025-02-05T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Meeting 2",
					start: "2025-02-12T10:00:00Z",
					end: "2025-02-12T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
				{
					id: "3",
					ref: { filePath: "event3.md" },
					title: "Gym",
					start: "2025-02-15T18:00:00Z",
					end: "2025-02-15T19:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Health",
					},
				},
			];

			const monthDate = new Date("2025-02-15T12:00:00");
			const stats = aggregateMonthlyStats(events, monthDate, "category", "Category");

			expect(stats.entries).toHaveLength(2);

			const workEntry = stats.entries.find((e) => e.name === "Work");
			expect(workEntry).toBeDefined();
			expect(workEntry?.count).toBe(2);

			const healthEntry = stats.entries.find((e) => e.name === "Health");
			expect(healthEntry).toBeDefined();
			expect(healthEntry?.count).toBe(1);
		});

		it("should handle 'No Category' for monthly stats", () => {
			const events: ParsedEvent[] = [
				{
					id: "1",
					ref: { filePath: "event1.md" },
					title: "Event 1",
					start: "2025-02-05T10:00:00Z",
					end: "2025-02-05T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
				},
				{
					id: "2",
					ref: { filePath: "event2.md" },
					title: "Event 2",
					start: "2025-02-12T10:00:00Z",
					end: "2025-02-12T11:00:00Z",
					allDay: false,
					isVirtual: false,
					skipped: false,
					meta: {
						Category: "Work",
					},
				},
			];

			const monthDate = new Date("2025-02-15T12:00:00");
			const stats = aggregateMonthlyStats(events, monthDate, "category", "Category");

			expect(stats.entries).toHaveLength(2);
			expect(stats.entries.some((e) => e.name === "No Category")).toBe(true);
			expect(stats.entries.some((e) => e.name === "Work")).toBe(true);
		});
	});
});
