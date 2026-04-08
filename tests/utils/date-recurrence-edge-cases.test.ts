import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import {
	getNextNWeeklyOccurrence,
	getNextOccurrence,
	isDateOnWeekdays,
	iterateOccurrencesInRange,
	type RecurrenceType,
	type Weekday,
} from "../../src/utils/date-recurrence";

function date(isoDate: string): DateTime {
	return DateTime.fromISO(isoDate);
}

function collectOccurrences(
	startDate: DateTime,
	rrules: { type: RecurrenceType; weekdays?: Weekday[] },
	rangeStart: DateTime,
	rangeEnd: DateTime
): string[] {
	return Array.from(iterateOccurrencesInRange(startDate, rrules, rangeStart, rangeEnd)).map(
		(dt) => dt.toISODate() ?? ""
	);
}

describe("iterateOccurrencesInRange — yearly alignment", () => {
	it("should not yield rangeStart when yearly event anniversary is before range", () => {
		const start = date("2024-01-15");
		const rangeStart = date("2025-03-01");
		const rangeEnd = date("2025-12-31");

		const results = collectOccurrences(start, { type: "yearly" }, rangeStart, rangeEnd);

		expect(results).toEqual([]);
	});

	it("should yield anniversary date when it falls within range", () => {
		const start = date("2024-06-15");
		const rangeStart = date("2025-01-01");
		const rangeEnd = date("2025-12-31");

		const results = collectOccurrences(start, { type: "yearly" }, rangeStart, rangeEnd);

		expect(results).toContain("2025-06-15");
	});

	it("should yield multiple yearly occurrences over multi-year range", () => {
		const start = date("2023-03-10");
		const rangeStart = date("2024-01-01");
		const rangeEnd = date("2026-12-31");

		const results = collectOccurrences(start, { type: "yearly" }, rangeStart, rangeEnd);

		expect(results).toContain("2024-03-10");
		expect(results).toContain("2025-03-10");
		expect(results).toContain("2026-03-10");
		expect(results).toHaveLength(3);
	});

	it("should work correctly when event start equals range start", () => {
		const start = date("2024-04-01");
		const rangeStart = date("2024-04-01");
		const rangeEnd = date("2024-04-30");

		const results = collectOccurrences(start, { type: "yearly" }, rangeStart, rangeEnd);

		expect(results).toEqual(["2024-04-01"]);
	});

	it("should work when range starts exactly on an anniversary", () => {
		const start = date("2024-04-01");
		const rangeStart = date("2025-04-01");
		const rangeEnd = date("2025-04-30");

		const results = collectOccurrences(start, { type: "yearly" }, rangeStart, rangeEnd);

		// The anniversary date (Apr 1) is the rangeStart, so this coincidentally works
		expect(results).toContain("2025-04-01");
	});
});

describe("iterateOccurrencesInRange — daily with interval > 1", () => {
	it("should only yield dates aligned to the interval cycle", () => {
		const start = date("2025-01-01");
		const rangeStart = date("2025-01-05");
		const rangeEnd = date("2025-01-15");

		const results = collectOccurrences(start, { type: "DAILY;INTERVAL=3" }, rangeStart, rangeEnd);

		// Starting Jan 1 with interval 3: Jan 1, 4, 7, 10, 13, 16...
		// In range [Jan 5, Jan 15]: valid occurrences are Jan 7, 10, 13
		for (const r of results) {
			const dayDiff = date(r).diff(start, "days").days;
			expect(dayDiff % 3).toBe(0);
		}
	});

	it("should not yield rangeStart when it is not on the interval cycle", () => {
		const start = date("2025-01-01");
		const rangeStart = date("2025-01-02");
		const rangeEnd = date("2025-01-10");

		const results = collectOccurrences(start, { type: "DAILY;INTERVAL=3" }, rangeStart, rangeEnd);

		expect(results).not.toContain("2025-01-02");
	});

	it("should handle bi-daily when range starts at event start", () => {
		const start = date("2025-01-01");
		const rangeStart = date("2025-01-01");
		const rangeEnd = date("2025-01-07");

		const results = collectOccurrences(start, { type: "bi-daily" }, rangeStart, rangeEnd);

		// Every 2 days from Jan 1: Jan 1, 3, 5, 7
		expect(results).toEqual(["2025-01-01", "2025-01-03", "2025-01-05", "2025-01-07"]);
	});

	it("should work correctly when range starts at event start for custom interval", () => {
		const start = date("2025-01-01");
		const rangeStart = date("2025-01-01");
		const rangeEnd = date("2025-01-15");

		const results = collectOccurrences(start, { type: "DAILY;INTERVAL=3" }, rangeStart, rangeEnd);

		expect(results).toContain("2025-01-01");
		expect(results).toContain("2025-01-04");
		expect(results).toContain("2025-01-07");
		expect(results).toContain("2025-01-10");
		expect(results).toContain("2025-01-13");
	});
});

