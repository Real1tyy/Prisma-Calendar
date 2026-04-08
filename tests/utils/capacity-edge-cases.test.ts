import { describe, expect, it } from "vitest";

import { calculateCapacity, formatBoundaryHour, formatBoundaryRange, inferBoundaries } from "../../src/utils/capacity";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

describe("inferBoundaries edge cases", () => {
	it("should return fallback values when no timed events exist", () => {
		const { startHour, endHour } = inferBoundaries([], 8, 18);
		expect(startHour).toBe(8);
		expect(endHour).toBe(18);
	});

	it("should return fallback values when only all-day events exist", () => {
		const allDayEvent = createMockAllDayEvent({
			start: "2025-01-15T00:00:00",
		});
		const { startHour, endHour } = inferBoundaries([allDayEvent], 9, 17);
		expect(startHour).toBe(9);
		expect(endHour).toBe(17);
	});

	it("should use fractional hours for events not on hour boundaries", () => {
		const event = createMockTimedEvent({
			start: "2025-01-15T09:30:00",
			end: "2025-01-15T16:45:00",
		});
		const { startHour, endHour } = inferBoundaries([event], 8, 18);
		expect(startHour).toBe(9.5);
		expect(endHour).toBe(16.75);
	});

	it("should find the min start and max end across multiple events", () => {
		const events = [
			createMockTimedEvent({ id: "1", start: "2025-01-15T10:00:00", end: "2025-01-15T11:00:00" }),
			createMockTimedEvent({ id: "2", start: "2025-01-15T08:00:00", end: "2025-01-15T09:00:00" }),
			createMockTimedEvent({ id: "3", start: "2025-01-15T14:00:00", end: "2025-01-15T18:30:00" }),
		];
		const { startHour, endHour } = inferBoundaries(events, 9, 17);
		expect(startHour).toBe(8);
		expect(endHour).toBe(18.5);
	});

	it("should handle midnight-spanning events", () => {
		const event = createMockTimedEvent({
			start: "2025-01-15T23:00:00",
			end: "2025-01-16T01:00:00",
		});
		const { startHour, endHour } = inferBoundaries([event], 8, 18);
		expect(startHour).toBe(23);
		expect(endHour).toBe(1);
	});
});

describe("calculateCapacity edge cases", () => {
	it("should handle zero-length period (single day minimum)", () => {
		const periodStart = new Date("2025-01-15T00:00:00");
		const periodEnd = new Date("2025-01-15T00:00:00");

		const result = calculateCapacity([], periodStart, periodEnd, 8, 18);

		// Math.max(1, ...) ensures at least 1 day
		expect(result.capacityMs).toBe(10 * 3_600_000); // 10 hours * ms/hour
	});

	it("should handle boundary where start equals end (zero hours per day)", () => {
		const periodStart = new Date("2025-01-15T00:00:00");
		const periodEnd = new Date("2025-01-16T00:00:00");

		const result = calculateCapacity([], periodStart, periodEnd, 12, 12);

		expect(result.capacityMs).toBe(0);
		expect(result.percentUsed).toBe(0);
	});

	it("should handle boundary where start > end (negative hours clamped to 0)", () => {
		const periodStart = new Date("2025-01-15T00:00:00");
		const periodEnd = new Date("2025-01-16T00:00:00");

		const result = calculateCapacity([], periodStart, periodEnd, 18, 8);

		expect(result.capacityMs).toBe(0);
	});

	it("should cap percentUsed at 100%", () => {
		const periodStart = new Date("2025-01-15T00:00:00");
		const periodEnd = new Date("2025-01-16T00:00:00");

		// 1 hour capacity, 2 hours used
		const event = createMockTimedEvent({
			start: "2025-01-15T09:00:00",
			end: "2025-01-15T11:00:00",
		});

		const result = calculateCapacity([event], periodStart, periodEnd, 9, 10);

		expect(result.percentUsed).toBe(100);
		expect(result.remainingMs).toBe(0);
	});

	it("should correctly count days for multi-day period", () => {
		const periodStart = new Date("2025-01-13T00:00:00"); // Monday
		const periodEnd = new Date("2025-01-20T00:00:00"); // Next Monday = 7 days

		const result = calculateCapacity([], periodStart, periodEnd, 9, 17);

		// 7 days × 8 hours/day = 56 hours
		expect(result.capacityMs).toBe(7 * 8 * 3_600_000);
	});
});

describe("formatBoundaryHour", () => {
	it("should format whole hours", () => {
		expect(formatBoundaryHour(9)).toBe("9:00");
		expect(formatBoundaryHour(17)).toBe("17:00");
	});

	it("should format fractional hours", () => {
		expect(formatBoundaryHour(9.5)).toBe("9:30");
		expect(formatBoundaryHour(14.75)).toBe("14:45");
	});

	it("should handle midnight", () => {
		expect(formatBoundaryHour(0)).toBe("0:00");
	});

	it("should pad minutes", () => {
		expect(formatBoundaryHour(9.083)).toBe("9:05"); // 0.083 * 60 ≈ 5
	});
});

describe("formatBoundaryRange", () => {
	it("should format a standard range", () => {
		const result = formatBoundaryRange({
			capacityMs: 0,
			usedMs: 0,
			remainingMs: 0,
			percentUsed: 0,
			boundaryStart: 9,
			boundaryEnd: 17,
		});
		expect(result).toBe("9:00–17:00");
	});
});
