import { describe, expect, it } from "vitest";
import { minsToTimeStr, parseTimeToMins } from "../../src/utils/format";

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
