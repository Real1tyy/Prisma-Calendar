import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import {
	applySourceTimeToInstanceDate,
	calculateDuration,
	calculateDurationMinutes,
	calculateEndTime,
	ensureISOSuffix,
	formatDurationHumanReadable,
	formatMsToHHMMSS,
	formatMsToMMSS,
	getISODatePart,
	getISOTimePart,
	getNotePreviewLines,
	intoDate,
	minsToTimeStr,
	parseAsLocalDate,
	parseTimeToMins,
	replaceISOTime,
	roundToNearestHour,
	toLocalISOString,
	toSafeString,
} from "../../src/utils/date/date";

// ─── toSafeString ────────────────────────────────────────────

describe("toSafeString", () => {
	it("returns string for string input", () => {
		expect(toSafeString("hello")).toBe("hello");
	});

	it("returns string for number input", () => {
		expect(toSafeString(42)).toBe("42");
		expect(toSafeString(0)).toBe("0");
		expect(toSafeString(-3.14)).toBe("-3.14");
	});

	it("returns string for boolean input", () => {
		expect(toSafeString(true)).toBe("true");
		expect(toSafeString(false)).toBe("false");
	});

	it("returns null for null and undefined", () => {
		expect(toSafeString(null)).toBeNull();
		expect(toSafeString(undefined)).toBeNull();
	});

	it("returns null for objects and arrays", () => {
		expect(toSafeString({})).toBeNull();
		expect(toSafeString([])).toBeNull();
		expect(toSafeString({ key: "val" })).toBeNull();
	});

	it("returns empty string for empty string input", () => {
		expect(toSafeString("")).toBe("");
	});

	it("returns null for functions and symbols", () => {
		expect(toSafeString(() => {})).toBeNull();
		expect(toSafeString(Symbol("test"))).toBeNull();
	});
});

// ─── intoDate ────────────────────────────────────────────────

describe("intoDate", () => {
	it("returns Date for valid ISO string", () => {
		const result = intoDate("2026-03-15T14:30:00");
		expect(result).toBeInstanceOf(Date);
		expect(result!.getFullYear()).toBe(2026);
	});

	it("returns the same Date object for Date input", () => {
		const date = new Date("2026-01-01");
		expect(intoDate(date)).toBe(date);
	});

	it("returns null for null and undefined", () => {
		expect(intoDate(null)).toBeNull();
		expect(intoDate(undefined)).toBeNull();
	});

	it("returns null for invalid date string", () => {
		expect(intoDate("not-a-date")).toBeNull();
		expect(intoDate("")).toBeNull();
	});

	it("returns null for non-string, non-Date inputs", () => {
		expect(intoDate(42)).toBeNull();
		expect(intoDate({})).toBeNull();
		expect(intoDate(true)).toBeNull();
	});

	it("returns null for invalid Date object", () => {
		expect(intoDate(new Date("invalid"))).toBeNull();
	});
});

// ─── ensureISOSuffix ─────────────────────────────────────────

