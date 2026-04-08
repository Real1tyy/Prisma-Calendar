import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";

import { markInstanceStatusIfPast } from "../../src/core/recurring-event-manager";
import type { Frontmatter } from "../../src/types";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { computeSortDateValue, isAllDayEvent, parseCustomDoneProperty } from "../../src/utils/event-frontmatter";
import { createMockSingleCalendarSettings } from "../setup";

function createSettings(overrides: Partial<SingleCalendarConfig> = {}): SingleCalendarConfig {
	return {
		...createMockSingleCalendarSettings(),
		...overrides,
	} as SingleCalendarConfig;
}

describe("markInstanceStatusIfPast — all-day events", () => {
	it("should not mark today's all-day event as done (consistency with indexer)", () => {
		const settings = createSettings({
			markPastInstancesAsDone: true,
			statusProperty: "Status",
			doneValue: "Done",
		});

		const fm: Frontmatter = {};
		const todayStart = DateTime.now().startOf("day");

		markInstanceStatusIfPast(fm, settings, todayStart, null);

		expect(fm[settings.statusProperty]).toBeUndefined();
	});

	it("should mark yesterday's all-day event as done", () => {
		const settings = createSettings({
			markPastInstancesAsDone: true,
			statusProperty: "Status",
			doneValue: "Done",
		});

		const fm: Frontmatter = {};
		const yesterday = DateTime.now().minus({ days: 1 }).startOf("day");

		markInstanceStatusIfPast(fm, settings, yesterday, null);

		expect(fm[settings.statusProperty]).toBe(settings.doneValue);
	});

	it("should not mark future all-day event as done", () => {
		const settings = createSettings({
			markPastInstancesAsDone: true,
			statusProperty: "Status",
			doneValue: "Done",
		});

		const fm: Frontmatter = {};
		const tomorrow = DateTime.now().plus({ days: 1 }).startOf("day");

		markInstanceStatusIfPast(fm, settings, tomorrow, null);

		expect(fm[settings.statusProperty]).toBeUndefined();
	});

	it("should not modify frontmatter when markPastInstancesAsDone is disabled", () => {
		const settings = createSettings({
			markPastInstancesAsDone: false,
			statusProperty: "Status",
			doneValue: "Done",
		});

		const fm: Frontmatter = {};
		const yesterday = DateTime.now().minus({ days: 1 }).startOf("day");

		markInstanceStatusIfPast(fm, settings, yesterday, null);

		expect(fm[settings.statusProperty]).toBeUndefined();
	});

	it("should not overwrite existing done status", () => {
		const settings = createSettings({
			markPastInstancesAsDone: true,
			statusProperty: "Status",
			doneValue: "Done",
		});

		const fm: Frontmatter = { Status: "Done" };
		const yesterday = DateTime.now().minus({ days: 1 }).startOf("day");

		markInstanceStatusIfPast(fm, settings, yesterday, null);

		expect(fm[settings.statusProperty]).toBe("Done");
	});
});

describe("markInstanceStatusIfPast — timed events", () => {
	it("should mark event as done when end time is in the past", () => {
		const settings = createSettings({
			markPastInstancesAsDone: true,
			statusProperty: "Status",
			doneValue: "Done",
		});

		const fm: Frontmatter = {};
		const pastStart = DateTime.now().minus({ hours: 3 });
		const pastEnd = DateTime.now().minus({ hours: 2 });

		markInstanceStatusIfPast(fm, settings, pastStart, pastEnd);

		expect(fm[settings.statusProperty]).toBe(settings.doneValue);
	});

	it("should not mark event as done when end time is in the future", () => {
		const settings = createSettings({
			markPastInstancesAsDone: true,
			statusProperty: "Status",
			doneValue: "Done",
		});

		const fm: Frontmatter = {};
		const pastStart = DateTime.now().minus({ hours: 1 });
		const futureEnd = DateTime.now().plus({ hours: 1 });

		markInstanceStatusIfPast(fm, settings, pastStart, futureEnd);

		expect(fm[settings.statusProperty]).toBeUndefined();
	});
});

describe("computeSortDateValue edge cases", () => {
	it("should return undefined when mode is none", () => {
		const settings = createSettings({ sortingStrategy: "none" as any });
		expect(computeSortDateValue(settings, "2025-01-15T09:00:00")).toBeUndefined();
	});

	it("should return undefined when sortDateProp is empty", () => {
		const settings = createSettings({ sortingStrategy: "startDate" as any, sortDateProp: "" });
		expect(computeSortDateValue(settings, "2025-01-15T09:00:00")).toBeUndefined();
	});

	it("should strip time for all-day events", () => {
		const settings = createSettings({
			sortingStrategy: "allDayOnly" as any,
			sortDateProp: "sortDate",
		});
		const result = computeSortDateValue(settings, "2025-01-15T09:00:00", undefined, true);
		expect(result?.value).toBe("2025-01-15T00:00:00");
	});

	it("should use end date for endDate strategy", () => {
		const settings = createSettings({
			sortingStrategy: "endDate" as any,
			sortDateProp: "sortDate",
		});
		const result = computeSortDateValue(settings, "2025-01-15T09:00:00", "2025-01-15T10:30:00");
		expect(result?.value).toBe("2025-01-15T10:30:00");
	});

	it("should fall back to start when end is missing for endDate strategy", () => {
		const settings = createSettings({
			sortingStrategy: "endDate" as any,
			sortDateProp: "sortDate",
		});
		const result = computeSortDateValue(settings, "2025-01-15T09:00:00", undefined);
		expect(result?.value).toBe("2025-01-15T09:00:00");
	});
});

describe("isAllDayEvent edge cases", () => {
	it("should handle boolean true", () => {
		expect(isAllDayEvent(true)).toBe(true);
	});

	it('should handle string "true" (case-insensitive)', () => {
		expect(isAllDayEvent("true")).toBe(true);
		expect(isAllDayEvent("True")).toBe(true);
		expect(isAllDayEvent("TRUE")).toBe(true);
	});

	it("should reject other values", () => {
		expect(isAllDayEvent(false)).toBe(false);
		expect(isAllDayEvent("false")).toBe(false);
		expect(isAllDayEvent(null)).toBe(false);
		expect(isAllDayEvent(undefined)).toBe(false);
		expect(isAllDayEvent(1)).toBe(false);
		expect(isAllDayEvent("yes")).toBe(false);
	});
});

describe("parseCustomDoneProperty edge cases", () => {
	it("should parse standard key-value pair", () => {
		expect(parseCustomDoneProperty("status completed")).toEqual({ key: "status", value: "completed" });
	});

	it("should parse boolean true value", () => {
		expect(parseCustomDoneProperty("archived true")).toEqual({ key: "archived", value: true });
	});

	it("should parse boolean false value", () => {
		expect(parseCustomDoneProperty("archived false")).toEqual({ key: "archived", value: false });
	});

	it("should parse numeric value", () => {
		expect(parseCustomDoneProperty("priority 1")).toEqual({ key: "priority", value: 1 });
	});

	it("should return null for empty string", () => {
		expect(parseCustomDoneProperty("")).toBeNull();
	});

	it("should return null for key without value", () => {
		expect(parseCustomDoneProperty("archived")).toBeNull();
	});

	it("should return null for whitespace only", () => {
		expect(parseCustomDoneProperty("   ")).toBeNull();
	});

	it("should handle value with spaces", () => {
		const result = parseCustomDoneProperty("status in progress");
		expect(result).toEqual({ key: "status", value: "in progress" });
	});
});
