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
		expect(suggestions[0].matchedProps).toContain("Start Date");
		expect(suggestions[0].matchedProps).toContain("Date");
		expect(suggestions.some((entry) => entry.directory === "Inbox")).toBe(false);
	});

	it("formats suggestion metadata for the onboarding UI", () => {
		const meta = formatDirectorySuggestionMeta({
			directory: "Calendar",
			fileCount: 3,
			matchedProps: ["Start", "End"],
		});

		expect(meta).toContain("3 notes");
		expect(meta).toContain("Start, End");
	});

	it("formats suggestion descriptions without ranking folders", () => {
		expect(
			formatDirectorySuggestionDescription({
				directory: "Calendar",
				fileCount: 1,
				matchedProps: ["Date"],
			})
		).toContain("Contains a note");

		expect(
			formatDirectorySuggestionDescription({
				directory: "Calendar",
				fileCount: 2,
				matchedProps: ["Date"],
			})
		).toContain("Contains notes");
	});
});