describe("iterateOccurrencesInRange — monthly day-of-month drift", () => {
	it("should handle month-end clamping (Jan 31 → Feb 28)", () => {
		const start = date("2025-01-31");
		const rangeStart = date("2025-01-01");
		const rangeEnd = date("2025-06-30");

		const results = collectOccurrences(start, { type: "monthly" }, rangeStart, rangeEnd);

		expect(results).toContain("2025-01-31");
		expect(results).toContain("2025-02-28");
	});

	it("should handle quarterly from day 31", () => {
		const start = date("2025-01-31");
		const rangeStart = date("2025-01-01");
		const rangeEnd = date("2025-12-31");

		const results = collectOccurrences(start, { type: "quarterly" }, rangeStart, rangeEnd);

		// Quarterly from Jan 31: Jan 31, Apr 30 (clamped), Jul 30 (clamped from Apr 30), Oct 30
		expect(results[0]).toBe("2025-01-31");
		// After clamping, drift is expected — this documents current behavior
		expect(results.length).toBeGreaterThanOrEqual(3);
	});
});

describe("iterateOccurrencesInRange — weekly with weekdays", () => {
	it("should yield correct weekdays within range", () => {
		const start = date("2025-01-06"); // Monday
		const rangeStart = date("2025-01-06");
		const rangeEnd = date("2025-01-19");

		const weekdays: Weekday[] = ["monday", "wednesday", "friday"];
		const results = collectOccurrences(start, { type: "weekly", weekdays }, rangeStart, rangeEnd);

		const weekdayNumbers = results.map((r) => date(r).weekday);
		// 1=Mon, 3=Wed, 5=Fri
		expect(weekdayNumbers.every((w) => [1, 3, 5].includes(w))).toBe(true);
	});

	it("should handle bi-weekly with weekdays correctly", () => {
		const start = date("2025-01-06"); // Monday
		const rangeStart = date("2025-01-06");
		const rangeEnd = date("2025-02-02");

		const weekdays: Weekday[] = ["monday", "friday"];
		const results = collectOccurrences(start, { type: "bi-weekly", weekdays }, rangeStart, rangeEnd);

		// Week 1 (Jan 6-12): Mon 6, Fri 10
		// Skip week 2 (Jan 13-19)
		// Week 3 (Jan 20-26): Mon 20, Fri 24
		// Skip week 4 (Jan 27-Feb 2)
		expect(results).toContain("2025-01-06");
		expect(results).toContain("2025-01-10");
		expect(results).toContain("2025-01-20");
		expect(results).toContain("2025-01-24");
		expect(results).not.toContain("2025-01-13");
		expect(results).not.toContain("2025-01-17");
	});

	it("should handle empty weekdays array without infinite loop", () => {
		const start = date("2025-01-06");
		const rangeStart = date("2025-01-06");
		const rangeEnd = date("2025-01-12");

		const results = collectOccurrences(start, { type: "weekly", weekdays: [] }, rangeStart, rangeEnd);

		// With no weekdays specified, weekly recurrence should still work (just every 7 days)
		expect(results.length).toBeGreaterThanOrEqual(1);
	});
});

describe("getNextNWeeklyOccurrence edge cases", () => {
	it("should advance to next cycle when current day is the last matching weekday", () => {
		const friday = date("2025-01-10"); // Friday
		const weekdays: Weekday[] = ["monday", "friday"];

		const next = getNextNWeeklyOccurrence(friday, weekdays, 1);

		// Next Monday after Friday = Jan 13
		expect(next.toISODate()).toBe("2025-01-13");
	});

	it("should handle single weekday with interval > 1", () => {
		const monday = date("2025-01-06"); // Monday
		const weekdays: Weekday[] = ["monday"];

		const next = getNextNWeeklyOccurrence(monday, weekdays, 3);

		// No more matching weekdays this week → jump 3 weeks to Jan 27
		expect(next.toISODate()).toBe("2025-01-27");
	});
});

describe("isDateOnWeekdays edge cases", () => {
	it("should handle Sunday correctly (Luxon weekday 7)", () => {
		const sunday = date("2025-01-05"); // Sunday
		expect(isDateOnWeekdays(sunday, ["sunday"])).toBe(true);
	});

	it("should return false for empty weekdays", () => {
		expect(isDateOnWeekdays(date("2025-01-06"), [])).toBe(false);
	});

	it("should handle all weekdays", () => {
		const allDays: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
		expect(isDateOnWeekdays(date("2025-01-06"), allDays)).toBe(true);
		expect(isDateOnWeekdays(date("2025-01-07"), allDays)).toBe(true);
	});
});

describe("getNextOccurrence with unparseable type", () => {
	it("should fall back to +1 day for unknown recurrence type", () => {
		const start = date("2025-01-15");
		const next = getNextOccurrence(start, "unknown-type" as RecurrenceType);

		expect(next.toISODate()).toBe("2025-01-16");
	});

	it("should never return the same date (no infinite loop risk)", () => {
		const start = date("2025-01-15");
		const next = getNextOccurrence(start, "" as RecurrenceType);

		expect(next > start).toBe(true);
	});
});
