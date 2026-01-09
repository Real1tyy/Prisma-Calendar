import { describe, expect, it } from "vitest";
import {
	formatEventTimeInfo,
	formatMsToHHMMSS,
	formatMsToMMSS,
	parseAsLocalDate,
} from "../../src/utils/time-formatter";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

describe("formatMsToHHMMSS", () => {
	it("should format 0 as 00:00:00", () => {
		expect(formatMsToHHMMSS(0)).toBe("00:00:00");
	});

	it("should format seconds correctly", () => {
		expect(formatMsToHHMMSS(1000)).toBe("00:00:01");
		expect(formatMsToHHMMSS(45000)).toBe("00:00:45");
		expect(formatMsToHHMMSS(59000)).toBe("00:00:59");
	});

	it("should format minutes correctly", () => {
		expect(formatMsToHHMMSS(60000)).toBe("00:01:00");
		expect(formatMsToHHMMSS(185000)).toBe("00:03:05");
		expect(formatMsToHHMMSS(3599000)).toBe("00:59:59");
	});

	it("should format hours correctly", () => {
		expect(formatMsToHHMMSS(3600000)).toBe("01:00:00");
		expect(formatMsToHHMMSS(3723000)).toBe("01:02:03");
		expect(formatMsToHHMMSS(36000000)).toBe("10:00:00");
	});

	it("should handle large values", () => {
		expect(formatMsToHHMMSS(86400000)).toBe("24:00:00"); // 24 hours
		expect(formatMsToHHMMSS(360000000)).toBe("100:00:00"); // 100 hours
	});

	it("should pad single digits", () => {
		expect(formatMsToHHMMSS(3661000)).toBe("01:01:01");
	});

	it("should truncate milliseconds (not round)", () => {
		expect(formatMsToHHMMSS(1500)).toBe("00:00:01"); // 1.5 seconds -> 1 second
		expect(formatMsToHHMMSS(999)).toBe("00:00:00"); // < 1 second -> 0
	});
});

describe("formatMsToMMSS", () => {
	it("should format 0 as 00:00", () => {
		expect(formatMsToMMSS(0)).toBe("00:00");
	});

	it("should format seconds correctly", () => {
		expect(formatMsToMMSS(1000)).toBe("00:01");
		expect(formatMsToMMSS(30000)).toBe("00:30");
		expect(formatMsToMMSS(59000)).toBe("00:59");
	});

	it("should format minutes correctly", () => {
		expect(formatMsToMMSS(60000)).toBe("01:00");
		expect(formatMsToMMSS(125000)).toBe("02:05");
		expect(formatMsToMMSS(599000)).toBe("09:59");
	});

	it("should handle large minute values (no hour conversion)", () => {
		expect(formatMsToMMSS(3600000)).toBe("60:00"); // 60 minutes
		expect(formatMsToMMSS(7200000)).toBe("120:00"); // 120 minutes
		expect(formatMsToMMSS(36000000)).toBe("600:00"); // 600 minutes
	});

	it("should pad single digits", () => {
		expect(formatMsToMMSS(61000)).toBe("01:01");
	});

	it("should truncate milliseconds (not round)", () => {
		expect(formatMsToMMSS(1500)).toBe("00:01"); // 1.5 seconds -> 1 second
		expect(formatMsToMMSS(999)).toBe("00:00"); // < 1 second -> 0
	});
});

describe("formatEventTimeInfo", () => {
	describe("All-day events", () => {
		it("should format single-day all-day event", () => {
			const event = {
				id: "test-1",
				ref: { filePath: "test.md" },
				title: "Test Event",
				type: "allDay" as const,
				start: "2024-03-15T00:00:00.000Z",
				allDay: true as const,
				isVirtual: false,
				skipped: false,
				meta: {},
			};
			expect(formatEventTimeInfo(event)).toBe("All Day - Mar 15, 2024");
		});

		it("should format all-day event with end date (end date not shown)", () => {
			const event = {
				id: "test-1",
				ref: { filePath: "test.md" },
				title: "Test Event",
				type: "allDay" as const,
				start: "2024-03-15T00:00:00.000Z",
				allDay: true as const,
				isVirtual: false,
				skipped: false,
				meta: {},
			};
			// All-day events only show start date
			expect(formatEventTimeInfo(event)).toBe("All Day - Mar 15, 2024");
		});

		it("should format all-day event at year boundary", () => {
			const event = createMockAllDayEvent({ start: "2023-12-31T00:00:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("All Day - Dec 31, 2023");
		});

		it("should format all-day event at start of year", () => {
			const event = createMockAllDayEvent({ start: "2024-01-01T00:00:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("All Day - Jan 1, 2024");
		});
	});

	describe("Timed events without end", () => {
		it("should format timed event in morning", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T09:30:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:30 AM");
		});

		it("should format timed event in afternoon", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T14:45:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 2:45 PM");
		});

		it("should format timed event at midnight", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T00:00:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 AM");
		});

		it("should format timed event at noon", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T12:00:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 PM");
		});

		it("should format timed event with single-digit hour", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T03:05:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 3:05 AM");
		});
	});

	describe("Timed events with end and duration", () => {
		it("should format 1-hour event", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T10:00:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 hour)");
		});

		it("should format 30-minute event", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T09:30:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (30 minutes)");
		});

		it("should format 1.5-hour event", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T10:30:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 hour 30 minutes)");
		});

		it("should format multi-hour event", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T13:00:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (4 hours)");
		});

		it("should format event spanning multiple days", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T22:00:00.000Z",
				end: "2024-03-16T02:00:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 10:00 PM (4 hours)");
		});

		it("should format full-day event (24 hours)", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T00:00:00.000Z",
				end: "2024-03-16T00:00:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 AM (24 hours)");
		});

		it("should format event with mixed hours and minutes", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:15:00.000Z",
				end: "2024-03-15T11:45:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:15 AM (2 hours 30 minutes)");
		});
	});

	describe("Edge cases", () => {
		it("should handle leap year date", () => {
			const event = createMockTimedEvent({ start: "2024-02-29T10:00:00.000Z" });
			expect(formatEventTimeInfo(event)).toBe("Feb 29, 2024 - 10:00 AM");
		});

		it("should handle very short events (1 minute)", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00.000Z",
				end: "2024-03-15T09:01:00.000Z",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 minute)");
		});

		it("should handle events with seconds precision", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T09:30:45.123Z" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:30 AM");
		});

		it("should handle different year boundaries", () => {
			const event = createMockTimedEvent({
				start: "2023-12-31T23:00:00.000Z",
				end: "2024-01-01T01:00:00.000Z",
			});
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
			const event = createMockTimedEvent({
				start: `${date}T10:00:00.000Z`,
			});
			expect(formatEventTimeInfo(event)).toContain(abbr);
		});
	});
});

