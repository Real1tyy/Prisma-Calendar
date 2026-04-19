import { describe, expect, it } from "vitest";

import {
	buildCustomIntervalDSL,
	formatRecurrenceLabel,
	isPresetType,
	isWeekdaySupported,
	parseRecurrenceType,
} from "../../src/utils/recurring-utils";

describe("recurrence-parsing", () => {
	describe("parseRecurrenceType", () => {
		it("should parse all 9 presets correctly", () => {
			expect(parseRecurrenceType("daily")).toEqual({ freq: "DAILY", interval: 1 });
			expect(parseRecurrenceType("bi-daily")).toEqual({ freq: "DAILY", interval: 2 });
			expect(parseRecurrenceType("weekly")).toEqual({ freq: "WEEKLY", interval: 1 });
			expect(parseRecurrenceType("bi-weekly")).toEqual({ freq: "WEEKLY", interval: 2 });
			expect(parseRecurrenceType("monthly")).toEqual({ freq: "MONTHLY", interval: 1 });
			expect(parseRecurrenceType("bi-monthly")).toEqual({ freq: "MONTHLY", interval: 2 });
			expect(parseRecurrenceType("quarterly")).toEqual({ freq: "MONTHLY", interval: 3 });
			expect(parseRecurrenceType("semi-annual")).toEqual({ freq: "MONTHLY", interval: 6 });
			expect(parseRecurrenceType("yearly")).toEqual({ freq: "YEARLY", interval: 1 });
		});

		it("should parse custom DSL strings correctly", () => {
			expect(parseRecurrenceType("DAILY;INTERVAL=5")).toEqual({ freq: "DAILY", interval: 5 });
			expect(parseRecurrenceType("WEEKLY;INTERVAL=3")).toEqual({ freq: "WEEKLY", interval: 3 });
			expect(parseRecurrenceType("MONTHLY;INTERVAL=4")).toEqual({ freq: "MONTHLY", interval: 4 });
			expect(parseRecurrenceType("YEARLY;INTERVAL=2")).toEqual({ freq: "YEARLY", interval: 2 });
			expect(parseRecurrenceType("DAILY;INTERVAL=1")).toEqual({ freq: "DAILY", interval: 1 });
		});

		it("should return null for invalid strings", () => {
			expect(parseRecurrenceType("invalid")).toBeNull();
			expect(parseRecurrenceType("HOURLY;INTERVAL=2")).toBeNull();
			expect(parseRecurrenceType("DAILY;INTERVAL=0")).toBeNull();
			expect(parseRecurrenceType("DAILY;INTERVAL=-1")).toBeNull();
			expect(parseRecurrenceType("")).toBeNull();
			expect(parseRecurrenceType("DAILY;INTERVAL=")).toBeNull();
			expect(parseRecurrenceType("DAILY;INTERVAL=abc")).toBeNull();
			expect(parseRecurrenceType("DAILY;INTERVAL")).toBeNull();
			expect(parseRecurrenceType("WEEKLY;3")).toBeNull();
		});
	});

	describe("formatRecurrenceLabel", () => {
		it("should return preset labels for preset types", () => {
			expect(formatRecurrenceLabel("daily")).toBe("Daily");
			expect(formatRecurrenceLabel("bi-daily")).toBe("Bi-daily (every 2 days)");
			expect(formatRecurrenceLabel("weekly")).toBe("Weekly");
			expect(formatRecurrenceLabel("monthly")).toBe("Monthly");
			expect(formatRecurrenceLabel("yearly")).toBe("Yearly");
		});

		it("should return human-readable labels for custom types", () => {
			expect(formatRecurrenceLabel("DAILY;INTERVAL=5")).toBe("Every 5 days");
			expect(formatRecurrenceLabel("WEEKLY;INTERVAL=3")).toBe("Every 3 weeks");
			expect(formatRecurrenceLabel("MONTHLY;INTERVAL=4")).toBe("Every 4 months");
			expect(formatRecurrenceLabel("YEARLY;INTERVAL=2")).toBe("Every 2 years");
		});

		it("should use singular form for interval of 1", () => {
			expect(formatRecurrenceLabel("DAILY;INTERVAL=1")).toBe("Every day");
			expect(formatRecurrenceLabel("WEEKLY;INTERVAL=1")).toBe("Every week");
			expect(formatRecurrenceLabel("MONTHLY;INTERVAL=1")).toBe("Every month");
			expect(formatRecurrenceLabel("YEARLY;INTERVAL=1")).toBe("Every year");
		});

		it("should return raw value for invalid strings", () => {
			expect(formatRecurrenceLabel("invalid")).toBe("invalid");
		});
	});

	describe("isWeekdaySupported", () => {
		it("should return true for preset weekly/bi-weekly only", () => {
			expect(isWeekdaySupported("weekly")).toBe(true);
			expect(isWeekdaySupported("bi-weekly")).toBe(true);
		});

		it("should return false for custom weekly intervals", () => {
			expect(isWeekdaySupported("WEEKLY;INTERVAL=3")).toBe(false);
			expect(isWeekdaySupported("WEEKLY;INTERVAL=1")).toBe(false);
		});

		it("should return false for non-weekly types", () => {
			expect(isWeekdaySupported("daily")).toBe(false);
			expect(isWeekdaySupported("bi-daily")).toBe(false);
			expect(isWeekdaySupported("monthly")).toBe(false);
			expect(isWeekdaySupported("yearly")).toBe(false);
			expect(isWeekdaySupported("DAILY;INTERVAL=5")).toBe(false);
			expect(isWeekdaySupported("MONTHLY;INTERVAL=4")).toBe(false);
			expect(isWeekdaySupported("invalid")).toBe(false);
		});
	});

	describe("isPresetType", () => {
		it("should return true for preset types", () => {
			expect(isPresetType("daily")).toBe(true);
			expect(isPresetType("bi-daily")).toBe(true);
			expect(isPresetType("weekly")).toBe(true);
			expect(isPresetType("bi-weekly")).toBe(true);
			expect(isPresetType("monthly")).toBe(true);
			expect(isPresetType("bi-monthly")).toBe(true);
			expect(isPresetType("quarterly")).toBe(true);
			expect(isPresetType("semi-annual")).toBe(true);
			expect(isPresetType("yearly")).toBe(true);
		});

		it("should return false for non-preset types", () => {
			expect(isPresetType("DAILY;INTERVAL=5")).toBe(false);
			expect(isPresetType("WEEKLY;INTERVAL=3")).toBe(false);
			expect(isPresetType("custom")).toBe(false);
			expect(isPresetType("invalid")).toBe(false);
		});
	});

	describe("buildCustomIntervalDSL", () => {
		it("should construct DSL string from frequency and interval", () => {
			expect(buildCustomIntervalDSL("DAILY", 5)).toBe("DAILY;INTERVAL=5");
			expect(buildCustomIntervalDSL("WEEKLY", 3)).toBe("WEEKLY;INTERVAL=3");
			expect(buildCustomIntervalDSL("MONTHLY", 4)).toBe("MONTHLY;INTERVAL=4");
			expect(buildCustomIntervalDSL("YEARLY", 2)).toBe("YEARLY;INTERVAL=2");
		});

		it("should clamp interval to minimum of 1", () => {
			expect(buildCustomIntervalDSL("DAILY", 0)).toBe("DAILY;INTERVAL=1");
			expect(buildCustomIntervalDSL("DAILY", -5)).toBe("DAILY;INTERVAL=1");
		});

		it("should produce valid parseable DSL strings", () => {
			const dsl = buildCustomIntervalDSL("WEEKLY", 3);
			const parsed = parseRecurrenceType(dsl);
			expect(parsed).toEqual({ freq: "WEEKLY", interval: 3 });
		});
	});
});
