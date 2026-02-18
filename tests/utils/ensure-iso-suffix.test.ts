import { describe, expect, it } from "vitest";
import { ensureISOSuffix } from "../../src/utils/format";

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