describe("parseAsLocalDate", () => {
	describe("Timezone stripping", () => {
		it("should strip Z timezone indicator", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00Z");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15); // Should be 15 in local time, not converted
		});

		it("should strip positive timezone offset with colon (+HH:MM)", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00+01:00");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15); // Should be 15 in local time
		});

		it("should strip negative timezone offset with colon (-HH:MM)", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00-05:00");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15); // Should be 15 in local time
		});

		it("should strip positive timezone offset without colon (+HHMM)", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00+0100");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15); // Should be 15 in local time
		});

		it("should strip negative timezone offset without colon (-HHMM)", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00-0500");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15); // Should be 15 in local time
		});

		it("should handle lowercase z", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00z");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});
	});

	describe("Date formats", () => {
		it("should parse full ISO datetime with seconds", () => {
			const result = parseAsLocalDate("2024-01-15T15:30:45Z");
			expect(result).not.toBeNull();
			expect(result?.getFullYear()).toBe(2024);
			expect(result?.getMonth()).toBe(0); // January (0-indexed)
			expect(result?.getDate()).toBe(15);
			expect(result?.getHours()).toBe(15);
			expect(result?.getMinutes()).toBe(30);
			expect(result?.getSeconds()).toBe(45);
		});

		it("should parse ISO datetime without seconds", () => {
			const result = parseAsLocalDate("2024-01-15T15:30Z");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
			expect(result?.getMinutes()).toBe(30);
		});

		it("should parse date-only format", () => {
			const result = parseAsLocalDate("2024-01-15");
			expect(result).not.toBeNull();
			expect(result?.getFullYear()).toBe(2024);
			expect(result?.getMonth()).toBe(0);
			expect(result?.getDate()).toBe(15);
		});

		it("should parse datetime without timezone", () => {
			const result = parseAsLocalDate("2024-01-15T15:00:00");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});
	});

	describe("Edge cases", () => {
		it("should handle dates at midnight", () => {
			const result = parseAsLocalDate("2024-01-15T00:00:00Z");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(0);
		});

		it("should handle dates at end of day", () => {
			const result = parseAsLocalDate("2024-01-15T23:59:59Z");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(23);
			expect(result?.getMinutes()).toBe(59);
		});

		it("should handle whitespace in date string", () => {
			const result = parseAsLocalDate("  2024-01-15T15:00:00Z  ");
			expect(result).not.toBeNull();
			expect(result?.getHours()).toBe(15);
		});

		it("should handle leap year dates", () => {
			const result = parseAsLocalDate("2024-02-29T12:00:00Z");
			expect(result).not.toBeNull();
			expect(result?.getMonth()).toBe(1); // February
			expect(result?.getDate()).toBe(29);
		});

		it("should handle dates across different months", () => {
			const dates = ["2024-01-15T10:00:00Z", "2024-06-15T10:00:00Z", "2024-12-15T10:00:00Z"];

			for (const dateStr of dates) {
				const result = parseAsLocalDate(dateStr);
				expect(result).not.toBeNull();
				expect(result?.getHours()).toBe(10);
			}
		});
	});

	describe("Invalid inputs", () => {
		it("should return null for invalid date string", () => {
			const result = parseAsLocalDate("invalid-date");
			expect(result).toBeNull();
		});

		it("should return null for empty string", () => {
			const result = parseAsLocalDate("");
			expect(result).toBeNull();
		});

		it("should return null for completely invalid format", () => {
			const result = parseAsLocalDate("not a date at all");
			expect(result).toBeNull();
		});

		it("should return null for invalid date values", () => {
			const result = parseAsLocalDate("2024-13-45T25:99:99Z"); // Invalid month, day, hour, minute
			expect(result).toBeNull();
		});
	});

	describe("Consistency", () => {
		it("should produce same local time regardless of timezone in input", () => {
			const utcDate = parseAsLocalDate("2024-01-15T15:00:00Z");
			const plusOneDate = parseAsLocalDate("2024-01-15T15:00:00+01:00");
			const minusFiveDate = parseAsLocalDate("2024-01-15T15:00:00-05:00");
			const noTzDate = parseAsLocalDate("2024-01-15T15:00:00");

			// All should have 15:00 in local time
			expect(utcDate?.getHours()).toBe(15);
			expect(plusOneDate?.getHours()).toBe(15);
			expect(minusFiveDate?.getHours()).toBe(15);
			expect(noTzDate?.getHours()).toBe(15);
		});
	});
});
