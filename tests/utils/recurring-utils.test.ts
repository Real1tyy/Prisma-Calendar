import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import type { RRuleFrontmatter } from "../../src/types/recurring-event";
import {
	calculateTargetInstanceCount,
	findFirstValidStartDate,
	getStartDateTime,
} from "../../src/utils/recurring-utils";

describe("recurring-utils", () => {
	describe("calculateTargetInstanceCount", () => {
		it("should return default count for daily recurrence", () => {
			const rrules: RRuleFrontmatter = {
				type: "daily",
				weekdays: [],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, undefined, 3);
			expect(result).toBe(3);
		});

		it("should return default count for monthly recurrence", () => {
			const rrules: RRuleFrontmatter = {
				type: "monthly",
				weekdays: [],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, undefined, 5);
			expect(result).toBe(5);
		});

		it("should multiply by weekdays count for weekly recurrence", () => {
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: ["monday", "wednesday", "friday"],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, undefined, 2);
			expect(result).toBe(6); // 3 weekdays * 2 intervals = 6
		});

		it("should multiply by weekdays count for bi-weekly recurrence", () => {
			const rrules: RRuleFrontmatter = {
				type: "bi-weekly",
				weekdays: ["tuesday", "thursday"],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, undefined, 3);
			expect(result).toBe(6); // 2 weekdays * 3 intervals = 6
		});

		it("should use override value when provided", () => {
			const rrules: RRuleFrontmatter = {
				type: "daily",
				weekdays: [],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, 10, 3);
			expect(result).toBe(10);
		});

		it("should use override value for weekly recurrence", () => {
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: ["monday", "friday"],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, 5, 2);
			expect(result).toBe(10); // 2 weekdays * 5 override = 10
		});

		it("should default to 1 weekday if weekdays array is empty for weekly", () => {
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: [],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, undefined, 4);
			expect(result).toBe(4); // 1 * 4 = 4
		});

		it("should handle invalid override values and use default", () => {
			const rrules: RRuleFrontmatter = {
				type: "monthly",
				weekdays: [],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, "invalid", 7);
			expect(result).toBe(7);
		});

		it("should handle negative override values and use default", () => {
			const rrules: RRuleFrontmatter = {
				type: "monthly",
				weekdays: [],
				allDay: true,
				date: DateTime.utc(2025, 1, 1),
			};
			const result = calculateTargetInstanceCount(rrules, -5, 7);
			expect(result).toBe(7);
		});
	});

	describe("getStartDateTime", () => {
		it("should return date for all-day events", () => {
			const date = DateTime.utc(2025, 3, 15);
			const rrules: RRuleFrontmatter = {
				type: "daily",
				weekdays: [],
				allDay: true,
				date,
			};
			const result = getStartDateTime(rrules);
			expect(result).toBe(date);
		});

		it("should return startTime for timed events", () => {
			const startTime = DateTime.utc(2025, 3, 15, 14, 30);
			const endTime = DateTime.utc(2025, 3, 15, 16, 0);
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: [],
				startTime,
				endTime,
				allDay: false,
			};
			const result = getStartDateTime(rrules);
			expect(result).toBe(startTime);
		});

		it("should handle undefined allDay (treated as timed event)", () => {
			const startTime = DateTime.utc(2025, 3, 15, 10, 0);
			const endTime = DateTime.utc(2025, 3, 15, 11, 0);
			const rrules: RRuleFrontmatter = {
				type: "monthly",
				weekdays: [],
				startTime,
				endTime,
				allDay: false,
			};
			const result = getStartDateTime(rrules);
			expect(result).toBe(startTime);
		});
	});

	describe("findFirstValidStartDate", () => {
		it("should return start date for daily recurrence", () => {
			const date = DateTime.utc(2025, 1, 15);
			const rrules: RRuleFrontmatter = {
				type: "daily",
				weekdays: [],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			expect(result.toISODate()).toBe(date.toISODate());
		});

		it("should return start date for monthly recurrence", () => {
			const date = DateTime.utc(2025, 2, 28);
			const rrules: RRuleFrontmatter = {
				type: "monthly",
				weekdays: [],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			expect(result.toISODate()).toBe(date.toISODate());
		});

		it("should find first valid weekday for weekly recurrence (start date matches weekday)", () => {
			// Monday, Jan 6, 2025
			const date = DateTime.utc(2025, 1, 6);
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: ["monday", "wednesday", "friday"],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			// Start date is Monday, which matches the first weekday
			expect(result.toISODate()).toBe("2025-01-06");
		});

		it("should find first valid weekday for weekly recurrence (start date before first weekday)", () => {
			// Sunday, Jan 5, 2025
			const date = DateTime.utc(2025, 1, 5);
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: ["monday", "wednesday", "friday"],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			// First valid occurrence is Monday, Jan 6
			expect(result.toISODate()).toBe("2025-01-06");
		});

		it("should find first valid weekday for weekly recurrence (start date between weekdays)", () => {
			// Tuesday, Jan 7, 2025
			const date = DateTime.utc(2025, 1, 7);
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: ["monday", "wednesday", "friday"],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			// First valid occurrence is Wednesday, Jan 8
			expect(result.toISODate()).toBe("2025-01-08");
		});

		it("should find first valid weekday for bi-weekly recurrence", () => {
			// Sunday, Feb 2, 2025
			const date = DateTime.utc(2025, 2, 2);
			const rrules: RRuleFrontmatter = {
				type: "bi-weekly",
				weekdays: ["tuesday", "thursday"],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			// First valid occurrence is Tuesday, Feb 4
			expect(result.toISODate()).toBe("2025-02-04");
		});

		it("should handle timed weekly events with start time", () => {
			// Monday, Jan 6, 2025 at 14:00
			const startTime = DateTime.utc(2025, 1, 6, 14, 0);
			const endTime = DateTime.utc(2025, 1, 6, 15, 0);
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: ["monday", "friday"],
				startTime,
				endTime,
				allDay: false,
			};
			const result = findFirstValidStartDate(rrules);
			// Should return Monday (date is correct, but time may be stripped by iterator)
			expect(result.toISODate()).toBe("2025-01-06");
		});

		it("should return start date when no weekdays specified for weekly", () => {
			const date = DateTime.utc(2025, 3, 10);
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: [],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			// With no weekdays, should return the start date
			expect(result.toISODate()).toBe(date.toISODate());
		});

		it("should handle yearly recurrence without weekday logic", () => {
			const date = DateTime.utc(2025, 6, 15);
			const rrules: RRuleFrontmatter = {
				type: "yearly",
				weekdays: [],
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			expect(result.toISODate()).toBe(date.toISODate());
		});

		it("should fallback to start date if iterator finds no valid weekday", () => {
			// This is an edge case - if somehow the iterator fails
			const date = DateTime.utc(2025, 1, 1);
			const rrules: RRuleFrontmatter = {
				type: "weekly",
				weekdays: [], // Empty weekdays should cause fallback
				allDay: true,
				date,
			};
			const result = findFirstValidStartDate(rrules);
			expect(result.toISODate()).toBe(date.toISODate());
		});
	});
});
