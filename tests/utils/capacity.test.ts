import { describe, expect, it } from "vitest";

import {
	calculateCapacity,
	calculateCapacityFromEvents,
	formatCapacityLabel,
	inferBoundaries,
} from "../../src/utils/capacity";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

const MS_PER_HOUR = 3_600_000;

describe("inferBoundaries", () => {
	it("should infer exact boundaries from the earliest start and latest end", () => {
		const events = [
			createMockTimedEvent({ start: "2026-03-18T09:30:00", end: "2026-03-18T11:00:00" }),
			createMockTimedEvent({ start: "2026-03-18T14:00:00", end: "2026-03-18T20:45:00" }),
		];

		const result = inferBoundaries(events, 7, 23);
		expect(result.startHour).toBe(9.5);
		expect(result.endHour).toBe(20.75);
	});

	it("should use fallback when no timed events exist", () => {
		const events = [createMockAllDayEvent()];
		const result = inferBoundaries(events, 7, 23);
		expect(result.startHour).toBe(7);
		expect(result.endHour).toBe(23);
	});

	it("should use fallback for empty event array", () => {
		const result = inferBoundaries([], 8, 20);
		expect(result.startHour).toBe(8);
		expect(result.endHour).toBe(20);
	});

	it("should use exact fractional hours without rounding", () => {
		const events = [createMockTimedEvent({ start: "2026-03-18T10:59:00", end: "2026-03-18T15:01:00" })];

		const result = inferBoundaries(events, 7, 23);
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
