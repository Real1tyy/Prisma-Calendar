import { describe, expect, it } from "vitest";
import type { ParsedEvent } from "../../src/core/parser";
import {
	aggregateWeeklyStats,
	formatDuration,
	formatPercentage,
	getEventDuration,
	getEventsInWeek,
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

describe("getEventsInWeek", () => {
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
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

		const result = getEventsInWeek(events, weekStart, weekEnd);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe("During Week");
	});

	it("should handle empty events array", () => {
		const events: ParsedEvent[] = [];
		const result = getEventsInWeek(events, weekStart, weekEnd);
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

	it("should group recurring events together", () => {
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

		const recurringEntry = stats.entries.find((e) => e.name === "Recurring Events");
		expect(recurringEntry).toBeDefined();
		expect(recurringEntry?.count).toBe(2);
		expect(recurringEntry?.isRecurring).toBe(true);

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

	it("should not group recurring and non-recurring events with same name", () => {
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

		expect(stats.entries).toHaveLength(2);
		const recurringEntry = stats.entries.find((e) => e.isRecurring);
		const normalEntry = stats.entries.find((e) => !e.isRecurring);

		expect(recurringEntry).toBeDefined();
		expect(recurringEntry?.name).toBe("Recurring Events");
		expect(normalEntry).toBeDefined();
		expect(normalEntry?.name).toBe("Daily Standup");
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

		const recurringEntry = stats.entries.find((e) => e.isRecurring);
		expect(recurringEntry?.name).toBe("Recurring Events");
		expect(recurringEntry?.count).toBe(2);

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

		expect(stats.weekStart.getDay()).toBe(1); // Monday
		expect(stats.weekEnd.getDay()).toBe(1); // Monday (next week)
		expect(stats.weekStart.getHours()).toBe(0);
		expect(stats.weekStart.getMinutes()).toBe(0);
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
