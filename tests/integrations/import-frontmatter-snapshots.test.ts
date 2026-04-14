/**
 * Approval snapshots for `buildFrontmatterFromImportedEvent`.
 *
 * This is the pure boundary function that every inbound integration
 * (CalDAV sync, ICS subscription sync, .ics file import) ultimately runs to
 * convert a remote event into the local note's frontmatter. Pinning its
 * output per event shape catches silent wire-format regressions — renamed
 * properties, changed date serialization, missing fields.
 *
 * Note on CalDAV: this plugin's CalDAV integration is currently PULL-ONLY
 * (read remote → write local note), so there are no "outgoing PUT bodies"
 * to snapshot. This test covers the incoming direction which is the
 * user-visible surface.
 */
import { describe, expect, it } from "vitest";

import { buildFrontmatterFromImportedEvent, type ImportedEvent } from "../../src/core/integrations/ics-import";
import { createParserSettings } from "../fixtures/settings-fixtures";

function asSnapshot(fm: Record<string, unknown>): string {
	// Sort keys for determinism — frontmatter key order is not part of the contract.
	const sorted = Object.keys(fm)
		.sort()
		.reduce<Record<string, unknown>>((acc, key) => {
			acc[key] = fm[key];
			return acc;
		}, {});
	return JSON.stringify(sorted, null, 2) + "\n";
}

function makeImported(overrides: Partial<ImportedEvent> & { noEnd?: boolean } = {}): ImportedEvent {
	const { noEnd, ...rest } = overrides;
	const base: ImportedEvent = {
		title: "Team Meeting",
		start: new Date("2026-04-15T14:00:00.000Z"),
		allDay: false,
		uid: "evt-1@example.com",
	};
	if (!noEnd && !rest.allDay) {
		base.end = new Date("2026-04-15T15:00:00.000Z");
	}
	return { ...base, ...rest };
}

describe("buildFrontmatterFromImportedEvent — approval snapshots", () => {
	it("timed event in UTC — minimal shape", async () => {
		const fm = buildFrontmatterFromImportedEvent(makeImported({}), createParserSettings(), "UTC");
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-timed-utc.approved.json");
	});

	it("all-day event stores only the date portion in startProp", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({
				title: "Public Holiday",
				start: new Date("2026-07-04T00:00:00.000Z"),
				allDay: true,
			}),
			createParserSettings(),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-allday.approved.json");
	});

	it("timed event in Europe/Berlin — start shifts to local wall-clock", async () => {
		// A UTC 14:00 event is 16:00 local in Berlin (summer time DST +2h).
		const fm = buildFrontmatterFromImportedEvent(makeImported({}), createParserSettings(), "Europe/Berlin");
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-timed-berlin.approved.json");
	});

	it("categories → categoryProp as an array", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({
				categories: ["Work", "Urgent"],
			}),
			createParserSettings({ categoryProp: "Category" }),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-with-categories.approved.json");
	});

	it("location + participants → their configured property keys", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({
				location: "Conference Room A",
				participants: ["Alice", "Bob"],
			}),
			createParserSettings({ locationProp: "Location", participantsProp: "Participants" }),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-location-participants.approved.json");
	});

	it("reminderMinutes maps to minutesBeforeProp for timed events", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({ reminderMinutes: 30 }),
			createParserSettings({ minutesBeforeProp: "Minutes Before" }),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-reminder-timed.approved.json");
	});

	it("reminderMinutes converts to daysBeforeProp for all-day events", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({
				title: "Pay Rent",
				start: new Date("2026-05-01T00:00:00.000Z"),
				allDay: true,
				reminderMinutes: 3 * 24 * 60, // 3 days in minutes
			}),
			createParserSettings({ daysBeforeProp: "Days Before" }),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-reminder-allday.approved.json");
	});

	it("rrule → sets rruleProp and auto-sets skipProp=true (so occurrences stay with the provider)", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({
				rrule: { type: "weekly" },
			}),
			createParserSettings({ rruleProp: "Recurrence", skipProp: "Skip" }),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-with-rrule.approved.json");
	});

	it("X-PRISMA frontmatter is merged into the output as-is", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({
				frontmatter: {
					CustomTag: "from-ics",
					Priority: 3,
				},
			}),
			createParserSettings(),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-prisma-extension.approved.json");
	});

	it("everything together: the maximal event shape", async () => {
		const fm = buildFrontmatterFromImportedEvent(
			makeImported({
				title: "Project Planning",
				start: new Date("2026-04-15T10:00:00.000Z"),
				end: new Date("2026-04-15T11:30:00.000Z"),
				categories: ["Work"],
				location: "Conference Room A",
				participants: ["Alice", "Bob"],
				reminderMinutes: 15,
				rrule: { type: "weekly" },
				frontmatter: { Priority: 1 },
			}),
			createParserSettings({
				categoryProp: "Category",
				locationProp: "Location",
				participantsProp: "Participants",
				minutesBeforeProp: "Minutes Before",
				rruleProp: "Recurrence",
				skipProp: "Skip",
			}),
			"UTC"
		);
		await expect(asSnapshot(fm)).toMatchFileSnapshot("__snapshots__/fm-maximal.approved.json");
	});
});
