/**
 * `eventData.title` drives the file rename — it must keep the
 * "<title><ZettelID>" (or "<title> <instanceDate>-<ZettelID>") shape the
 * vault stores. `preservedFrontmatter[titleProp]` drives the visible
 * title — it must be exactly what the user typed. These two values
 * share a source (form `title`) but live in different columns of the
 * save payload; once upon a time `saveEvent` mutated the input so both
 * columns ended up with the filename-shaped string, which leaked the
 * ZettelID into the frontmatter. These tests pin the recomposition.
 */
import { describe, expect, it } from "vitest";

import { composeTitleWithZettel } from "../../../src/react/modals/event/event-edit-modal";

describe("composeTitleWithZettel", () => {
	it("returns the user title unchanged when there is no zettel id", () => {
		expect(composeTitleWithZettel("Clean Title", null, "2025-10-07", false)).toBe("Clean Title");
		expect(composeTitleWithZettel("Clean Title", null, null, false)).toBe("Clean Title");
	});

	it.each([
		{
			scenario: "preserves instance date when title was cleaned by cleanupTitle",
			userTitle: "Team Meeting",
			originalZettelId: "-00001125853328",
			instanceDateStr: "2025-10-07",
			titleHadInstanceDate: false,
			expected: "Team Meeting 2025-10-07-00001125853328",
		},
		{
			scenario: "does not duplicate instance date when title already includes it",
			userTitle: "Team Meeting 2025-10-07",
			originalZettelId: "-00001125853328",
			instanceDateStr: "2025-10-07",
			titleHadInstanceDate: true,
			expected: "Team Meeting 2025-10-07-00001125853328",
		},
		{
			scenario: "preserves instance date when user changes the title",
			userTitle: "Weekly Standup",
			originalZettelId: "-00001125853328",
			instanceDateStr: "2025-10-07",
			titleHadInstanceDate: false,
			expected: "Weekly Standup 2025-10-07-00001125853328",
		},
		{
			scenario: "does not inject instance date for regular (non-recurring) events",
			userTitle: "Regular Event",
			originalZettelId: "-20250203140530",
			instanceDateStr: null,
			titleHadInstanceDate: false,
			expected: "Regular Event-20250203140530",
		},
		{
			scenario: "keeps user-edited title in eventData.title with the ZettelID for regular events",
			userTitle: "After Edit",
			originalZettelId: "-20250203140530",
			instanceDateStr: null,
			titleHadInstanceDate: false,
			expected: "After Edit-20250203140530",
		},
	])("$scenario", ({ userTitle, originalZettelId, instanceDateStr, titleHadInstanceDate, expected }) => {
		expect(composeTitleWithZettel(userTitle, originalZettelId, instanceDateStr, titleHadInstanceDate)).toBe(expected);
	});
});
