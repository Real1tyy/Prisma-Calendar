import { describe, expect, it } from "vitest";

import { type AIEventSummary, analyzePreviousPatterns } from "../../src/core/ai/ai-context-builder";

function makeEvent(title: string, start: string, end: string, allDay = false, categories?: string[]): AIEventSummary {
	return { title, start, end, allDay, categories };
}

describe("analyzePreviousPatterns", () => {
	it("should return defaults for empty events", () => {
		const result = analyzePreviousPatterns([]);
		expect(result.earliestStart).toBe("09:00");
		expect(result.latestEnd).toBe("17:00");
		expect(result.avgEventsPerDay).toBe(0);
		expect(result.typicalBlockMins).toBe(0);
		expect(result.recurringBlocks).toEqual([]);
		expect(result.dailyTemplate).toBe("No previous events to analyze.");
		expect(result.activeDays).toEqual([]);
	});

	it("should return defaults for only all-day events", () => {
		const events: AIEventSummary[] = [
			makeEvent("Holiday", "2025-03-15T00:00:00", undefined as unknown as string, true),
		];
		const result = analyzePreviousPatterns(events);
		expect(result.avgEventsPerDay).toBe(0);
		expect(result.recurringBlocks).toEqual([]);
	});

	it("should detect earliest start and latest end from a single day", () => {
		const events: AIEventSummary[] = [
			makeEvent("Morning Routine", "2025-03-15T07:00:00", "2025-03-15T08:00:00"),
			makeEvent("Work", "2025-03-15T09:00:00", "2025-03-15T17:00:00"),
			makeEvent("Gym", "2025-03-15T18:00:00", "2025-03-15T19:30:00"),
		];
		const result = analyzePreviousPatterns(events);
		expect(result.earliestStart).toBe("07:00");
		expect(result.latestEnd).toBe("19:30");
	});

	it("should calculate average events per day across multiple days", () => {
		const events: AIEventSummary[] = [
			makeEvent("Event A", "2025-03-15T09:00:00", "2025-03-15T10:00:00"),
			makeEvent("Event B", "2025-03-15T10:00:00", "2025-03-15T11:00:00"),
			makeEvent("Event C", "2025-03-16T09:00:00", "2025-03-16T10:00:00"),
		];
		const result = analyzePreviousPatterns(events);
		expect(result.avgEventsPerDay).toBe(1.5);
	});

	it("should detect recurring blocks appearing 3+ times at similar times", () => {
		const events: AIEventSummary[] = [
			makeEvent("Team Meeting", "2025-03-15T10:00:00", "2025-03-15T11:00:00"),
			makeEvent("Team Meeting", "2025-03-16T10:00:00", "2025-03-16T11:00:00"),
			makeEvent("Team Meeting", "2025-03-17T10:15:00", "2025-03-17T11:15:00"),
			makeEvent("Workout", "2025-03-15T18:00:00", "2025-03-15T19:00:00"),
		];
		const result = analyzePreviousPatterns(events);
		expect(result.recurringBlocks.length).toBe(1);
		expect(result.recurringBlocks[0].title).toBe("Team Meeting");
		expect(result.recurringBlocks[0].frequency).toBe(3);
		expect(result.recurringBlocks[0].typicalDurationMins).toBe(60);
	});

	it("should not flag blocks appearing fewer than 3 times as recurring", () => {
		const events: AIEventSummary[] = [
			makeEvent("Workout", "2025-03-15T18:00:00", "2025-03-15T19:00:00"),
			makeEvent("Workout", "2025-03-16T18:00:00", "2025-03-16T19:00:00"),
		];
		const result = analyzePreviousPatterns(events);
		expect(result.recurringBlocks).toEqual([]);
	});

	it("should generate a daily template from the busiest day", () => {
		const events: AIEventSummary[] = [
			makeEvent("Event A", "2025-03-15T09:00:00", "2025-03-15T10:00:00"),
			makeEvent("Event B", "2025-03-15T10:00:00", "2025-03-15T11:00:00"),
			makeEvent("Event C", "2025-03-15T14:00:00", "2025-03-15T15:00:00"),
			makeEvent("Only Event", "2025-03-16T09:00:00", "2025-03-16T10:00:00"),
		];
		const result = analyzePreviousPatterns(events);
		expect(result.dailyTemplate).toContain("09:00-10:00 Event A");
		expect(result.dailyTemplate).toContain("10:00-11:00 Event B");
		expect(result.dailyTemplate).toContain("14:00-15:00 Event C");
	});

	it("should compute typical block size as median duration", () => {
		const events: AIEventSummary[] = [
			makeEvent("Short", "2025-03-15T09:00:00", "2025-03-15T09:30:00"), // 30min
			makeEvent("Medium", "2025-03-15T10:00:00", "2025-03-15T11:00:00"), // 60min
			makeEvent("Long", "2025-03-15T12:00:00", "2025-03-15T14:00:00"), // 120min
		];
		const result = analyzePreviousPatterns(events);
		// Median of [30, 60, 120] = 60
		expect(result.typicalBlockMins).toBe(60);
	});

	it("should detect active days of the week", () => {
		// 2025-03-15 = Saturday, 2025-03-17 = Monday
		const events: AIEventSummary[] = [
			makeEvent("Event A", "2025-03-15T09:00:00", "2025-03-15T10:00:00"),
			makeEvent("Event B", "2025-03-17T09:00:00", "2025-03-17T10:00:00"),
		];
		const result = analyzePreviousPatterns(events);
		expect(result.activeDays).toContain("Sat");
		expect(result.activeDays).toContain("Mon");
		expect(result.activeDays.length).toBe(2);
	});
});
