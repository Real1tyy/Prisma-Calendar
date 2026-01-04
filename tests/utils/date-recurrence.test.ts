import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
	calculateInstanceDateTime,
	calculateRecurringInstanceDateTime,
	getNextBiWeeklyOccurrence,
	getNextOccurrence,
	getNextWeekdayOccurrence,
	isDateOnWeekdays,
	iterateOccurrencesInRange,
	type RecurrenceType,
	type Weekday,
} from "../../src/utils/date-recurrence";

// ===========================
// DSL Utilities for Testing
// ===========================

/**
 * Creates a DateTime from ISO date string in UTC
 */
function date(isoDate: string): DateTime {
	return DateTime.fromISO(isoDate, { zone: "utc" });
}

/**
 * Formats DateTime to ISO date string (YYYY-MM-DD)
 */
function toDate(dt: DateTime): string {
	return dt.toISODate() || "";
}

/**
 * Generates a sequence of occurrences for testing
 * If weekdays are specified and startDate doesn't match them, start date is excluded
 */
function generateSequence(
	startDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays: Weekday[] | undefined,
	count: number
): DateTime[] {
	const occurrences: DateTime[] = [];
	let current = startDate;

	// Only include start date if it matches the weekdays (or no weekdays specified)
	const shouldIncludeStart = !weekdays || weekdays.length === 0 || isDateOnWeekdays(startDate, weekdays);

	if (shouldIncludeStart) {
		occurrences.push(startDate);
	}

	const iterationsNeeded = shouldIncludeStart ? count - 1 : count;

	for (let i = 0; i < iterationsNeeded; i++) {
		current = getNextOccurrence(current, recurrenceType, weekdays);
		occurrences.push(current);
	}

	return occurrences;
}

/**
 * Generates sequence and returns ISO date strings
 */
function generateDateSequence(
	startDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays: Weekday[] | undefined,
	count: number
): string[] {
	return generateSequence(startDate, recurrenceType, weekdays, count).map(toDate);
}

/**
 * Generates sequence and returns weekday numbers (1=Mon, 7=Sun)
 */
function generateWeekdaySequence(
	startDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays: Weekday[] | undefined,
	count: number
): number[] {
	return generateSequence(startDate, recurrenceType, weekdays, count).map((dt) => dt.weekday);
}

/**
 * Tests that occurrences match expected dates
 */
function expectDates(
	startDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays: Weekday[] | undefined,
	count: number,
	expectedDates: string[]
) {
	const actual = generateDateSequence(startDate, recurrenceType, weekdays, count);
	expect(actual).toEqual(expectedDates);
}

/**
 * Tests that occurrences match expected weekdays
 */
function expectWeekdays(
	startDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays: Weekday[] | undefined,
	count: number,
	expectedWeekdays: number[]
) {
	const actual = generateWeekdaySequence(startDate, recurrenceType, weekdays, count);
	expect(actual).toEqual(expectedWeekdays);
}

/**
 * Tests iterateOccurrencesInRange and returns dates
 */
function iterateDates(
	startDate: DateTime,
	recurrenceType: RecurrenceType,
	weekdays: Weekday[] | undefined,
	rangeStart: DateTime,
	rangeEnd: DateTime
): string[] {
	const occurrences = Array.from(
		iterateOccurrencesInRange(startDate, { type: recurrenceType, weekdays }, rangeStart, rangeEnd)
	);
	return occurrences.map(toDate);
}

