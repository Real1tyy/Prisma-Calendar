import { describe, expect, it } from "vitest";

import {
	calculateEndTime,
	ensureISOSuffix,
	formatDateForInput,
	formatDateTimeForInput,
	formatDuration,
	formatMsToHHMMSS,
	formatMsToMMSS,
	inputValueToISOString,
	minsToTimeStr,
	parseDateTimeString,
	parseTimeString,
	parseTimeToMins,
} from "../../src/utils/date/date";

describe("formatDateTimeForInput", () => {
	it("formats a valid ISO date string to datetime-local format", () => {
		const result = formatDateTimeForInput("2026-03-15T14:30:00");
		expect(result).toBe("2026-03-15T14:30");
	});

	it("formats midnight correctly", () => {
		const result = formatDateTimeForInput("2026-01-01T00:00:00");
		expect(result).toBe("2026-01-01T00:00");
	});

	it("returns empty string for empty input", () => {
		expect(formatDateTimeForInput("")).toBe("");
	});

	it("pads single-digit months and days", () => {
		const result = formatDateTimeForInput("2026-03-05T09:05:00");
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
		expect(result).toContain("T09:05");
	});
});

describe("formatDateForInput", () => {
	it("formats a valid ISO date string to date input format", () => {
		const result = formatDateForInput("2026-03-15T14:30:00");
		expect(result).toBe("2026-03-15");
	});

	it("returns empty string for empty input", () => {
		expect(formatDateForInput("")).toBe("");
	});

	it("pads single-digit months and days", () => {
		const result = formatDateForInput("2026-01-05");
		expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
	});
});

describe("inputValueToISOString", () => {
	it("converts a datetime-local value to ISO string", () => {
		const result = inputValueToISOString("2026-03-15T14:30");
		expect(result).not.toBeNull();
		expect(result).toContain("2026-03-15");
	});

	it("returns null for invalid date input", () => {
		expect(inputValueToISOString("not-a-date")).toBeNull();
	});

	it("converts a date-only string to ISO string", () => {
		const result = inputValueToISOString("2026-03-15");
		expect(result).not.toBeNull();
		expect(result).toContain("2026-03-15");
	});
});

describe("formatDuration", () => {
	it("formats zero minutes", () => {
		expect(formatDuration(0)).toBe("00:00:00");
	});

	it("formats minutes less than an hour", () => {
		expect(formatDuration(45)).toBe("00:45:00");
	});

	it("formats exactly one hour", () => {
		expect(formatDuration(60)).toBe("01:00:00");
	});

	it("formats hours and minutes", () => {
		expect(formatDuration(90)).toBe("01:30:00");
	});

	it("formats large durations", () => {
		expect(formatDuration(600)).toBe("10:00:00");
	});

	it("pads single-digit hours and minutes", () => {
		expect(formatDuration(65)).toBe("01:05:00");
	});
});

describe("parseTimeString", () => {
	it("returns undefined for null input", () => {
		expect(parseTimeString(null)).toBeUndefined();
	});

	it("rejects plain HH:mm format", () => {
		expect(parseTimeString("14:30")).toBeUndefined();
	});

	it("parses ISO datetime string", () => {
		const result = parseTimeString("2026-03-15T14:30:00");
		expect(result).toBeDefined();
		expect(result!.hour).toBe(14);
		expect(result!.minute).toBe(30);
	});

	it("parses ISO datetime with T separator", () => {
		const result = parseTimeString("2026-03-15T09:05");
		expect(result).toBeDefined();
		expect(result!.hour).toBe(9);
		expect(result!.minute).toBe(5);
	});

	it("parses SQL format datetime", () => {
		const result = parseTimeString("2026-03-15 14:30:00");
		expect(result).toBeDefined();
		expect(result!.hour).toBe(14);
	});

	it("returns undefined for malformed input", () => {
		expect(parseTimeString("not-a-time")).toBeUndefined();
	});

	it("handles whitespace around valid input", () => {
		const result = parseTimeString("  2026-03-15T14:30:00  ");
		expect(result).toBeDefined();
		expect(result!.hour).toBe(14);
	});
});

