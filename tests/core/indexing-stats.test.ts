import { describe, expect, it } from "vitest";

import {
	classifyDropReason,
	classifyRow,
	formatFirstIndexNotice,
	formatIndexingSummary,
	formatIndexingTally,
	tallyIndexedRows,
	type DropReasonCategory,
	type IndexedRowKind,
} from "../../src/core/indexing-stats";
import type { Frontmatter } from "../../src/types";
import { createParserSettings } from "../fixtures/settings-fixtures";

const settings = createParserSettings();

describe("classifyRow", () => {
	it.each<[string, Frontmatter, IndexedRowKind]>([
		["timed note with start datetime", { "Start Date": "2024-06-15T10:00:00", Title: "Meeting" }, "timed"],
		["all-day note with date", { Date: "2024-06-15", "All Day": true, Title: "Conference" }, "allDay"],
		["plain note with no date-like props", { Title: "Reference", project: "Apollo" }, "untracked"],
		["empty frontmatter", {}, "untracked"],
	])("classifies a %s", (_label, frontmatter, expectedKind) => {
		expect(classifyRow(frontmatter, settings).kind).toBe(expectedKind);
	});

	it.each<[string, Frontmatter, DropReasonCategory]>([
		["unparseable mapped start", { "Start Date": "sometime next week" }, "unparseable-date"],
		["unparseable mapped date", { Date: "see calendar" }, "unparseable-date"],
		["date-like value under an unmapped property", { scheduled: "2024-06-15" }, "unmapped-date-prop"],
		["mapped property name with a trailing space", { "Date ": "2024-06-15" }, "trailing-space-key"],
		["trailing space on an otherwise date-like key", { "due ": "2024-06-15" }, "trailing-space-key"],
	])("drops a %s", (_label, frontmatter, expectedCategory) => {
		const classification = classifyRow(frontmatter, settings);
		expect(classification.kind).toBe("dropped");
		expect(classification.reasonCategory).toBe(expectedCategory);
		expect(classification.reason).toBeTruthy();
	});

	it("names the offending property in the unmapped-date-prop reason", () => {
		expect(classifyRow({ scheduled: "2024-06-15" }, settings).reason).toContain("scheduled");
	});

	it("names the trailing-space key in the reason", () => {
		expect(classifyRow({ "Date ": "2024-06-15" }, settings).reason).toContain("Date ");
	});
});

describe("classifyDropReason", () => {
	it("returns null for a resolved note", () => {
		expect(classifyDropReason({ "Start Date": "2024-06-15T10:00:00" }, settings)).toBeNull();
	});

	it("returns null for a legitimately untracked note", () => {
		expect(classifyDropReason({ Title: "Reference" }, settings)).toBeNull();
	});

	it("returns the human reason for a dropped note", () => {
		expect(classifyDropReason({ "Start Date": "garbage" }, settings)).toContain("isn't a recognised date format");
	});
});

describe("tallyIndexedRows", () => {
	it("counts each kind and aggregates drop reasons by category", () => {
		const rows = [
			{ data: { "Start Date": "2024-06-15T10:00:00" } },
			{ data: { "Start Date": "2024-06-16T09:00:00" } },
			{ data: { Date: "2024-06-15", "All Day": true } },
			{ data: { Title: "Reference" } },
			{ data: { "Start Date": "next tuesday" } },
			{ data: { scheduled: "2024-06-15" } },
		];

		const tally = tallyIndexedRows(rows, settings);

		expect(tally).toEqual({
			total: 6,
			timed: 2,
			allDay: 1,
			untracked: 1,
			dropped: 2,
			dropReasons: { "unparseable-date": 1, "unmapped-date-prop": 1, "trailing-space-key": 0 },
		});
	});

	it("returns an all-zero tally for no rows", () => {
		const tally = tallyIndexedRows([], settings);
		expect(tally.total).toBe(0);
		expect(tally.timed + tally.allDay + tally.untracked + tally.dropped).toBe(0);
	});
});

describe("formatters", () => {
	const tally = tallyIndexedRows(
		[
			{ data: { "Start Date": "2024-06-15T10:00:00" } },
			{ data: { Date: "2024-06-15", "All Day": true } },
			{ data: { Title: "Reference" } },
			{ data: { "Start Date": "garbage" } },
		],
		settings
	);

	it("renders the compact tally line", () => {
		expect(formatIndexingTally(tally)).toBe("1 timed · 1 all-day · 1 untracked · 1 couldn't be read");
	});

	it("omits the dropped clause when nothing dropped", () => {
		const clean = tallyIndexedRows([{ data: { "Start Date": "2024-06-15T10:00:00" } }], settings);
		expect(formatIndexingTally(clean)).toBe("1 timed · 0 all-day · 0 untracked");
	});

	it("includes the drop breakdown in the console summary", () => {
		const summary = formatIndexingSummary("Work", tally);
		expect(summary).toContain('Indexed "Work": 4 notes');
		expect(summary).toContain("unparseable-date: 1");
	});

	it("renders the first-index notice with directory and on-calendar count", () => {
		expect(formatFirstIndexNotice("Calendar/", tally)).toBe(
			"4 notes in Calendar/ · 2 on the calendar · 1 couldn't be read"
		);
	});
});