describe("date-recurrence", () => {
	// ===========================
	// Time Context Tests
	// Tests that recurrence works correctly based on when the source event is:
	// 1. Now (current date)
	// 2. Past (only future events generated)
	// 3. Future (start from source, continue forward)
	// ===========================

	describe("Daily Recurrence - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-20");
			expectDates(now, "daily", undefined, 5, ["2025-10-20", "2025-10-21", "2025-10-22", "2025-10-23", "2025-10-24"]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-10-15");
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2025-10-25");

			const dates = iterateDates(pastSource, "daily", undefined, rangeStart, rangeEnd);

			// Should generate daily from rangeStart onwards, not retroactively from past source
			expect(dates).toEqual(["2025-10-20", "2025-10-21", "2025-10-22", "2025-10-23", "2025-10-24", "2025-10-25"]);
			expect(dates).not.toContain("2025-10-15"); // Source date not in range
			expect(dates).not.toContain("2025-10-19"); // Before range start
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2025-10-25");
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2025-10-30");

			const dates = iterateDates(futureSource, "daily", undefined, rangeStart, rangeEnd);

			// Should start from future source date, not from rangeStart
			expect(dates).toEqual(["2025-10-25", "2025-10-26", "2025-10-27", "2025-10-28", "2025-10-29", "2025-10-30"]);
			expect(dates[0]).toBe("2025-10-25"); // First occurrence is the source
		});
	});

	describe("Weekly Recurrence (no weekdays) - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-20"); // Monday
			expectDates(now, "weekly", undefined, 4, ["2025-10-20", "2025-10-27", "2025-11-03", "2025-11-10"]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-10-06"); // Monday 2 weeks ago
			const rangeStart = date("2025-10-20"); // Now (Monday)
			const rangeEnd = date("2025-11-17");

			const dates = iterateDates(pastSource, "weekly", undefined, rangeStart, rangeEnd);

			// Should generate every Monday from rangeStart onwards
			expect(dates).toEqual(["2025-10-20", "2025-10-27", "2025-11-03", "2025-11-10", "2025-11-17"]);
			expect(dates).not.toContain("2025-10-06"); // Source not in range
			expect(dates).not.toContain("2025-10-13"); // Before range start
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2025-11-03"); // Monday in future
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2025-11-24");

			const dates = iterateDates(futureSource, "weekly", undefined, rangeStart, rangeEnd);

			// Should start from future source, then continue weekly
			expect(dates).toEqual(["2025-11-03", "2025-11-10", "2025-11-17", "2025-11-24"]);
			expect(dates[0]).toBe("2025-11-03");
		});
	});

	describe("Weekly Recurrence (with weekdays) - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-20"); // Monday
			expectDates(now, "weekly", ["monday", "wednesday", "friday"], 6, [
				"2025-10-20", // Mon
				"2025-10-22", // Wed
				"2025-10-24", // Fri
				"2025-10-27", // Mon
				"2025-10-29", // Wed
				"2025-10-31", // Fri
			]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-10-06"); // Monday in past
			const rangeStart = date("2025-10-20"); // Now (Monday)
			const rangeEnd = date("2025-11-02");

			const dates = iterateDates(pastSource, "weekly", ["monday", "wednesday"], rangeStart, rangeEnd);

			// Should generate Mon/Wed from rangeStart onwards
			expect(dates).toEqual(["2025-10-20", "2025-10-22", "2025-10-27", "2025-10-29"]);
			expect(dates).not.toContain("2025-10-06"); // Source not in range
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2025-11-03"); // Monday in future
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2025-11-16");

			const dates = iterateDates(futureSource, "weekly", ["monday", "thursday"], rangeStart, rangeEnd);

			// Should start from future source Mon, then Thu, then next Mon, etc.
			expect(dates).toEqual(["2025-11-03", "2025-11-06", "2025-11-10", "2025-11-13"]);
		});
	});

	describe("Bi-Weekly Recurrence (no weekdays) - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-20"); // Monday
			expectDates(now, "bi-weekly", undefined, 4, ["2025-10-20", "2025-11-03", "2025-11-17", "2025-12-01"]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-10-06"); // Monday 2 weeks ago
			const rangeStart = date("2025-10-20"); // Now (Monday in correct bi-weekly cycle)
			const rangeEnd = date("2025-11-24");

			const dates = iterateDates(pastSource, "bi-weekly", undefined, rangeStart, rangeEnd);

			// Should generate every other Monday from rangeStart (respecting bi-weekly cycle)
			expect(dates).toEqual(["2025-10-20", "2025-11-03", "2025-11-17"]);
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2025-11-03"); // Monday in future
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2025-12-08");

			const dates = iterateDates(futureSource, "bi-weekly", undefined, rangeStart, rangeEnd);

			// Should start from future source, then every 2 weeks
			expect(dates).toEqual(["2025-11-03", "2025-11-17", "2025-12-01"]);
		});
	});

	describe("Bi-Weekly Recurrence (with weekdays) - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-20"); // Monday
			expectDates(now, "bi-weekly", ["monday", "wednesday", "friday"], 6, [
				"2025-10-20", // Mon Week 1
				"2025-10-22", // Wed Week 1
				"2025-10-24", // Fri Week 1
				"2025-11-03", // Mon Week 3
				"2025-11-05", // Wed Week 3
				"2025-11-07", // Fri Week 3
			]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-10-06"); // Monday 2 weeks ago
			const rangeStart = date("2025-10-20"); // Now (Monday in correct bi-weekly cycle)
			const rangeEnd = date("2025-11-10");

			const dates = iterateDates(pastSource, "bi-weekly", ["monday", "wednesday"], rangeStart, rangeEnd);

			// Should generate Mon/Wed in bi-weekly cycles from rangeStart
			expect(dates).toEqual(["2025-10-20", "2025-10-22", "2025-11-03", "2025-11-05"]);
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2025-11-03"); // Monday in future
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2025-11-21");

			const dates = iterateDates(futureSource, "bi-weekly", ["monday", "thursday"], rangeStart, rangeEnd);

			// Should start from future Mon, then Thu same week, then Mon 2 weeks later, etc.
			expect(dates).toEqual(["2025-11-03", "2025-11-06", "2025-11-17", "2025-11-20"]);
		});
	});

	describe("Monthly Recurrence - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-15");
			expectDates(now, "monthly", undefined, 4, ["2025-10-15", "2025-11-15", "2025-12-15", "2026-01-15"]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-08-15");
			const rangeStart = date("2025-10-15"); // Now (aligned with source day)
			const rangeEnd = date("2026-01-31");

			const dates = iterateDates(pastSource, "monthly", undefined, rangeStart, rangeEnd);

			// Should generate 15th of each month from rangeStart onwards
			expect(dates).toEqual(["2025-10-15", "2025-11-15", "2025-12-15", "2026-01-15"]);
			expect(dates).not.toContain("2025-08-15"); // Source not in range
			expect(dates).not.toContain("2025-09-15"); // Before range start
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2025-12-15");
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2026-03-31");

			const dates = iterateDates(futureSource, "monthly", undefined, rangeStart, rangeEnd);

			// Should start from Dec 15, then continue monthly
			expect(dates).toEqual(["2025-12-15", "2026-01-15", "2026-02-15", "2026-03-15"]);
			expect(dates[0]).toBe("2025-12-15");
		});
	});

	describe("Bi-Monthly Recurrence - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-15");
			expectDates(now, "bi-monthly", undefined, 4, ["2025-10-15", "2025-12-15", "2026-02-15", "2026-04-15"]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-06-15");
			const rangeStart = date("2025-10-15"); // Now (aligned with source day)
			const rangeEnd = date("2026-05-01");

			const dates = iterateDates(pastSource, "bi-monthly", undefined, rangeStart, rangeEnd);

			// Should generate every 2 months from rangeStart onwards (respecting bi-monthly cycle)
			expect(dates).toEqual(["2025-10-15", "2025-12-15", "2026-02-15", "2026-04-15"]);
			expect(dates).not.toContain("2025-06-15"); // Source not in range
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2025-12-15");
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2026-06-30");

			const dates = iterateDates(futureSource, "bi-monthly", undefined, rangeStart, rangeEnd);

			// Should start from Dec, then every 2 months
			expect(dates).toEqual(["2025-12-15", "2026-02-15", "2026-04-15", "2026-06-15"]);
			expect(dates[0]).toBe("2025-12-15");
		});
	});

	describe("Quarterly Recurrence - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-15");
			expectDates(now, "quarterly", undefined, 4, ["2025-10-15", "2026-01-15", "2026-04-15", "2026-07-15"]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2025-04-15");
			const rangeStart = date("2025-10-15"); // Now (aligned with source day)
			const rangeEnd = date("2026-08-01");

			const dates = iterateDates(pastSource, "quarterly", undefined, rangeStart, rangeEnd);

			// Should generate every 3 months from rangeStart onwards (respecting quarterly cycle)
			expect(dates).toEqual(["2025-10-15", "2026-01-15", "2026-04-15", "2026-07-15"]);
			expect(dates).not.toContain("2025-04-15"); // Source not in range
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2026-01-15");
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2026-10-30");

			const dates = iterateDates(futureSource, "quarterly", undefined, rangeStart, rangeEnd);

			// Should start from Jan, then every 3 months
			expect(dates).toEqual(["2026-01-15", "2026-04-15", "2026-07-15", "2026-10-15"]);
			expect(dates[0]).toBe("2026-01-15");
		});
	});

	describe("Yearly Recurrence - Time Context", () => {
		it("should generate future events when source is now", () => {
			const now = date("2025-10-20");
			expectDates(now, "yearly", undefined, 4, ["2025-10-20", "2026-10-20", "2027-10-20", "2028-10-20"]);
		});

		it("should only generate future events when source is in the past", () => {
			const pastSource = date("2023-10-20");
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2028-12-31");

			const dates = iterateDates(pastSource, "yearly", undefined, rangeStart, rangeEnd);

			// Should generate Oct 20 each year from 2025 onwards
			expect(dates).toEqual(["2025-10-20", "2026-10-20", "2027-10-20", "2028-10-20"]);
			expect(dates).not.toContain("2023-10-20"); // Source not in range
			expect(dates).not.toContain("2024-10-20"); // Before range start
		});

		it("should start from source when source is in the future", () => {
			const futureSource = date("2027-10-20");
			const rangeStart = date("2025-10-20"); // Now
			const rangeEnd = date("2030-12-31");

			const dates = iterateDates(futureSource, "yearly", undefined, rangeStart, rangeEnd);

			// Should start from 2027, then continue yearly
			expect(dates).toEqual(["2027-10-20", "2028-10-20", "2029-10-20", "2030-10-20"]);
			expect(dates[0]).toBe("2027-10-20");
		});
	});

	// ===========================
	// Bi-Weekly Bug Tests (REGRESSION)
	// ===========================
	describe("Bi-weekly with multiple weekdays (BUG REPRODUCTION)", () => {
		it("should generate Mon→Tue→Wed→Mon (2 weeks later) for bi-weekly [Mon,Tue,Wed]", () => {
			const monday = date("2025-10-20"); // Monday Week 1
			const weekdays: Weekday[] = ["monday", "tuesday", "wednesday"];

			// Expected: Mon Oct 20 → Tue Oct 21 → Wed Oct 22 → Mon Nov 3 → Tue Nov 4 → Wed Nov 5
			expectDates(monday, "bi-weekly", weekdays, 6, [
				"2025-10-20", // Mon Week 1
				"2025-10-21", // Tue Week 1
				"2025-10-22", // Wed Week 1
				"2025-11-03", // Mon Week 3 (2 weeks later)
				"2025-11-04", // Tue Week 3
				"2025-11-05", // Wed Week 3
			]);
		});

		it("should generate correct sequence for bi-weekly [Tue,Thu] starting on Tuesday", () => {
			const tuesday = date("2025-10-21"); // Tuesday Week 1

			expectDates(tuesday, "bi-weekly", ["tuesday", "thursday"], 6, [
				"2025-10-21", // Tue Week 1
				"2025-10-23", // Thu Week 1
				"2025-11-04", // Tue Week 3
				"2025-11-06", // Thu Week 3
				"2025-11-18", // Tue Week 5
				"2025-11-20", // Thu Week 5
			]);
		});

		it("should generate correct sequence for bi-weekly [Mon,Wed,Fri] starting on Wednesday", () => {
			const wednesday = date("2025-10-22"); // Wednesday Week 1

			expectDates(wednesday, "bi-weekly", ["monday", "wednesday", "friday"], 7, [
				"2025-10-22", // Wed Week 1
				"2025-10-24", // Fri Week 1
				"2025-11-03", // Mon Week 3
				"2025-11-05", // Wed Week 3
				"2025-11-07", // Fri Week 3
				"2025-11-17", // Mon Week 5
				"2025-11-19", // Wed Week 5
			]);
		});

		it("should work for bi-weekly [Sun,Mon,Tue] with Sunday start", () => {
			const sunday = date("2025-10-26"); // Sunday

			expectWeekdays(sunday, "bi-weekly", ["sunday", "monday", "tuesday"], 6, [
				7, // Sun
				1, // Mon
				2, // Tue
				7, // Sun (2 weeks later)
				1, // Mon
				2, // Tue
			]);
		});

		it("should handle bi-weekly with single weekday correctly", () => {
			const wednesday = date("2025-10-22");

			expectDates(wednesday, "bi-weekly", ["wednesday"], 4, [
				"2025-10-22", // Wed Week 1
				"2025-11-05", // Wed Week 3
				"2025-11-19", // Wed Week 5
				"2025-12-03", // Wed Week 7
			]);
		});
	});

	// ===========================
	// Edge Cases & Special Scenarios
	// ===========================

	describe("Edge Cases", () => {
		it("should handle empty weekdays array gracefully", () => {
			expectDates(date("2025-10-20"), "weekly", [], 2, ["2025-10-20", "2025-10-27"]);
		});

		it("should handle unsorted weekday arrays", () => {
			expectWeekdays(date("2025-10-20"), "weekly", ["friday", "monday", "wednesday"], 6, [
				1,
				3,
				5, // Mon, Wed, Fri (sorted automatically)
				1,
				3,
				5, // Week 2
			]);
		});

		it("should handle all 7 weekdays", () => {
			const allWeekdays: Weekday[] = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
			expectWeekdays(date("2025-10-20"), "weekly", allWeekdays, 7, [1, 2, 3, 4, 5, 6, 7]);
		});

		it("should handle weekend-only pattern", () => {
			expectWeekdays(date("2025-10-24"), "weekly", ["saturday", "sunday"], 6, [
				6,
				7, // Sat, Sun (Week 1)
				6,
				7, // Sat, Sun (Week 2)
				6,
				7, // Sat, Sun (Week 3)
			]);
		});

		it("should handle month-end dates (Luxon overflow behavior)", () => {
			// Luxon maintains day number (30) after first overflow
			// Oct 31 → Nov 30 (Nov has 30 days) → Dec 30 (maintains day 30)
			expectDates(date("2025-10-31"), "monthly", undefined, 3, [
				"2025-10-31",
				"2025-11-30", // November has 30 days
				"2025-12-30", // Luxon maintains day 30
			]);
		});

		it("should handle leap year dates", () => {
			expectDates(date("2024-02-29"), "yearly", undefined, 3, [
				"2024-02-29",
				"2025-02-28", // 2025 is not a leap year
				"2026-02-28",
			]);
		});

		it("should work across month boundaries (daily)", () => {
			expectDates(date("2025-10-30"), "daily", undefined, 4, ["2025-10-30", "2025-10-31", "2025-11-01", "2025-11-02"]);
		});

		it("should handle starting mid-week with specific weekdays", () => {
			const wednesday = date("2025-10-22");
			expectDates(wednesday, "weekly", ["tuesday", "thursday"], 5, [
				"2025-10-23", // Thu (this week)
				"2025-10-28", // Tue (next week)
				"2025-10-30", // Thu
				"2025-11-04", // Tue
				"2025-11-06", // Thu
			]);
		});
	});

	// ===========================
	// Low-Level Function Tests
	// ===========================

	describe("Saturday Skip Bug Fix (Regression)", () => {
		it("should not skip Saturday when weekdays are [sunday, friday, saturday]", () => {
			const friday = date("2025-10-24");
			const next = getNextWeekdayOccurrence(friday, ["sunday", "friday", "saturday"]);

			expect(next.weekday).toBe(6); // Saturday
			expect(next.toISODate()).toBe("2025-10-25");
		});

		it("should generate correct pattern: Fri→Sat→Sun→Fri", () => {
			expectWeekdays(date("2025-10-22"), "weekly", ["sunday", "friday", "saturday"], 6, [5, 6, 7, 5, 6, 7]);
		});

		it("should generate all weekdays in correct sequence", () => {
			expectDates(date("2025-10-22"), "weekly", ["sunday", "friday", "saturday"], 6, [
				"2025-10-24",
				"2025-10-25",
				"2025-10-26",
				"2025-10-31",
				"2025-11-01",
				"2025-11-02",
			]);
		});
	});

	describe("isDateOnWeekdays", () => {
		it("should correctly identify if date matches specified weekdays", () => {
			const monday = date("2025-10-20");
			const friday = date("2025-10-24");
			const sunday = date("2025-10-26");

			expect(isDateOnWeekdays(monday, ["monday", "wednesday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(friday, ["monday", "wednesday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(sunday, ["monday", "wednesday", "friday"])).toBe(false);
			expect(isDateOnWeekdays(sunday, ["sunday"])).toBe(true);
		});

		it("should handle Sunday correctly", () => {
			const sunday = date("2025-10-26");
			expect(isDateOnWeekdays(sunday, ["sunday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(sunday, ["monday", "friday"])).toBe(false);
		});
	});

	describe("getNextWeekdayOccurrence", () => {
		it("should find next weekday in current week", () => {
			const next = getNextWeekdayOccurrence(date("2025-10-22"), ["friday", "saturday", "sunday"]);
			expect(next.weekday).toBe(5); // Friday
			expect(next.toISODate()).toBe("2025-10-24");
		});

		it("should wrap to next week if no more weekdays in current week", () => {
			const next = getNextWeekdayOccurrence(date("2025-10-25"), ["monday", "wednesday", "friday"]);
			expect(next.weekday).toBe(1); // Monday
			expect(next.toISODate()).toBe("2025-10-27");
		});

		it("should handle Sunday correctly", () => {
			const next = getNextWeekdayOccurrence(date("2025-10-20"), ["friday", "sunday"]);
			expect(next.weekday).toBe(5); // Friday (this week)
			expect(next.toISODate()).toBe("2025-10-24");
		});

		it("should handle unsorted weekday arrays", () => {
			const next = getNextWeekdayOccurrence(date("2025-10-20"), ["saturday", "tuesday", "thursday"]);
			expect(next.weekday).toBe(2); // Tuesday (next day)
			expect(next.toISODate()).toBe("2025-10-21");
		});
	});

	describe("getNextBiWeeklyOccurrence", () => {
		it("should return next weekday in same week if available", () => {
			const next = getNextBiWeeklyOccurrence(date("2025-10-20"), ["wednesday", "friday"]);
			expect(next.toISODate()).toBe("2025-10-22"); // Wednesday (same week)
			expect(next.weekday).toBe(3);
		});

		it("should jump 2 weeks when no more weekdays in current week", () => {
			const next = getNextBiWeeklyOccurrence(date("2025-10-24"), ["monday", "wednesday"]);
			expect(next.toISODate()).toBe("2025-11-03"); // Monday (2 weeks later)
			expect(next.weekday).toBe(1);
		});
	});

	describe("getNextOccurrence", () => {
		it("should handle daily recurrence", () => {
			expect(getNextOccurrence(date("2025-10-20"), "daily").toISODate()).toBe("2025-10-21");
		});

		it("should handle weekly recurrence without weekdays", () => {
			expect(getNextOccurrence(date("2025-10-20"), "weekly").toISODate()).toBe("2025-10-27");
		});

		it("should handle weekly recurrence with weekdays", () => {
			expect(getNextOccurrence(date("2025-10-20"), "weekly", ["wednesday", "friday"]).toISODate()).toBe("2025-10-22");
		});

		it("should handle monthly recurrence", () => {
			expect(getNextOccurrence(date("2025-10-20"), "monthly").toISODate()).toBe("2025-11-20");
		});

		it("should handle bi-monthly recurrence", () => {
			expect(getNextOccurrence(date("2025-10-20"), "bi-monthly").toISODate()).toBe("2025-12-20");
		});

		it("should handle quarterly recurrence", () => {
			expect(getNextOccurrence(date("2025-10-20"), "quarterly").toISODate()).toBe("2026-01-20");
		});

		it("should handle yearly recurrence", () => {
			expect(getNextOccurrence(date("2025-10-20"), "yearly").toISODate()).toBe("2026-10-20");
		});
	});

	describe("iterateOccurrencesInRange", () => {
		it("should generate all weekday occurrences for weekly recurrence", () => {
			const startDate = date("2025-10-22T08:30:00Z");
			const weekdays: Weekday[] = ["friday", "saturday", "sunday"];
			const rangeStart = date("2025-10-20");
			const rangeEnd = date("2025-11-02");

			const dates = iterateDates(startDate, "weekly", weekdays, rangeStart, rangeEnd);

			expect(dates).toContain("2025-10-24");
			expect(dates).toContain("2025-10-25");
			expect(dates).toContain("2025-10-26");
			expect(dates).toContain("2025-10-31");
			expect(dates).toContain("2025-11-01");
			expect(dates).toContain("2025-11-02");
			expect(dates.length).toBe(6);
		});

		it("should handle weekly recurrence with single weekday", () => {
			const dates = iterateDates(date("2025-10-20"), "weekly", ["wednesday"], date("2025-10-20"), date("2025-11-10"));
			expect(dates).toEqual(["2025-10-22", "2025-10-29", "2025-11-05"]);
		});

		it("should handle bi-weekly recurrence with multiple weekdays", () => {
			const dates = iterateDates(
				date("2025-10-20"),
				"bi-weekly",
				["tuesday", "thursday"],
				date("2025-10-20"),
				date("2025-11-15")
			);
			expect(dates).toContain("2025-10-21");
			expect(dates).toContain("2025-10-23");
			expect(dates).toContain("2025-11-04");
			expect(dates).toContain("2025-11-06");
		});

		it("should handle daily recurrence", () => {
			const dates = iterateDates(date("2025-10-20"), "daily", undefined, date("2025-10-20"), date("2025-10-25"));
			expect(dates.length).toBe(6);
		});

		it("should handle monthly recurrence", () => {
			const dates = iterateDates(date("2025-10-15"), "monthly", undefined, date("2025-10-15"), date("2025-12-31"));
			expect(dates).toEqual(["2025-10-15", "2025-11-15", "2025-12-15"]);
		});
	});

	describe("calculateInstanceDateTime", () => {
		it("should apply time to date", () => {
			const result = calculateInstanceDateTime(date("2025-10-20"), "14:30");
			expect(result.hour).toBe(14);
			expect(result.minute).toBe(30);
			expect(result.toISODate()).toBe("2025-10-20");
		});

		it("should return start of day when no time provided", () => {
			const result = calculateInstanceDateTime(date("2025-10-20T10:00:00"));
			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-10-20");
		});
	});

	describe("calculateRecurringInstanceDateTime", () => {
		it("should preserve time for daily recurrence", () => {
			const result = calculateRecurringInstanceDateTime(
				date("2025-10-21"),
				date("2025-10-20T14:30:00"),
				"daily",
				false
			);
			expect(result.hour).toBe(14);
			expect(result.minute).toBe(30);
			expect(result.toISODate()).toBe("2025-10-21");
		});

		it("should preserve day and time for monthly recurrence", () => {
			const result = calculateRecurringInstanceDateTime(
				date("2025-11-01"),
				date("2025-10-15T09:00:00"),
				"monthly",
				false
			);
			expect(result.day).toBe(15);
			expect(result.hour).toBe(9);
			expect(result.toISODate()).toBe("2025-11-15");
		});

		it("should handle all-day events", () => {
			const result = calculateRecurringInstanceDateTime(date("2025-10-21"), date("2025-10-20T14:30:00"), "daily", true);
			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-10-21");
		});

		it("should preserve month and day for yearly recurrence", () => {
			const result = calculateRecurringInstanceDateTime(
				date("2026-01-01"),
				date("2025-10-20T10:00:00"),
				"yearly",
				false
			);
			expect(result.month).toBe(10);
			expect(result.day).toBe(20);
			expect(result.hour).toBe(10);
			expect(result.toISODate()).toBe("2026-10-20");
		});
	});
});
