import { describe, expect, it } from "vitest";

import {
	ensureISOSuffix,
	getISODatePart,
	getISOTimePart,
	minsToTimeStr,
	parseTimeToMins,
	replaceISOTime,
} from "../../src/utils/date/date";

describe("parseTimeToMins", () => {
	it("should parse midnight as 0", () => {
		expect(parseTimeToMins("2025-03-15T00:00:00")).toBe(0);
	});

	it("should parse morning time", () => {
		expect(parseTimeToMins("2025-03-15T09:30:00")).toBe(570);
	});

	it("should parse afternoon time", () => {
		expect(parseTimeToMins("2025-03-15T14:45:00")).toBe(885);
	});

	it("should parse end of day", () => {
		expect(parseTimeToMins("2025-03-15T23:59:00")).toBe(1439);
	});

	it("should handle ISO strings with .000Z suffix", () => {
		expect(parseTimeToMins("2025-03-15T08:15:00.000Z")).toBe(495);
	});
});

describe("minsToTimeStr", () => {
	it("should format 0 as 00:00", () => {
		expect(minsToTimeStr(0)).toBe("00:00");
	});

	it("should format morning time", () => {
		expect(minsToTimeStr(570)).toBe("09:30");
	});

	it("should format afternoon time", () => {
		expect(minsToTimeStr(885)).toBe("14:45");
	});

	it("should format end of day", () => {
		expect(minsToTimeStr(1439)).toBe("23:59");
	});

	it("should pad single-digit hours and minutes", () => {
		expect(minsToTimeStr(65)).toBe("01:05");
	});

	it("should handle exact hours", () => {
		expect(minsToTimeStr(720)).toBe("12:00");
	});
});

describe("getISODatePart", () => {
	it("should extract date from standard ISO", () => {
		expect(getISODatePart("2025-03-15T14:30:00")).toBe("2025-03-15");
	});

	it("should extract date from ISO with suffix", () => {
		expect(getISODatePart("2025-03-15T14:30:00.000Z")).toBe("2025-03-15");
	});

	it("should return the full string when no T separator", () => {
		expect(getISODatePart("2025-03-15")).toBe("2025-03-15");
	});
});

describe("getISOTimePart", () => {
	it("should extract time including T separator", () => {
		expect(getISOTimePart("2025-03-15T14:30:00")).toBe("T14:30:00");
	});

	it("should extract time with suffix", () => {
		expect(getISOTimePart("2025-03-15T14:30:00.000Z")).toBe("T14:30:00.000Z");
	});

	it("should return empty string when no T separator", () => {
		expect(getISOTimePart("2025-03-15")).toBe("");
	});

	it("should handle midnight", () => {
		expect(getISOTimePart("2025-03-15T00:00:00")).toBe("T00:00:00");
	});
});

describe("replaceISOTime", () => {
	it("should replace the time portion while keeping the date", () => {
		expect(replaceISOTime("2025-03-15T09:00:00", "T14:30:00")).toBe("2025-03-15T14:30:00");
	});

	it("should work with suffixed ISO strings", () => {
		expect(replaceISOTime("2025-03-15T09:00:00.000Z", "T14:30:00")).toBe("2025-03-15T14:30:00");
	});

	it("should handle different dates with same time swap", () => {
		expect(replaceISOTime("2026-01-20T08:00:00", "T10:00:00")).toBe("2026-01-20T10:00:00");
	});
});

describe("ensureISOSuffix", () => {
	it("should return already correct .000Z format unchanged", () => {
		expect(ensureISOSuffix("2025-02-18T09:00:00.000Z")).toBe("2025-02-18T09:00:00.000Z");
	});

	it("should append .000Z to datetime without suffix", () => {
		expect(ensureISOSuffix("2025-02-18T09:00:00")).toBe("2025-02-18T09:00:00.000Z");
	});

	it("should append :00.000Z to datetime with only hours and minutes", () => {
		expect(ensureISOSuffix("2025-02-18T09:00")).toBe("2025-02-18T09:00:00.000Z");
	});

	it("should normalize datetime ending with Z but no milliseconds", () => {
		expect(ensureISOSuffix("2025-02-18T09:00:00Z")).toBe("2025-02-18T09:00:00.000Z");
	});

	it("should normalize datetime with different milliseconds to .000Z", () => {
		expect(ensureISOSuffix("2025-02-18T09:00:00.123Z")).toBe("2025-02-18T09:00:00.000Z");
	});

	it("should normalize datetime with milliseconds but no Z", () => {
		expect(ensureISOSuffix("2025-02-18T09:00:00.500")).toBe("2025-02-18T09:00:00.000Z");
	});

	it("should return date-only strings unchanged", () => {
		expect(ensureISOSuffix("2025-02-18")).toBe("2025-02-18");
	});

	it("should handle midnight correctly", () => {
		expect(ensureISOSuffix("2025-02-18T00:00:00")).toBe("2025-02-18T00:00:00.000Z");
	});

	it("should handle end-of-day time", () => {
		expect(ensureISOSuffix("2025-02-18T23:59:59")).toBe("2025-02-18T23:59:59.000Z");
	});

	it("should handle HH:MM format with Z suffix", () => {
		expect(ensureISOSuffix("2025-02-18T09:00Z")).toBe("2025-02-18T09:00:00.000Z");
	});
});
