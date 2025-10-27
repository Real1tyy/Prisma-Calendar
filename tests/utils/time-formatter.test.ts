import { describe, expect, it } from "vitest";
import { formatEventTimeInfo } from "../../src/utils/time-formatter";

describe("formatEventTimeInfo", () => {
	describe("All-day events", () => {
		it("should format single-day all-day event", () => {
			const event = {
				start: "2024-03-15T00:00:00.000Z",
				allDay: true,
			};
			expect(formatEventTimeInfo(event)).toBe("All Day - Mar 15, 2024");
		});

		it("should format all-day event with end date (end date not shown)", () => {
			const event = {
				start: "2024-03-15T00:00:00.000Z",
				end: "2024-03-16T00:00:00.000Z",
				allDay: true,
			};
			// All-day events only show start date
			expect(formatEventTimeInfo(event)).toBe("All Day - Mar 15, 2024");
		});

		it("should format all-day event at year boundary", () => {
			const event = {
				start: "2023-12-31T00:00:00.000Z",
				allDay: true,
			};
			expect(formatEventTimeInfo(event)).toBe("All Day - Dec 31, 2023");
		});

		it("should format all-day event at start of year", () => {
			const event = {
				start: "2024-01-01T00:00:00.000Z",
				allDay: true,
			};
			expect(formatEventTimeInfo(event)).toBe("All Day - Jan 1, 2024");
		});
	});

	describe("Timed events without end", () => {
		it("should format timed event in morning", () => {
			const event = {
				start: "2024-03-15T09:30:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:30 AM");
		});

		it("should format timed event in afternoon", () => {
			const event = {
				start: "2024-03-15T14:45:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 2:45 PM");
		});

		it("should format timed event at midnight", () => {
			const event = {
				start: "2024-03-15T00:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 AM");
		});

		it("should format timed event at noon", () => {
			const event = {
				start: "2024-03-15T12:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 PM");
		});

		it("should format timed event with single-digit hour", () => {
			const event = {
				start: "2024-03-15T03:05:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 3:05 AM");
		});
	});

	describe("Timed events with end and duration", () => {
		it("should format 1-hour event", () => {
			const event = {
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T10:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 hour)");
		});

		it("should format 30-minute event", () => {
			const event = {
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T09:30:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (30 minutes)");
		});

		it("should format 1.5-hour event", () => {
			const event = {
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T10:30:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 hour 30 minutes)");
		});

		it("should format multi-hour event", () => {
			const event = {
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T13:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (4 hours)");
		});

		it("should format event spanning multiple days", () => {
			const event = {
				start: "2024-03-15T22:00:00.000Z",
				end: "2024-03-16T02:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 10:00 PM (4 hours)");
		});

		it("should format full-day event (24 hours)", () => {
			const event = {
				start: "2024-03-15T00:00:00.000Z",
				end: "2024-03-16T00:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 AM (24 hours)");
		});

		it("should format event with mixed hours and minutes", () => {
			const event = {
				start: "2024-03-15T09:15:00.000Z",
				end: "2024-03-15T11:45:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:15 AM (2 hours 30 minutes)");
		});
	});

	describe("Edge cases", () => {
		it("should handle leap year date", () => {
			const event = {
				start: "2024-02-29T10:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Feb 29, 2024 - 10:00 AM");
		});

		it("should handle very short events (1 minute)", () => {
			const event = {
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T09:01:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 minute)");
		});

		it("should handle events with seconds precision", () => {
			const event = {
				start: "2024-03-15T09:30:45.123Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:30 AM");
		});

		it("should handle different year boundaries", () => {
			const event = {
				start: "2023-12-31T23:00:00.000Z",
				end: "2024-01-01T01:00:00.000Z",
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toBe("Dec 31, 2023 - 11:00 PM (2 hours)");
		});
	});

	describe("Month abbreviations", () => {
		const months = [
			{ date: "2024-01-15", abbr: "Jan" },
			{ date: "2024-02-15", abbr: "Feb" },
			{ date: "2024-03-15", abbr: "Mar" },
			{ date: "2024-04-15", abbr: "Apr" },
			{ date: "2024-05-15", abbr: "May" },
			{ date: "2024-06-15", abbr: "Jun" },
			{ date: "2024-07-15", abbr: "Jul" },
			{ date: "2024-08-15", abbr: "Aug" },
			{ date: "2024-09-15", abbr: "Sep" },
			{ date: "2024-10-15", abbr: "Oct" },
			{ date: "2024-11-15", abbr: "Nov" },
			{ date: "2024-12-15", abbr: "Dec" },
		];

		it.each(months)("should correctly format $abbr as month abbreviation", ({ date, abbr }) => {
			const event = {
				start: `${date}T10:00:00.000Z`,
				allDay: false,
			};
			expect(formatEventTimeInfo(event)).toContain(abbr);
		});
	});
});