describe("ensureISOSuffix", () => {
	it("returns date-only strings unchanged", () => {
		expect(ensureISOSuffix("2026-03-15")).toBe("2026-03-15");
	});

	it("returns already-complete ISO strings unchanged", () => {
		expect(ensureISOSuffix("2026-03-15T14:30:00.000Z")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("adds seconds and ms suffix to HH:mm format", () => {
		expect(ensureISOSuffix("2026-03-15T14:30")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("adds ms suffix to HH:mm:ss format", () => {
		expect(ensureISOSuffix("2026-03-15T14:30:00")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("replaces existing Z suffix with .000Z", () => {
		expect(ensureISOSuffix("2026-03-15T14:30:00Z")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("replaces existing ms with .000Z", () => {
		expect(ensureISOSuffix("2026-03-15T14:30:00.123Z")).toBe("2026-03-15T14:30:00.000Z");
	});

	it("handles midnight correctly", () => {
		expect(ensureISOSuffix("2026-01-01T00:00")).toBe("2026-01-01T00:00:00.000Z");
	});
});

// ─── toLocalISOString ────────────────────────────────────────

describe("toLocalISOString", () => {
	it("formats a date in internal ISO format (no Z)", () => {
		const date = new Date(2026, 2, 15, 14, 30, 0, 0);
		const result = toLocalISOString(date);
		expect(result).toBe("2026-03-15T14:30:00");
	});

	it("pads single-digit components", () => {
		const date = new Date(2026, 0, 5, 9, 5, 3, 7);
		const result = toLocalISOString(date);
		expect(result).toBe("2026-01-05T09:05:03");
	});

	it("handles midnight", () => {
		const date = new Date(2026, 0, 1, 0, 0, 0, 0);
		const result = toLocalISOString(date);
		expect(result).toBe("2026-01-01T00:00:00");
	});

	it("handles end of day", () => {
		const date = new Date(2026, 11, 31, 23, 59, 59, 999);
		const result = toLocalISOString(date);
		expect(result).toBe("2026-12-31T23:59:59");
	});
});

// ─── getISODatePart / getISOTimePart / replaceISOTime ────────

describe("getISODatePart", () => {
	it("extracts date portion from ISO string", () => {
		expect(getISODatePart("2026-03-15T14:30:00.000Z")).toBe("2026-03-15");
	});

	it("returns full string when no T separator", () => {
		expect(getISODatePart("2026-03-15")).toBe("2026-03-15");
	});
});

describe("getISOTimePart", () => {
	it("extracts time portion including T from ISO string", () => {
		expect(getISOTimePart("2026-03-15T14:30:00.000Z")).toBe("T14:30:00.000Z");
	});

	it("returns empty string when no T separator", () => {
		expect(getISOTimePart("2026-03-15")).toBe("");
	});
});

describe("replaceISOTime", () => {
	it("replaces time portion of ISO string", () => {
		expect(replaceISOTime("2026-03-15T14:30:00.000Z", "T09:00:00.000Z")).toBe("2026-03-15T09:00:00.000Z");
	});

	it("adds time to date-only string", () => {
		expect(replaceISOTime("2026-03-15", "T12:00:00.000Z")).toBe("2026-03-15T12:00:00.000Z");
	});
});

// ─── parseTimeToMins / minsToTimeStr ─────────────────────────

describe("parseTimeToMins", () => {
	it("parses midnight as 0 minutes", () => {
		expect(parseTimeToMins("2026-03-15T00:00:00.000Z")).toBe(0);
	});

	it("parses afternoon time correctly", () => {
		expect(parseTimeToMins("2026-03-15T14:30:00.000Z")).toBe(870);
	});

	it("parses end of day", () => {
		expect(parseTimeToMins("2026-03-15T23:59:00.000Z")).toBe(1439);
	});

	it("parses morning time", () => {
		expect(parseTimeToMins("2026-03-15T09:15:00.000Z")).toBe(555);
	});
});

describe("minsToTimeStr", () => {
	it("converts 0 minutes to 00:00", () => {
		expect(minsToTimeStr(0)).toBe("00:00");
	});

	it("converts minutes to padded HH:MM", () => {
		expect(minsToTimeStr(65)).toBe("01:05");
		expect(minsToTimeStr(870)).toBe("14:30");
	});

	it("handles large values", () => {
		expect(minsToTimeStr(1439)).toBe("23:59");
	});

	it("round-trips with parseTimeToMins", () => {
		const iso = "2026-03-15T14:30:00.000Z";
		const mins = parseTimeToMins(iso);
		expect(minsToTimeStr(mins)).toBe("14:30");
	});
});

// ─── calculateDuration ───────────────────────────────────────

describe("calculateDuration", () => {
	it("returns minutes only for sub-hour durations", () => {
		const start = new Date("2026-03-15T14:00:00");
		const end = new Date("2026-03-15T14:45:00");
		expect(calculateDuration(start, end)).toBe("45m");
	});

	it("returns hours only for exact hour durations", () => {
		const start = new Date("2026-03-15T14:00:00");
		const end = new Date("2026-03-15T16:00:00");
		expect(calculateDuration(start, end)).toBe("2h");
	});

	it("returns hours and minutes for mixed durations", () => {
		const start = new Date("2026-03-15T14:00:00");
		const end = new Date("2026-03-15T15:30:00");
		expect(calculateDuration(start, end)).toBe("1h 30m");
	});

	it("returns 0m for identical times", () => {
		const date = new Date("2026-03-15T14:00:00");
		expect(calculateDuration(date, date)).toBe("0m");
	});
});

// ─── calculateDurationMinutes ────────────────────────────────

describe("calculateDurationMinutes", () => {
	it("calculates minutes between two date strings", () => {
		expect(calculateDurationMinutes("2026-03-15T14:00:00", "2026-03-15T15:30:00")).toBe(90);
	});

	it("calculates minutes between Date objects", () => {
		const start = new Date("2026-03-15T14:00:00");
		const end = new Date("2026-03-15T14:45:00");
		expect(calculateDurationMinutes(start, end)).toBe(45);
	});

	it("returns 0 for invalid inputs", () => {
		expect(calculateDurationMinutes("invalid", "2026-03-15T14:00:00")).toBe(0);
		expect(calculateDurationMinutes("2026-03-15T14:00:00", "invalid")).toBe(0);
	});

	it("returns 0 for identical times", () => {
		expect(calculateDurationMinutes("2026-03-15T14:00:00", "2026-03-15T14:00:00")).toBe(0);
	});

	it("returns negative for reversed times", () => {
		expect(calculateDurationMinutes("2026-03-15T15:00:00", "2026-03-15T14:00:00")).toBe(-60);
	});
});

// ─── formatDurationHumanReadable ─────────────────────────────

describe("formatDurationHumanReadable", () => {
	it("returns singular minute", () => {
		const start = DateTime.fromISO("2026-03-15T14:00:00");
		const end = DateTime.fromISO("2026-03-15T14:01:00");
		expect(formatDurationHumanReadable(start, end)).toBe("1 minute");
	});

	it("returns plural minutes", () => {
		const start = DateTime.fromISO("2026-03-15T14:00:00");
		const end = DateTime.fromISO("2026-03-15T14:45:00");
		expect(formatDurationHumanReadable(start, end)).toBe("45 minutes");
	});

	it("returns singular hour", () => {
		const start = DateTime.fromISO("2026-03-15T14:00:00");
		const end = DateTime.fromISO("2026-03-15T15:00:00");
		expect(formatDurationHumanReadable(start, end)).toBe("1 hour");
	});

	it("returns plural hours", () => {
		const start = DateTime.fromISO("2026-03-15T14:00:00");
		const end = DateTime.fromISO("2026-03-15T17:00:00");
		expect(formatDurationHumanReadable(start, end)).toBe("3 hours");
	});

	it("returns hours and minutes combined with correct pluralization", () => {
		const start = DateTime.fromISO("2026-03-15T14:00:00");
		const end = DateTime.fromISO("2026-03-15T15:01:00");
		expect(formatDurationHumanReadable(start, end)).toBe("1 hour 1 minute");
	});

	it("returns plural hours and plural minutes", () => {
		const start = DateTime.fromISO("2026-03-15T14:00:00");
		const end = DateTime.fromISO("2026-03-15T16:30:00");
		expect(formatDurationHumanReadable(start, end)).toBe("2 hours 30 minutes");
	});

	it("returns 0 minutes for identical times", () => {
		const dt = DateTime.fromISO("2026-03-15T14:00:00");
		expect(formatDurationHumanReadable(dt, dt)).toBe("0 minutes");
	});
});

// ─── roundToNearestHour ──────────────────────────────────────

describe("roundToNearestHour", () => {
	it("rounds down when minutes < 30", () => {
		const date = new Date(2026, 2, 15, 14, 15, 30, 500);
		const result = roundToNearestHour(date);
		expect(result.getHours()).toBe(14);
		expect(result.getMinutes()).toBe(0);
		expect(result.getSeconds()).toBe(0);
		expect(result.getMilliseconds()).toBe(0);
	});

	it("rounds up when minutes >= 30", () => {
		const date = new Date(2026, 2, 15, 14, 30, 0, 0);
		const result = roundToNearestHour(date);
		expect(result.getHours()).toBe(15);
		expect(result.getMinutes()).toBe(0);
	});

	it("keeps exact hour unchanged", () => {
		const date = new Date(2026, 2, 15, 14, 0, 0, 0);
		const result = roundToNearestHour(date);
		expect(result.getHours()).toBe(14);
		expect(result.getMinutes()).toBe(0);
	});

	it("does not mutate the original date", () => {
		const date = new Date(2026, 2, 15, 14, 45, 0, 0);
		const original = date.getTime();
		roundToNearestHour(date);
		expect(date.getTime()).toBe(original);
	});

	it("rounds up at minute 30 boundary", () => {
		const date = new Date(2026, 2, 15, 23, 30, 0, 0);
		const result = roundToNearestHour(date);
		expect(result.getDate()).toBe(16);
		expect(result.getHours()).toBe(0);
	});
});

// ─── calculateEndTime ────────────────────────────────────────

describe("calculateEndTime", () => {
	it("adds minutes to a time string", () => {
		expect(calculateEndTime("09:00:00.000Z", 60)).toBe("10:00:00.000Z");
	});

	it("handles sub-hour durations", () => {
		expect(calculateEndTime("14:30:00.000Z", 15)).toBe("14:45:00.000Z");
	});

	it("handles crossing hour boundaries", () => {
		expect(calculateEndTime("14:45:00.000Z", 30)).toBe("15:15:00.000Z");
	});

	it("handles 0 duration", () => {
		expect(calculateEndTime("14:30:00.000Z", 0)).toBe("14:30:00.000Z");
	});
});

// ─── applySourceTimeToInstanceDate ───────────────────────────

describe("applySourceTimeToInstanceDate", () => {
	it("applies time from source to instance date", () => {
		const instance = DateTime.fromISO("2026-03-20T00:00:00");
		const source = DateTime.fromISO("2026-01-01T14:30:45.123");
		const result = applySourceTimeToInstanceDate(instance, source);
		expect(result.year).toBe(2026);
		expect(result.month).toBe(3);
		expect(result.day).toBe(20);
		expect(result.hour).toBe(14);
		expect(result.minute).toBe(30);
		expect(result.second).toBe(45);
		expect(result.millisecond).toBe(123);
	});

	it("preserves instance date components", () => {
		const instance = DateTime.fromISO("2025-06-15T08:00:00");
		const source = DateTime.fromISO("2026-12-25T23:59:59");
		const result = applySourceTimeToInstanceDate(instance, source);
		expect(result.year).toBe(2025);
		expect(result.month).toBe(6);
		expect(result.day).toBe(15);
		expect(result.hour).toBe(23);
		expect(result.minute).toBe(59);
	});
});

// ─── formatMsToHHMMSS / formatMsToMMSS ──────────────────────

describe("formatMsToHHMMSS", () => {
	it("formats 0ms as 00:00:00", () => {
		expect(formatMsToHHMMSS(0)).toBe("00:00:00");
	});

	it("formats seconds correctly", () => {
		expect(formatMsToHHMMSS(5000)).toBe("00:00:05");
	});

	it("formats minutes and seconds", () => {
		expect(formatMsToHHMMSS(65000)).toBe("00:01:05");
	});

	it("formats hours, minutes, and seconds", () => {
		expect(formatMsToHHMMSS(3661000)).toBe("01:01:01");
	});

	it("handles large durations", () => {
		expect(formatMsToHHMMSS(36000000)).toBe("10:00:00");
	});

	it("truncates sub-second values", () => {
		expect(formatMsToHHMMSS(1500)).toBe("00:00:01");
	});
});

describe("formatMsToMMSS", () => {
	it("formats 0ms as 00:00", () => {
		expect(formatMsToMMSS(0)).toBe("00:00");
	});

	it("formats seconds only", () => {
		expect(formatMsToMMSS(30000)).toBe("00:30");
	});

	it("formats minutes and seconds", () => {
		expect(formatMsToMMSS(90000)).toBe("01:30");
	});

	it("rolls hours into minutes", () => {
		expect(formatMsToMMSS(3661000)).toBe("61:01");
	});
});

// ─── parseAsLocalDate ────────────────────────────────────────

describe("parseAsLocalDate", () => {
	it("parses a plain date string", () => {
		const result = parseAsLocalDate("2026-03-15");
		expect(result).toBeInstanceOf(Date);
		expect(result!.getFullYear()).toBe(2026);
		expect(result!.getMonth()).toBe(2);
		expect(result!.getDate()).toBe(15);
	});

	it("strips timezone offset before parsing", () => {
		const result = parseAsLocalDate("2026-03-15T14:30:00+05:00");
		expect(result).toBeInstanceOf(Date);
	});

	it("strips Z suffix before parsing", () => {
		const result = parseAsLocalDate("2026-03-15T14:30:00Z");
		expect(result).toBeInstanceOf(Date);
	});

	it("returns null for invalid date", () => {
		expect(parseAsLocalDate("not-a-date")).toBeNull();
	});

	it("returns null for empty string", () => {
		expect(parseAsLocalDate("")).toBeNull();
	});

	it("strips negative timezone offset", () => {
		const result = parseAsLocalDate("2026-03-15T14:30:00-07:00");
		expect(result).toBeInstanceOf(Date);
	});
});

// ─── getNotePreviewLines ─────────────────────────────────────

describe("getNotePreviewLines", () => {
	it("returns first N non-empty lines", () => {
		const content = "Line 1\nLine 2\nLine 3\nLine 4";
		expect(getNotePreviewLines(content, 2)).toBe("Line 1\nLine 2");
	});

	it("skips empty lines", () => {
		const content = "Line 1\n\n\nLine 2\n\nLine 3";
		expect(getNotePreviewLines(content, 2)).toBe("Line 1\nLine 2");
	});

	it("skips whitespace-only lines", () => {
		const content = "Line 1\n   \n  \t  \nLine 2";
		expect(getNotePreviewLines(content, 2)).toBe("Line 1\nLine 2");
	});

	it("returns all lines when fewer than requested", () => {
		const content = "Line 1\nLine 2";
		expect(getNotePreviewLines(content, 5)).toBe("Line 1\nLine 2");
	});

	it("returns empty string for empty content", () => {
		expect(getNotePreviewLines("", 3)).toBe("");
	});

	it("returns empty string for whitespace-only content", () => {
		expect(getNotePreviewLines("  \n  \n  ", 3)).toBe("");
	});

	it("trims lines in output", () => {
		const content = "  Line 1  \n  Line 2  ";
		expect(getNotePreviewLines(content, 2)).toBe("Line 1\nLine 2");
	});

	it("returns zero lines when lineCount is 0", () => {
		expect(getNotePreviewLines("Line 1\nLine 2", 0)).toBe("");
	});
});
