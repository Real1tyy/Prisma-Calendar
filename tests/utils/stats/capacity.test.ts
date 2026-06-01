import { describe, expect, it } from "vitest";

import { aggregateStats, getDayBounds, getEventsInRange } from "../../../src/utils/stats";
import {
	calculateCapacity,
	calculateCapacityFromEvents,
	formatCapacityLabel,
	inferBoundaries,
} from "../../../src/utils/stats/capacity";
import { createMockAllDayEvent, createMockTimedEvent } from "../../fixtures/event-fixtures";

const MS_PER_HOUR = 3_600_000;

describe("inferBoundaries", () => {
	const day = getDayBounds(new Date("2026-03-18"));

	it("should infer exact boundaries from the earliest start and latest end", () => {
		const events = [
			createMockTimedEvent({ start: "2026-03-18T09:30:00", end: "2026-03-18T11:00:00" }),
			createMockTimedEvent({ start: "2026-03-18T14:00:00", end: "2026-03-18T20:45:00" }),
		];

		const result = inferBoundaries(events, day.start, day.end, 7, 23);
		expect(result.startHour).toBe(9.5);
		expect(result.endHour).toBe(20.75);
	});

	it("should use fallback when no timed events exist", () => {
		const events = [createMockAllDayEvent({ start: "2026-03-18T00:00:00" })];
		const result = inferBoundaries(events, day.start, day.end, 7, 23);
		expect(result.startHour).toBe(7);
		expect(result.endHour).toBe(23);
	});

	it("should use fallback for empty event array", () => {
		const result = inferBoundaries([], day.start, day.end, 8, 20);
		expect(result.startHour).toBe(8);
		expect(result.endHour).toBe(20);
	});

	it("should use exact fractional hours without rounding", () => {
		const events = [createMockTimedEvent({ start: "2026-03-18T10:59:00", end: "2026-03-18T15:01:00" })];

		const result = inferBoundaries(events, day.start, day.end, 7, 23);
		expect(result.startHour).toBeCloseTo(10 + 59 / 60, 5);
		expect(result.endHour).toBeCloseTo(15 + 1 / 60, 5);
	});
});

describe("calculateCapacity", () => {
	it("should calculate capacity for a single day", () => {
		const events = [createMockTimedEvent({ start: "2026-03-18T09:00:00", end: "2026-03-18T17:00:00" })];
		const start = new Date("2026-03-18T00:00:00");
		const end = new Date("2026-03-19T00:00:00");

		const result = calculateCapacity(events, start, end, 9, 22);
		expect(result.capacityMs).toBe(13 * MS_PER_HOUR);
		expect(result.usedMs).toBe(8 * MS_PER_HOUR);
		expect(result.remainingMs).toBe(5 * MS_PER_HOUR);
		expect(result.percentUsed).toBeCloseTo(61.5, 0);
	});

	it("should calculate capacity for a full week", () => {
		const start = new Date("2026-03-16T00:00:00");
		const end = new Date("2026-03-23T00:00:00");

		const result = calculateCapacity([], start, end, 9, 22);
		expect(result.capacityMs).toBe(7 * 13 * MS_PER_HOUR);
		expect(result.usedMs).toBe(0);
		expect(result.remainingMs).toBe(7 * 13 * MS_PER_HOUR);
		expect(result.percentUsed).toBe(0);
	});

	it("should clamp remaining to 0 when over capacity", () => {
		const events = [createMockTimedEvent({ start: "2026-03-18T08:00:00", end: "2026-03-18T23:00:00" })];
		const start = new Date("2026-03-18T00:00:00");
		const end = new Date("2026-03-19T00:00:00");

		const result = calculateCapacity(events, start, end, 9, 17);
		expect(result.capacityMs).toBe(8 * MS_PER_HOUR);
		expect(result.usedMs).toBe(15 * MS_PER_HOUR);
		expect(result.remainingMs).toBe(0);
		expect(result.percentUsed).toBe(100);
	});

	it("should handle zero capacity when start equals end", () => {
		const result = calculateCapacity([], new Date("2026-03-18"), new Date("2026-03-19"), 12, 12);
		expect(result.capacityMs).toBe(0);
		expect(result.percentUsed).toBe(0);
	});

	it("should skip all-day events in used calculation", () => {
		const events = [
			createMockAllDayEvent({ start: "2026-03-18" }),
			createMockTimedEvent({ start: "2026-03-18T10:00:00", end: "2026-03-18T12:00:00" }),
		];
		const start = new Date("2026-03-18T00:00:00");
		const end = new Date("2026-03-19T00:00:00");

		const result = calculateCapacity(events, start, end, 8, 20);
		expect(result.usedMs).toBe(2 * MS_PER_HOUR);
	});

	it("should subtract break minutes from event duration", () => {
		const events = [
			createMockTimedEvent({
				start: "2026-03-18T09:00:00",
				end: "2026-03-18T11:00:00",
				metadata: { breakMinutes: 30 },
			}),
		];
		const start = new Date("2026-03-18T00:00:00");
		const end = new Date("2026-03-19T00:00:00");

		const result = calculateCapacity(events, start, end, 9, 22);
		expect(result.usedMs).toBe(1.5 * MS_PER_HOUR);
	});
});

