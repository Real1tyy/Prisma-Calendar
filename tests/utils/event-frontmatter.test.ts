import type { FrontmatterDiff } from "@real1ty-obsidian-plugins";
import { describe, expect, it } from "vitest";
import { extractTimeDiffFromFrontmatterDiff, stripISOSuffix } from "../../src/utils/event-frontmatter";
import type { SingleCalendarConfig } from "../../src/types/settings";

const mockSettings = {
	startProp: "Start",
	endProp: "End",
} as SingleCalendarConfig;

function createDiff(overrides: Partial<FrontmatterDiff> = {}): FrontmatterDiff {
	return {
		hasChanges: true,
		changes: [],
		added: [],
		modified: [],
		deleted: [],
		...overrides,
	};
}

describe("stripISOSuffix", () => {
	it("should strip .000Z suffix", () => {
		expect(stripISOSuffix("2026-03-06T09:00:00.000Z")).toBe("2026-03-06T09:00:00");
	});

	it("should strip standalone Z suffix", () => {
		expect(stripISOSuffix("2026-03-06T09:00:00Z")).toBe("2026-03-06T09:00:00");
	});

	it("should leave string unchanged when no suffix", () => {
		expect(stripISOSuffix("2026-03-06T09:00:00")).toBe("2026-03-06T09:00:00");
	});

	it("should handle milliseconds with Z", () => {
		expect(stripISOSuffix("2026-03-06T14:30:00.000Z")).toBe("2026-03-06T14:30:00");
	});
});

describe("extractTimeDiffFromFrontmatterDiff", () => {
	it("should return null when no time properties changed", () => {
		const diff = createDiff({
			modified: [{ key: "Category", oldValue: "Work", newValue: "Personal", changeType: "modified" }],
		});

		expect(extractTimeDiffFromFrontmatterDiff(diff, mockSettings)).toBeNull();
	});

	it("should return null when diff has no modifications", () => {
		const diff = createDiff();
		expect(extractTimeDiffFromFrontmatterDiff(diff, mockSettings)).toBeNull();
	});

	it("should extract start time change", () => {
		const diff = createDiff({
			modified: [
				{
					key: "Start",
					oldValue: "2026-03-06T09:00:00",
					newValue: "2026-03-06T10:00:00",
					changeType: "modified",
				},
			],
		});

		const result = extractTimeDiffFromFrontmatterDiff(diff, mockSettings);
		expect(result).toEqual({
			startChange: { oldValue: "2026-03-06T09:00:00", newValue: "2026-03-06T10:00:00" },
			endChange: undefined,
		});
	});

	it("should extract end time change", () => {
		const diff = createDiff({
			modified: [
				{
					key: "End",
					oldValue: "2026-03-06T10:00:00",
					newValue: "2026-03-06T11:00:00",
					changeType: "modified",
				},
			],
		});

		const result = extractTimeDiffFromFrontmatterDiff(diff, mockSettings);
		expect(result).toEqual({
			startChange: undefined,
			endChange: { oldValue: "2026-03-06T10:00:00", newValue: "2026-03-06T11:00:00" },
		});
	});

	it("should extract both start and end changes", () => {
		const diff = createDiff({
			modified: [
				{
					key: "Start",
					oldValue: "2026-03-06T09:00:00",
					newValue: "2026-03-06T10:00:00",
					changeType: "modified",
				},
				{
					key: "End",
					oldValue: "2026-03-06T10:00:00",
					newValue: "2026-03-06T11:00:00",
					changeType: "modified",
				},
			],
		});

		const result = extractTimeDiffFromFrontmatterDiff(diff, mockSettings);
		expect(result).toEqual({
			startChange: { oldValue: "2026-03-06T09:00:00", newValue: "2026-03-06T10:00:00" },
			endChange: { oldValue: "2026-03-06T10:00:00", newValue: "2026-03-06T11:00:00" },
		});
	});

	it("should ignore non-string values", () => {
		const diff = createDiff({
			modified: [
				{ key: "Start", oldValue: 123, newValue: "2026-03-06T10:00:00", changeType: "modified" },
				{ key: "End", oldValue: "2026-03-06T10:00:00", newValue: null, changeType: "modified" },
			],
		});

		expect(extractTimeDiffFromFrontmatterDiff(diff, mockSettings)).toBeNull();
	});

	it("should ignore time changes mixed with non-string values", () => {
		const diff = createDiff({
			modified: [
				{ key: "Start", oldValue: 123, newValue: "2026-03-06T10:00:00", changeType: "modified" },
				{
					key: "End",
					oldValue: "2026-03-06T10:00:00",
					newValue: "2026-03-06T11:00:00",
					changeType: "modified",
				},
			],
		});

		const result = extractTimeDiffFromFrontmatterDiff(diff, mockSettings);
		expect(result).toEqual({
			startChange: undefined,
			endChange: { oldValue: "2026-03-06T10:00:00", newValue: "2026-03-06T11:00:00" },
		});
	});

	it("should use settings prop names for matching", () => {
		const customSettings = {
			startProp: "EventStart",
			endProp: "EventEnd",
		} as SingleCalendarConfig;

		const diff = createDiff({
			modified: [
				{
					key: "EventStart",
					oldValue: "2026-03-06T09:00:00",
					newValue: "2026-03-06T10:00:00",
					changeType: "modified",
				},
				{
					key: "Start",
					oldValue: "2026-03-06T09:00:00",
					newValue: "2026-03-06T10:00:00",
					changeType: "modified",
				},
			],
		});

		const result = extractTimeDiffFromFrontmatterDiff(diff, customSettings);
		expect(result).toEqual({
			startChange: { oldValue: "2026-03-06T09:00:00", newValue: "2026-03-06T10:00:00" },
			endChange: undefined,
		});
	});
});
