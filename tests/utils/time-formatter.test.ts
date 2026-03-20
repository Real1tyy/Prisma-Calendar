import { describe, expect, it } from "vitest";

import { formatEventTimeInfo } from "../../src/utils/time-formatter";
import { createDefaultMetadata, createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

describe("formatEventTimeInfo", () => {
	describe("All-day events", () => {
		it("should format single-day all-day event", () => {
			const event = {
				id: "test-1",
				ref: { filePath: "test.md" },
				title: "Test Event",
				type: "allDay" as const,
				start: "2024-03-15T00:00:00",
				allDay: true as const,
				isVirtual: false,
				skipped: false,
				metadata: createDefaultMetadata(),
				meta: {},
			};
			expect(formatEventTimeInfo(event)).toBe("All Day - Mar 15, 2024");
		});

		it("should format all-day event at year boundary", () => {
			const event = createMockAllDayEvent({ start: "2023-12-31T00:00:00" });
			expect(formatEventTimeInfo(event)).toBe("All Day - Dec 31, 2023");
		});

		it("should format all-day event at start of year", () => {
			const event = createMockAllDayEvent({ start: "2024-01-01T00:00:00" });
			expect(formatEventTimeInfo(event)).toBe("All Day - Jan 1, 2024");
		});
	});

	describe("Timed events without end", () => {
		it("should format timed event in morning", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T09:30:00" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:30 AM");
		});

		it("should format timed event in afternoon", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T14:45:00" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 2:45 PM");
		});

		it("should format timed event at midnight", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T00:00:00" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 AM");
		});

		it("should format timed event at noon", () => {
			const event = createMockTimedEvent({ start: "2024-03-15T12:00:00" });
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 12:00 PM");
		});
	});

	describe("Timed events with end and duration", () => {
		it("should format 1-hour event", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00",
				end: "2024-03-15T10:00:00",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 hour)");
		});

		it("should format 30-minute event", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00",
				end: "2024-03-15T09:30:00",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (30 minutes)");
		});

		it("should format multi-hour event", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00",
				end: "2024-03-15T13:00:00",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (4 hours)");
		});
	});

	describe("Edge cases", () => {
		it("should handle leap year date", () => {
			const event = createMockTimedEvent({ start: "2024-02-29T10:00:00" });
			expect(formatEventTimeInfo(event)).toBe("Feb 29, 2024 - 10:00 AM");
		});

		it("should handle very short events (1 minute)", () => {
			const event = createMockTimedEvent({
				start: "2024-03-15T09:00:00",
				end: "2024-03-15T09:01:00",
			});
			expect(formatEventTimeInfo(event)).toBe("Mar 15, 2024 - 9:00 AM (1 minute)");
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
			const event = createMockTimedEvent({ start: `${date}T10:00:00` });
			expect(formatEventTimeInfo(event)).toContain(abbr);
		});
	});
});
