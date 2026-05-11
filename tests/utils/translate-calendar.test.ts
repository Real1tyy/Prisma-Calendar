import { describe, expect, it } from "vitest";

import type { SingleCalendarConfig } from "../../src/types/settings";
import { translateFrontmatterToCalendar } from "../../src/utils/frontmatter/translate-calendar";
import { createParserSettings } from "../fixtures/settings-fixtures";

const from: SingleCalendarConfig = createParserSettings({
	startProp: "Start Date",
	endProp: "End Date",
	dateProp: "Date",
	allDayProp: "All Day",
	categoryProp: "Category",
	locationProp: "Location",
	skipProp: "Skip",
});

const to: SingleCalendarConfig = createParserSettings({
	startProp: "Begin",
	endProp: "Finish",
	dateProp: "Day",
	allDayProp: "Full Day",
	categoryProp: "Topic",
	locationProp: "Where",
	skipProp: "Hide",
});

describe("translateFrontmatterToCalendar", () => {
	it("renames configured props to the destination's names", () => {
		const result = translateFrontmatterToCalendar(
			{
				"Start Date": "2026-05-07T09:00",
				"End Date": "2026-05-07T10:00",
				Category: "Work",
				Location: "Office",
			},
			from,
			to
		);

		expect(result).toEqual({
			Begin: "2026-05-07T09:00",
			Finish: "2026-05-07T10:00",
			Topic: "Work",
			Where: "Office",
		});
	});

	it("preserves custom user keys that aren't part of the schema", () => {
		const result = translateFrontmatterToCalendar(
			{
				"Start Date": "2026-05-07T09:00",
				priority: "high",
				project: "[[Alpha]]",
			},
			from,
			to
		);

		expect(result["priority"]).toBe("high");
		expect(result["project"]).toBe("[[Alpha]]");
		expect(result["Begin"]).toBe("2026-05-07T09:00");
		expect(result["Start Date"]).toBeUndefined();
	});

	it("is a no-op when source and destination share the same schema", () => {
		const same: SingleCalendarConfig = createParserSettings({
			startProp: "Start Date",
			endProp: "End Date",
			categoryProp: "Category",
		});
		const fm = {
			"Start Date": "2026-05-07T09:00",
			"End Date": "2026-05-07T10:00",
			Category: "Work",
		};

		const result = translateFrontmatterToCalendar(fm, same, same);

		expect(result).toEqual(fm);
		expect(result).not.toBe(fm); // returns a fresh object
	});

	it("does not mutate the input frontmatter", () => {
		const fm = {
			"Start Date": "2026-05-07T09:00",
			Category: "Work",
		};
		const snapshot = { ...fm };

		translateFrontmatterToCalendar(fm, from, to);

		expect(fm).toEqual(snapshot);
	});

	it("skips props the source frontmatter doesn't carry", () => {
		const result = translateFrontmatterToCalendar({ "Start Date": "2026-05-07T09:00" }, from, to);

		expect(result).toEqual({ Begin: "2026-05-07T09:00" });
		expect(result["Finish"]).toBeUndefined();
		expect(result["Topic"]).toBeUndefined();
	});
});
