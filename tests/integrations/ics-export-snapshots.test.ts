/**
 * Approval snapshots for `createICSFromEvents`.
 *
 * Complements the property-based round-trip tests in ics-roundtrip.property.test.ts
 * by pinning exact ICS output for several representative event shapes. Any change
 * to structure, property order, or default values will surface in the diff.
 *
 * Determinism note: `parsedEventToVEvent` extracts a zettel-ID from
 * `event.ref.filePath` to seed DTSTAMP/CREATED/LAST-MODIFIED. When the path
 * contains a zettel-ID (e.g., `Events/foo-20250101000000.md`), DTSTAMP is
 * derived deterministically. When it doesn't (as in these tests, which use
 * simple basenames like `Events/team-meeting.md`), the code falls back to
 * `ICAL.Time.now()` — so we pin system time per test to keep snapshots stable.
 * The `zettel-id seeds DTSTAMP deterministically without fake timers` case
 * below exercises the zettel-ID-bearing-path branch directly.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createICSFromEvents } from "../../src/core/integrations/ics-export";
import type { CalendarEvent } from "../../src/types/calendar";
import { createICSExportOptions, createMockAllDayEvent, createMockTimedEvent } from "../fixtures";

const PINNED_NOW = new Date("2026-04-12T10:00:00Z");

function refFor(basename: string): { filePath: string } {
	return { filePath: `Events/${basename}.md` };
}

function exportOrFail(
	events: CalendarEvent[],
	optionOverrides: Parameters<typeof createICSExportOptions>[0] = {}
): string {
	const result = createICSFromEvents(events, createICSExportOptions(optionOverrides));
	if (!result.success || !result.content) {
		throw new Error(`export failed: ${result.error?.message ?? "unknown"}`);
	}
	// ICS line endings are CRLF per RFC 5545; normalize to LF for readable snapshots.
	return result.content.replace(/\r\n/g, "\n");
}

describe("createICSFromEvents — approval snapshots", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(PINNED_NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("single timed event", async () => {
		const event = createMockTimedEvent({
			id: "single-timed",
			title: "Team Meeting",
			start: "2026-04-15T14:00:00",
			end: "2026-04-15T15:00:00",
			ref: refFor("team-meeting"),
		});

		const output = exportOrFail([event], { calendarName: "My Calendar" });
		await expect(output).toMatchFileSnapshot("__snapshots__/single-timed.approved.ics");
	});

	it("single all-day event", async () => {
		const event = createMockAllDayEvent({
			id: "single-allday",
			title: "Public Holiday",
			start: "2026-07-04T00:00:00",
			ref: refFor("public-holiday"),
		});

		const output = exportOrFail([event], { calendarName: "My Calendar" });
		await expect(output).toMatchFileSnapshot("__snapshots__/single-allday.approved.ics");
	});

	it("multiple events sorted in input order", async () => {
		const events = [
			createMockTimedEvent({
				id: "morning-standup",
				title: "Morning Standup",
				start: "2026-04-15T09:00:00",
				end: "2026-04-15T09:15:00",
				ref: refFor("morning-standup"),
			}),
			createMockTimedEvent({
				id: "afternoon-review",
				title: "Afternoon Review",
				start: "2026-04-15T14:00:00",
				end: "2026-04-15T15:00:00",
				ref: refFor("afternoon-review"),
			}),
			createMockAllDayEvent({
				id: "company-holiday",
				title: "Company Holiday",
				start: "2026-04-15T00:00:00",
				ref: refFor("company-holiday"),
			}),
		];

		const output = exportOrFail(events, { calendarName: "My Calendar" });
		await expect(output).toMatchFileSnapshot("__snapshots__/multi-event.approved.ics");
	});

	it("timed event with categories, location, and participants", async () => {
		const event = createMockTimedEvent({
			id: "rich-event",
			title: "Project Planning",
			start: "2026-04-15T10:00:00",
			end: "2026-04-15T11:30:00",
			ref: refFor("project-planning"),
			metadata: {
				categories: ["Work", "Urgent"],
				location: "Conference Room A",
				participants: ["Alice", "Bob", "Charlie"],
			},
		});

		const output = exportOrFail([event], { calendarName: "My Calendar" });
		await expect(output).toMatchFileSnapshot("__snapshots__/event-with-metadata.approved.ics");
	});

	it("timed event with a reminder alarm", async () => {
		const event = createMockTimedEvent({
			id: "reminder-event",
			title: "Dentist Appointment",
			start: "2026-04-15T10:00:00",
			end: "2026-04-15T11:00:00",
			ref: refFor("dentist-appointment"),
			metadata: {
				minutesBefore: 30,
			},
		});

		const output = exportOrFail([event], { calendarName: "My Calendar" });
		await expect(output).toMatchFileSnapshot("__snapshots__/event-with-alarm.approved.ics");
	});

	it("all-day event with days-before alarm", async () => {
		const event = createMockAllDayEvent({
			id: "daily-alarm",
			title: "Pay Rent",
			start: "2026-04-01T00:00:00",
			ref: refFor("pay-rent"),
			metadata: {
				daysBefore: 3,
			},
		});

		const output = exportOrFail([event], { calendarName: "My Calendar" });
		await expect(output).toMatchFileSnapshot("__snapshots__/allday-with-alarm.approved.ics");
	});

	it("non-UTC timezone includes X-WR-TIMEZONE header", async () => {
		const event = createMockTimedEvent({
			id: "timezone-event",
			title: "European Meeting",
			start: "2026-04-15T10:00:00",
			end: "2026-04-15T11:00:00",
			ref: refFor("european-meeting"),
		});

		const output = exportOrFail([event], { calendarName: "My Calendar", timezone: "Europe/Berlin" });
		await expect(output).toMatchFileSnapshot("__snapshots__/timezone-berlin.approved.ics");
	});

	it("empty events array returns failure, never reaches snapshot", () => {
		const result = createICSFromEvents([], createICSExportOptions());
		expect(result.success).toBe(false);
		expect(result.error?.message).toBe("No events to export");
	});

	it("zettel-id in the file path seeds DTSTAMP deterministically without fake timers", () => {
		// Regression test for the extractZettelId `.md`-path bug: previously,
		// events with zettel-IDs in their filenames couldn't have their ID
		// extracted because the regex anchored at end-of-string and `.md`
		// prevented the match. Now that the regex tolerates `.md`, two exports
		// of the same event produce byte-identical output without any time
		// mocking — DTSTAMP/CREATED/LAST-MODIFIED are derived from the zettel-ID.
		vi.useRealTimers();

		const event = createMockTimedEvent({
			id: "stable-event",
			title: "Project Kickoff",
			start: "2026-04-15T10:00:00",
			end: "2026-04-15T11:00:00",
			ref: { filePath: "Events/project-kickoff-20260415100000.md" },
		});

		const first = exportOrFail([event], { calendarName: "My Calendar" });
		const second = exportOrFail([event], { calendarName: "My Calendar" });

		expect(first).toBe(second);
		// And crucially, the DTSTAMP reflects the zettel-ID's timestamp (2026-04-15 10:00:00),
		// not wall-clock.
		expect(first).toMatch(/DTSTAMP:20260415T100000Z/);
	});
});