describe("parseDateTimeString", () => {
	it("returns undefined for null input", () => {
		expect(parseDateTimeString(null)).toBeUndefined();
	});

	it("returns undefined for empty string", () => {
		expect(parseDateTimeString("")).toBeUndefined();
	});

	it("returns undefined for whitespace-only string", () => {
		expect(parseDateTimeString("   ")).toBeUndefined();
	});

	it("parses ISO datetime string", () => {
		const result = parseDateTimeString("2026-03-15T14:30:00");
		expect(result).toBeDefined();
		expect(result!.year).toBe(2026);
		expect(result!.month).toBe(3);
		expect(result!.day).toBe(15);
		expect(result!.hour).toBe(14);
		expect(result!.minute).toBe(30);
	});

	it("parses SQL format datetime", () => {
		const result = parseDateTimeString("2026-03-15 14:30:00");
		expect(result).toBeDefined();
		expect(result!.year).toBe(2026);
		expect(result!.hour).toBe(14);
	});

	it("parses date-only string as start of day", () => {
		const result = parseDateTimeString("2026-03-15");
		expect(result).toBeDefined();
		expect(result!.year).toBe(2026);
		expect(result!.month).toBe(3);
		expect(result!.day).toBe(15);
	});

	it("returns undefined for malformed input", () => {
		expect(parseDateTimeString("garbage")).toBeUndefined();
	});

	it("handles whitespace around valid input", () => {
		const result = parseDateTimeString("  2026-03-15T10:00  ");
		expect(result).toBeDefined();
		expect(result!.hour).toBe(10);
	});

	it("parses midnight datetime", () => {
		const result = parseDateTimeString("2026-01-01T00:00:00");
		expect(result).toBeDefined();
		expect(result!.hour).toBe(0);
		expect(result!.minute).toBe(0);
	});
});

describe("calculateEndTime", () => {
	it("wraps hours past midnight", () => {
		expect(calculateEndTime("23:00:00.000Z", 120)).toBe("01:00:00.000Z");
	});

	it("wraps exactly at midnight", () => {
		expect(calculateEndTime("23:00:00.000Z", 60)).toBe("00:00:00.000Z");
	});

	it("handles normal case without wrapping", () => {
		expect(calculateEndTime("10:00:00.000Z", 90)).toBe("11:30:00.000Z");
	});
});

describe("parseTimeToMins", () => {
	it("returns NaN for date-only strings without time component", () => {
		expect(parseTimeToMins("2026-03-15")).toBeNaN();
	});

	it("extracts time from standard ISO datetime", () => {
		expect(parseTimeToMins("2026-03-15T14:30:00")).toBe(870);
	});

	it("extracts time from ISO datetime with Z suffix", () => {
		expect(parseTimeToMins("2026-03-15T14:30:00.000Z")).toBe(870);
	});

	it("extracts midnight as zero minutes", () => {
		expect(parseTimeToMins("2026-03-15T00:00:00")).toBe(0);
	});

	it("extracts end of day", () => {
		expect(parseTimeToMins("2026-03-15T23:59:00")).toBe(1439);
	});
});

describe("ensureISOSuffix", () => {
	it("strips timezone offset and normalizes format", () => {
		expect(ensureISOSuffix("2026-03-15T14:30:00+05:00")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("strips negative timezone offset", () => {
		expect(ensureISOSuffix("2026-03-15T14:30:00-03:00")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("handles Z suffix correctly", () => {
		expect(ensureISOSuffix("2026-03-15T14:30:00.000Z")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("adds suffix to datetime without seconds", () => {
		expect(ensureISOSuffix("2026-03-15T14:30")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("returns non-datetime strings unchanged", () => {
		expect(ensureISOSuffix("2026-03-15")).toBe("2026-03-15");
	});
});

describe("negative input handling", () => {
	it("formatDuration handles negative minutes", () => {
		const result = formatDuration(-90);
		expect(result).not.toContain("NaN");
	});

	it("minsToTimeStr handles negative minutes", () => {
		const result = minsToTimeStr(-30);
		expect(result).not.toContain("NaN");
	});

	it("formatMsToHHMMSS handles negative ms", () => {
		const result = formatMsToHHMMSS(-5000);
		expect(result).not.toContain("NaN");
	});

	it("formatMsToMMSS handles negative ms", () => {
		const result = formatMsToMMSS(-5000);
		expect(result).not.toContain("NaN");
	});
});
