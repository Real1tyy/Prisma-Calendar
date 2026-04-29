import { describe, expect, it } from "vitest";

import {
	buildDirectorySuggestions,
	formatDirectorySuggestionDescription,
	formatDirectorySuggestionMeta,
} from "../../src/onboarding/directory-suggestions";

describe("directory suggestions", () => {
	it("aggregates likely event folders by top-level directory", () => {
		const suggestions = buildDirectorySuggestions([
			{
				path: "Projects/Launch Plan.md",
				frontmatter: {
					"Start Date": "2026-04-22T09:00",
					"End Date": "2026-04-22T10:00",
				},
			},
			{
				path: "Projects/Review.md",
				frontmatter: {
					Date: "2026-04-23",
				},
			},
			{
				path: "People/Alice.md",
				frontmatter: {
					birthday: "1990-02-10",
				},
			},
			{
				path: "Inbox/Plain Note.md",
				frontmatter: {
					Status: "Next",
				},
			},
		]);

		expect(suggestions[0]).toMatchObject({
			directory: "Projects",
			fileCount: 2,
		});
		expect(suggestions[0].datetimeProps).toContain("Start Date");
		expect(suggestions[0].datetimeProps).toContain("End Date");
		expect(suggestions[0].dateProps).toContain("Date");
		expect(suggestions.some((entry) => entry.directory === "Inbox")).toBe(false);
	});

	it("classifies datetime and date properties separately", () => {
		const suggestions = buildDirectorySuggestions([
			{
				path: "Calendar/Meeting.md",
				frontmatter: {
					Start: "2026-05-01T14:00",
					End: "2026-05-01T15:00",
					Due: "2026-05-01",
					Created: "2026-04-20",
				},
			},
		]);

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].datetimeProps).toEqual(["End", "Start"]);
		expect(suggestions[0].dateProps).toEqual(["Created", "Due"]);
	});

	it("classifies a property as datetime if any occurrence has a time component", () => {
		const suggestions = buildDirectorySuggestions([
			{
				path: "Tasks/A.md",
				frontmatter: { Deadline: "2026-05-01" },
			},
			{
				path: "Tasks/B.md",
				frontmatter: { Deadline: "2026-05-02T10:00" },
			},
		]);

		expect(suggestions[0].datetimeProps).toContain("Deadline");
		expect(suggestions[0].dateProps).not.toContain("Deadline");
	});

	it("formats suggestion metadata with categorized properties", () => {
		const meta = formatDirectorySuggestionMeta({
			directory: "Calendar",
			fileCount: 3,
			datetimeProps: ["Start", "End"],
			dateProps: ["Due"],
		});

		expect(meta).toContain("3 notes");
		expect(meta).toContain("datetime: Start, End");
		expect(meta).toContain("date: Due");
	});

	it("formats suggestion descriptions without ranking folders", () => {
		expect(
			formatDirectorySuggestionDescription({
				directory: "Calendar",
				fileCount: 1,
				dateProps: ["Date"],
				datetimeProps: [],
			})
		).toContain("Contains a note");

		expect(
			formatDirectorySuggestionDescription({
				directory: "Calendar",
				fileCount: 2,
				dateProps: ["Date"],
				datetimeProps: [],
			})
		).toContain("Contains notes");
	});
});
