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
	type Weekday,
} from "../../src/utils/date-recurrence";

describe("date-recurrence", () => {
	describe("Saturday skip bug fix", () => {
		it("should not skip Saturday when weekdays are [sunday, friday, saturday]", () => {
			const weekdays: Weekday[] = ["sunday", "friday", "saturday"];
			const friday = DateTime.fromISO("2025-10-24T08:30:00.000Z", { zone: "utc" });

			const next = getNextWeekdayOccurrence(friday, weekdays);

			expect(next.weekday).toBe(6);
			expect(next.weekdayLong).toBe("Saturday");
			expect(next.toISODate()).toBe("2025-10-25");
		});

		it("should generate correct pattern: Friday → Saturday → Sunday → Friday", () => {
			const weekdays: Weekday[] = ["sunday", "friday", "saturday"];
			let current = DateTime.fromISO("2025-10-22T08:30:00.000Z", { zone: "utc" });

			const instances: number[] = [];

			for (let i = 0; i < 6; i++) {
				current = getNextOccurrence(current, "weekly", weekdays);
				instances.push(current.weekday);
			}

			expect(instances).toEqual([5, 6, 7, 5, 6, 7]);
		});

		it("should generate all weekdays in correct sequence", () => {
			const weekdays: Weekday[] = ["sunday", "friday", "saturday"];
			let current = DateTime.fromISO("2025-10-22T08:30:00.000Z", { zone: "utc" });

			const dates: string[] = [];

			for (let i = 0; i < 6; i++) {
				current = getNextOccurrence(current, "weekly", weekdays);
				dates.push(current.toISODate() || "");
			}

			expect(dates).toEqual(["2025-10-24", "2025-10-25", "2025-10-26", "2025-10-31", "2025-11-01", "2025-11-02"]);
		});
	});

	describe("isDateOnWeekdays", () => {
		it("should correctly identify if a date is on specified weekdays", () => {
			const monday = DateTime.fromISO("2025-10-20");
			const friday = DateTime.fromISO("2025-10-24");
			const sunday = DateTime.fromISO("2025-10-26");

			expect(isDateOnWeekdays(monday, ["monday", "wednesday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(friday, ["monday", "wednesday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(sunday, ["monday", "wednesday", "friday"])).toBe(false);
			expect(isDateOnWeekdays(sunday, ["sunday"])).toBe(true);
		});

		it("should handle sunday correctly", () => {
			const sunday = DateTime.fromISO("2025-10-26");
			expect(isDateOnWeekdays(sunday, ["sunday", "friday"])).toBe(true);
			expect(isDateOnWeekdays(sunday, ["monday", "friday"])).toBe(false);
		});
	});

	describe("getNextWeekdayOccurrence", () => {
		it("should find next weekday in current week", () => {
			const wednesday = DateTime.fromISO("2025-10-22");
			const weekdays: Weekday[] = ["friday", "saturday", "sunday"];

			const next = getNextWeekdayOccurrence(wednesday, weekdays);
			expect(next.weekday).toBe(5);
			expect(next.toISODate()).toBe("2025-10-24");
		});

		it("should wrap to next week if no more weekdays in current week", () => {
			const saturday = DateTime.fromISO("2025-10-25");
			const weekdays: Weekday[] = ["monday", "wednesday", "friday"];

			const next = getNextWeekdayOccurrence(saturday, weekdays);
			expect(next.weekday).toBe(1);
			expect(next.toISODate()).toBe("2025-10-27");
		});

		it("should handle sunday correctly", () => {
			const monday = DateTime.fromISO("2025-10-20");
			const weekdays: Weekday[] = ["friday", "sunday"];

			const next = getNextWeekdayOccurrence(monday, weekdays);
			expect(next.weekday).toBe(5);
			expect(next.toISODate()).toBe("2025-10-24");
		});

		it("should handle unsorted weekday arrays correctly", () => {
			const monday = DateTime.fromISO("2025-10-20");
			const weekdays: Weekday[] = ["saturday", "tuesday", "thursday"];

			const next = getNextWeekdayOccurrence(monday, weekdays);
			expect(next.weekday).toBe(2);
			expect(next.toISODate()).toBe("2025-10-21");
		});
	});

	describe("getNextBiWeeklyOccurrence", () => {
		it("should skip one week after finding next weekday", () => {
			const monday = DateTime.fromISO("2025-10-20");
			const weekdays: Weekday[] = ["wednesday", "friday"];

			const next = getNextBiWeeklyOccurrence(monday, weekdays);
			expect(next.toISODate()).toBe("2025-10-29");
		});
	});

	describe("getNextOccurrence", () => {
		it("should handle daily recurrence", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "daily");
			expect(next.toISODate()).toBe("2025-10-21");
		});

		it("should handle weekly recurrence without weekdays", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "weekly");
			expect(next.toISODate()).toBe("2025-10-27");
		});

		it("should handle weekly recurrence with weekdays", () => {
			const monday = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(monday, "weekly", ["wednesday", "friday"]);
			expect(next.toISODate()).toBe("2025-10-22");
		});

		it("should handle monthly recurrence", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "monthly");
			expect(next.toISODate()).toBe("2025-11-20");
		});

		it("should handle bi-monthly recurrence", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "bi-monthly");
			expect(next.toISODate()).toBe("2025-12-20");
		});

		it("should handle yearly recurrence", () => {
			const date = DateTime.fromISO("2025-10-20");
			const next = getNextOccurrence(date, "yearly");
			expect(next.toISODate()).toBe("2026-10-20");
		});
	});

	describe("iterateOccurrencesInRange", () => {
		it("should generate all weekday occurrences for weekly recurrence", () => {
			const startDate = DateTime.fromISO("2025-10-22T08:30:00Z");
			const weekdays: Weekday[] = ["friday", "saturday", "sunday"];
			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-11-02");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "weekly", weekdays }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());

			expect(dates).toContain("2025-10-24");
			expect(dates).toContain("2025-10-25");
			expect(dates).toContain("2025-10-26");
			expect(dates).toContain("2025-10-31");
			expect(dates).toContain("2025-11-01");
			expect(dates).toContain("2025-11-02");
			expect(dates.length).toBe(6);
		});

		it("should handle weekly recurrence with single weekday", () => {
			const startDate = DateTime.fromISO("2025-10-20");
			const weekdays: Weekday[] = ["wednesday"];
			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-11-10");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "weekly", weekdays }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());

			expect(dates).toEqual(["2025-10-22", "2025-10-29", "2025-11-05"]);
		});

		it("should handle bi-weekly recurrence with multiple weekdays", () => {
			const startDate = DateTime.fromISO("2025-10-20");
			const weekdays: Weekday[] = ["tuesday", "thursday"];
			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-11-15");

			const occurrences = Array.from(
				iterateOccurrencesInRange(startDate, { type: "bi-weekly", weekdays }, rangeStart, rangeEnd)
			);

			const dates = occurrences.map((d) => d.toISODate());

			expect(dates).toContain("2025-10-21");
			expect(dates).toContain("2025-10-23");
			expect(dates).toContain("2025-11-04");
			expect(dates).toContain("2025-11-06");
		});

		it("should handle daily recurrence", () => {
			const startDate = DateTime.fromISO("2025-10-20");
			const rangeStart = DateTime.fromISO("2025-10-20");
			const rangeEnd = DateTime.fromISO("2025-10-25");

			const occurrences = Array.from(iterateOccurrencesInRange(startDate, { type: "daily" }, rangeStart, rangeEnd));

			expect(occurrences.length).toBe(6);
		});

		it("should handle monthly recurrence", () => {
			const startDate = DateTime.fromISO("2025-10-15");
			const rangeStart = DateTime.fromISO("2025-10-15");
			const rangeEnd = DateTime.fromISO("2025-12-31");

			const occurrences = Array.from(iterateOccurrencesInRange(startDate, { type: "monthly" }, rangeStart, rangeEnd));

			const dates = occurrences.map((d) => d.toISODate());
			expect(dates).toEqual(["2025-10-15", "2025-11-15", "2025-12-15"]);
		});
	});

	describe("calculateInstanceDateTime", () => {
		it("should handle date with time", () => {
			const date = DateTime.fromISO("2025-10-20");
			const result = calculateInstanceDateTime(date, "14:30");

			expect(result.hour).toBe(14);
			expect(result.minute).toBe(30);
			expect(result.toISODate()).toBe("2025-10-20");
		});

		it("should handle date without time", () => {
			const date = DateTime.fromISO("2025-10-20T10:00:00");
			const result = calculateInstanceDateTime(date);

			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-10-20");
		});
	});

	describe("calculateRecurringInstanceDateTime", () => {
		it("should preserve time for daily recurrence", () => {
			const nextInstance = DateTime.fromISO("2025-10-21");
			const originalEvent = DateTime.fromISO("2025-10-20T14:30:00");

			const result = calculateRecurringInstanceDateTime(nextInstance, originalEvent, "daily", false);

			expect(result.hour).toBe(14);
			expect(result.minute).toBe(30);
			expect(result.toISODate()).toBe("2025-10-21");
		});

		it("should preserve day and time for monthly recurrence", () => {
			const nextInstance = DateTime.fromISO("2025-11-01");
			const originalEvent = DateTime.fromISO("2025-10-15T09:00:00");

			const result = calculateRecurringInstanceDateTime(nextInstance, originalEvent, "monthly", false);

			expect(result.day).toBe(15);
			expect(result.hour).toBe(9);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-11-15");
		});

		it("should handle all-day events", () => {
			const nextInstance = DateTime.fromISO("2025-10-21");
			const originalEvent = DateTime.fromISO("2025-10-20T14:30:00");

			const result = calculateRecurringInstanceDateTime(nextInstance, originalEvent, "daily", true);

			expect(result.hour).toBe(0);
			expect(result.minute).toBe(0);
			expect(result.toISODate()).toBe("2025-10-21");
		});

		it("should preserve month and day for yearly recurrence", () => {
			const nextInstance = DateTime.fromISO("2026-01-01");
			const originalEvent = DateTime.fromISO("2025-10-20T10:00:00");

			const result = calculateRecurringInstanceDateTime(nextInstance, originalEvent, "yearly", false);

			expect(result.month).toBe(10);
			expect(result.day).toBe(20);
			expect(result.hour).toBe(10);
			expect(result.toISODate()).toBe("2026-10-20");
		});
	});
});