describe("calculateCapacityFromEvents", () => {
	it("should infer boundaries and calculate capacity in one call", () => {
		const events = [
			createMockTimedEvent({ start: "2026-03-18T09:00:00", end: "2026-03-18T12:00:00" }),
			createMockTimedEvent({ start: "2026-03-18T14:00:00", end: "2026-03-18T18:00:00" }),
		];
		const start = new Date("2026-03-18T00:00:00");
		const end = new Date("2026-03-19T00:00:00");

		const result = calculateCapacityFromEvents(events, start, end, 7, 23);
		expect(result.boundaryStart).toBe(9);
		expect(result.boundaryEnd).toBe(18);
		expect(result.capacityMs).toBe(9 * MS_PER_HOUR);
		expect(result.usedMs).toBe(7 * MS_PER_HOUR);
	});
});

describe("calculateCapacityFromEvents — midnight-crossing window", () => {
	// Daytime events, then a session that starts in the evening and runs past midnight.
	// The crossing event's in-day slice (21:00→24:00 = 3h) lands in `used`, so the
	// inferred active window must extend to midnight too — otherwise used > capacity and
	// the label reads a false 100% / 0 remaining.
	const dayChain = [
		createMockTimedEvent({ id: "1", title: "Team Meeting", start: "2026-03-18T09:00:00", end: "2026-03-18T12:00:00" }),
		createMockTimedEvent({
			id: "2",
			title: "Project Planning",
			start: "2026-03-18T13:00:00",
			end: "2026-03-18T17:00:00",
		}),
	];
	const crossing = createMockTimedEvent({
		id: "3",
		title: "Workout",
		start: "2026-03-18T21:00:00",
		end: "2026-03-19T01:00:00",
	});
	const { start, end } = getDayBounds(new Date("2026-03-18"));

	it("extends the inferred window to midnight so used never exceeds capacity", () => {
		const result = calculateCapacityFromEvents([...dayChain, crossing], start, end, 9, 17);

		expect(result.boundaryStart).toBe(9);
		expect(result.boundaryEnd).toBe(24);
		// 3h + 4h daytime + 3h in-day slice of the crossing event = 10h used.
		expect(result.usedMs).toBe(10 * MS_PER_HOUR);
		expect(result.capacityMs).toBe(15 * MS_PER_HOUR);
		expect(result.usedMs).toBeLessThan(result.capacityMs);
		expect(result.remainingMs).toBe(5 * MS_PER_HOUR);
		expect(result.percentUsed).toBeCloseTo((10 / 15) * 100, 5);
	});
});

describe("calculateCapacity — parity with stats", () => {
	const periodStart = new Date("2026-05-11T00:00:00");
	const periodEnd = new Date("2026-05-12T00:00:00");

	it("matches aggregateStats.totalDuration when caller pre-filters via getEventsInRange", () => {
		const events = [
			createMockTimedEvent({
				id: "1",
				title: "Project Planning",
				start: "2026-05-11T08:00:00",
				end: "2026-05-11T09:00:00",
			}),
			createMockTimedEvent({
				id: "2",
				title: "Project Planning",
				start: "2026-05-11T13:00:00",
				end: "2026-05-11T13:30:00",
			}),
			createMockTimedEvent({
				id: "edge",
				start: "2026-05-10T23:30:00",
				end: "2026-05-11T00:00:00",
			}),
		];

		const inRange = getEventsInRange(events, periodStart, periodEnd);
		const stats = aggregateStats(inRange, periodStart, periodEnd, "name");
		const capacity = calculateCapacity(inRange, periodStart, periodEnd, 7, 18);
		expect(capacity.usedMs).toBe(stats.totalDuration);
		expect(capacity.usedMs).toBe(1.5 * MS_PER_HOUR);
	});
});

describe("aggregateStats / calculateCapacity parity — empty categories", () => {
	it("keeps events with metadata.categories=[] visible in stats and matches capacity", () => {
		const periodStart = new Date("2026-05-11T00:00:00");
		const periodEnd = new Date("2026-05-12T00:00:00");

		const visible = createMockTimedEvent({
			id: "visible",
			title: "Work",
			start: "2026-05-11T07:00:00",
			end: "2026-05-11T07:30:00",
			metadata: { categories: ["Work"] },
		});
		const phantom = createMockTimedEvent({
			id: "phantom",
			title: "Work",
			start: "2026-05-11T07:30:00",
			end: "2026-05-11T08:00:00",
			metadata: { categories: [] },
		});

		const stats = aggregateStats([visible, phantom], periodStart, periodEnd, "category");
		const capacity = calculateCapacity([visible, phantom], periodStart, periodEnd, 7, 8);

		expect(stats.totalDuration).toBe(MS_PER_HOUR);
		expect(capacity.usedMs).toBe(MS_PER_HOUR);
		expect(stats.totalDuration).toBe(capacity.usedMs);

		const totalCount = stats.entries.reduce((sum, e) => sum + e.count, 0);
		expect(totalCount).toBe(2);
	});
});

describe("formatCapacityLabel", () => {
	it("should format with human-readable durations", () => {
		const result = {
			capacityMs: 13 * MS_PER_HOUR,
			usedMs: 8.5 * MS_PER_HOUR,
			remainingMs: 4.5 * MS_PER_HOUR,
			percentUsed: 65.4,
			boundaryStart: 9,
			boundaryEnd: 22,
		};

		expect(formatCapacityLabel(result, false)).toBe("8h 30m / 13h");
	});

	it("should format with decimal hours", () => {
		const result = {
			capacityMs: 13 * MS_PER_HOUR,
			usedMs: 8.5 * MS_PER_HOUR,
			remainingMs: 4.5 * MS_PER_HOUR,
			percentUsed: 65.4,
			boundaryStart: 9,
			boundaryEnd: 22,
		};

		expect(formatCapacityLabel(result, true)).toBe("8.5h / 13.0h");
	});
});
