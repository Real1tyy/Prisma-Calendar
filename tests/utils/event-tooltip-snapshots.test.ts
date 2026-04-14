/**
 * Approval snapshots for `buildEventTooltip`.
 *
 * The tooltip is a multi-line hover string shown on every event in the
 * calendar. Its exact format — title + date suffix, then "Key: value" lines
 * for declared display properties — is both a user-facing affordance and a
 * function of settings. Snapshots pin the output per event shape.
 */
import { describe, expect, it } from "vitest";

import { buildEventTooltip } from "../../src/utils/format";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";
import { createParserSettings } from "../fixtures/settings-fixtures";

function write(lines: string): string {
	return lines.endsWith("\n") ? lines : lines + "\n";
}

describe("buildEventTooltip — approval snapshots", () => {
	it("timed event: title + time range on a single line", async () => {
		const event = createMockTimedEvent({
			title: "Team Meeting",
			start: "2026-04-15T14:00:00",
			end: "2026-04-15T15:00:00",
		});
		const out = buildEventTooltip(event, createParserSettings());
		await expect(write(out)).toMatchFileSnapshot("__snapshots__/tooltip-timed.approved.txt");
	});

	it("all-day event: title + date, no time", async () => {
		const event = createMockAllDayEvent({
			title: "Public Holiday",
			start: "2026-07-04T00:00:00",
		});
		const out = buildEventTooltip(event, createParserSettings());
		await expect(write(out)).toMatchFileSnapshot("__snapshots__/tooltip-allday.approved.txt");
	});

	it("appends display properties in declared order when configured", async () => {
		const event = createMockTimedEvent({
			title: "Project Planning",
			start: "2026-04-15T10:00:00",
			end: "2026-04-15T11:30:00",
			meta: {
				Category: "Work",
				Location: "Conference Room A",
				Participants: ["Alice", "Bob"],
			},
		});
		const settings = createParserSettings({
			frontmatterDisplayProperties: ["Category", "Location", "Participants"],
		});
		const out = buildEventTooltip(event, settings);
		await expect(write(out)).toMatchFileSnapshot("__snapshots__/tooltip-with-props.approved.txt");
	});

	it("uses frontmatterDisplayPropertiesAllDay for all-day events", async () => {
		const event = createMockAllDayEvent({
			title: "Company Retreat",
			start: "2026-06-20T00:00:00",
			meta: {
				Category: "Offsite",
				Location: "Lakehouse",
			},
		});
		const settings = createParserSettings({
			frontmatterDisplayProperties: ["Category"],
			frontmatterDisplayPropertiesAllDay: ["Location"],
		});
		const out = buildEventTooltip(event, settings);
		// Note: All-day branch uses the All-Day list, so Category is NOT included.
		await expect(write(out)).toMatchFileSnapshot("__snapshots__/tooltip-allday-with-props.approved.txt");
	});

	it("omits empty/absent display property values", async () => {
		const event = createMockTimedEvent({
			title: "Sparse Event",
			start: "2026-04-15T10:00:00",
			end: "2026-04-15T11:00:00",
			meta: {
				Category: "Work",
				Location: "", // empty
				// Notes missing entirely
			},
		});
		const settings = createParserSettings({
			frontmatterDisplayProperties: ["Category", "Location", "Notes"],
		});
		const out = buildEventTooltip(event, settings);
		await expect(write(out)).toMatchFileSnapshot("__snapshots__/tooltip-omit-empty.approved.txt");
	});

	it("renders wiki-link values as the raw link text", async () => {
		const event = createMockTimedEvent({
			title: "Pair Programming",
			start: "2026-04-15T14:00:00",
			end: "2026-04-15T15:30:00",
			meta: {
				Pair: "[[Alice]]",
				Project: "[[Project Atlas|Atlas]]",
			},
		});
		const settings = createParserSettings({
			frontmatterDisplayProperties: ["Pair", "Project"],
		});
		const out = buildEventTooltip(event, settings);
		await expect(write(out)).toMatchFileSnapshot("__snapshots__/tooltip-wikilinks.approved.txt");
	});
});
