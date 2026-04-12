import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createICSFromEvents } from "../../src/core/integrations/ics-export";
import { parseICSContent } from "../../src/core/integrations/ics-import";
import type { CalendarEvent } from "../../src/types/calendar";
import { createICSExportOptions, createMockAllDayEvent, createMockTimedEvent } from "../fixtures";

// Titles emitted to ICS SUMMARY are trimmed by the receiving parser, so we
// require non-trimmable content. The exporter also strips zettel-id prefixes
// (14 leading digits) from titles — we exclude those to avoid comparing
// against a transformed value.
const arbTitle = fc
	.string({ minLength: 1, maxLength: 50 })
	.filter((s) => !/[\r\n]/.test(s) && !/^\d{14}/.test(s) && s === s.trim() && s.length > 0);

const arbEventId = fc.string({ minLength: 1, maxLength: 30 }).filter((s) => /^[a-zA-Z0-9_-]+$/.test(s));

// ICS CATEGORIES values get trimmed on parse. Require tokens with no leading
// or trailing whitespace so the round-trip comparison is unambiguous.
const arbCategories = fc.array(
	fc
		.string({ minLength: 1, maxLength: 15 })
		.filter((s) => /^[a-zA-Z0-9 _-]+$/.test(s) && s === s.trim() && s.length > 0),
	{ minLength: 0, maxLength: 4 }
);

const arbLocation = fc
	.string({ minLength: 0, maxLength: 40 })
	.filter((s) => !/[\r\n]/.test(s) && (s.length === 0 || s.trim().length > 0));

function ymd(year: number, month: number, day: number): string {
	const mm = String(month).padStart(2, "0");
	const dd = String(day).padStart(2, "0");
	return `${year}-${mm}-${dd}`;
}

const arbDate = fc
	.record({
		year: fc.integer({ min: 2000, max: 2030 }),
		month: fc.integer({ min: 1, max: 12 }),
		day: fc.integer({ min: 1, max: 28 }),
	})
	.map(({ year, month, day }) => ymd(year, month, day));

const arbAllDayEvent = fc
	.record({
		id: arbEventId,
		title: arbTitle,
		date: arbDate,
		categories: arbCategories,
		location: arbLocation,
	})
	.map(({ id, title, date, categories, location }) =>
		createMockAllDayEvent({
			id,
			title,
			start: `${date}T00:00:00`,
			ref: { filePath: `Events/${id}.md` },
			metadata: {
				categories: categories.length > 0 ? categories : undefined,
				location: location.trim() || undefined,
			},
		})
	);

const arbTimedEvent = fc
	.record({
		id: arbEventId,
		title: arbTitle,
		date: arbDate,
		startHour: fc.integer({ min: 0, max: 22 }),
		durationHours: fc.integer({ min: 1, max: 8 }),
	})
	.map(({ id, title, date, startHour, durationHours }) => {
		const sh = String(startHour).padStart(2, "0");
		const eh = String(Math.min(startHour + durationHours, 23)).padStart(2, "0");
		return createMockTimedEvent({
			id,
			title,
			start: `${date}T${sh}:00:00`,
			end: `${date}T${eh}:00:00`,
			ref: { filePath: `Events/${id}.md` },
		});
	});

const arbEvent = fc.oneof(arbAllDayEvent, arbTimedEvent);

function exportAndParse(events: CalendarEvent[]): ReturnType<typeof parseICSContent> {
	const exportResult = createICSFromEvents(events, createICSExportOptions());
	if (!exportResult.success || !exportResult.content) {
		throw new Error(`export failed: ${exportResult.error?.message ?? "unknown"}`);
	}
	return parseICSContent(exportResult.content);
}

describe("ICS export → import round-trip", () => {
	it("preserves event count for 1..5 events", () => {
		fc.assert(
			fc.property(fc.array(arbEvent, { minLength: 1, maxLength: 5 }), (events) => {
				const parsed = exportAndParse(events);

				expect(parsed.success).toBe(true);
				expect(parsed.events).toHaveLength(events.length);
			}),
			{ numRuns: 100 }
		);
	});

	it("preserves title through round-trip", () => {
		fc.assert(
			fc.property(arbEvent, (event) => {
				const parsed = exportAndParse([event]);
				expect(parsed.events[0].title).toBe(event.title);
			}),
			{ numRuns: 100 }
		);
	});

	it("preserves uid (event.id)", () => {
		fc.assert(
			fc.property(arbEvent, (event) => {
				const parsed = exportAndParse([event]);
				expect(parsed.events[0].uid).toBe(event.id);
			}),
			{ numRuns: 100 }
		);
	});

	it("preserves allDay flag", () => {
		fc.assert(
			fc.property(arbEvent, (event) => {
				const parsed = exportAndParse([event]);
				expect(parsed.events[0].allDay).toBe(event.allDay);
			}),
			{ numRuns: 100 }
		);
	});

	it("all-day event start date is within ±1 day of input (timezone-tolerant)", () => {
		// ICAL.js emits all-day DTSTART as a local-midnight Date, so the exact
		// UTC date may shift by ±1 day depending on the test runner's timezone.
		// What matters for round-trip is that the parsed Date represents the
		// same calendar day when displayed in the user's locale.
		fc.assert(
			fc.property(arbAllDayEvent, (event) => {
				const parsed = exportAndParse([event]);
				const expected = new Date(`${event.start.split("T")[0]}T00:00:00Z`).getTime();
				const actual = parsed.events[0].start.getTime();
				const diffDays = Math.abs(actual - expected) / (24 * 60 * 60 * 1000);
				expect(diffDays).toBeLessThanOrEqual(1);
			}),
			{ numRuns: 100 }
		);
	});

	it("timed event has both start and end set after parse", () => {
		fc.assert(
			fc.property(arbTimedEvent, (event) => {
				const parsed = exportAndParse([event]);
				expect(parsed.events[0].start).toBeInstanceOf(Date);
				expect(parsed.events[0].end).toBeInstanceOf(Date);
			}),
			{ numRuns: 100 }
		);
	});

	it("export never throws and always succeeds for valid events", () => {
		fc.assert(
			fc.property(fc.array(arbEvent, { minLength: 1, maxLength: 10 }), (events) => {
				const result = createICSFromEvents(events, createICSExportOptions());
				expect(result.success).toBe(true);
				expect(result.content).toContain("BEGIN:VCALENDAR");
				expect(result.content).toContain("END:VCALENDAR");
			}),
			{ numRuns: 50 }
		);
	});

	it("parse never throws on exporter output", () => {
		fc.assert(
			fc.property(fc.array(arbEvent, { minLength: 1, maxLength: 5 }), (events) => {
				expect(() => exportAndParse(events)).not.toThrow();
			}),
			{ numRuns: 100 }
		);
	});

	it("preserves non-empty categories", () => {
		fc.assert(
			fc.property(
				arbAllDayEvent.filter((e) => Array.isArray(e.metadata.categories) && e.metadata.categories.length > 0),
				(event) => {
					const parsed = exportAndParse([event]);
					expect(parsed.events[0].categories).toEqual(event.metadata.categories);
				}
			),
			{ numRuns: 50 }
		);
	});

	it("preserves non-empty location", () => {
		fc.assert(
			fc.property(
				arbAllDayEvent.filter((e) => !!e.metadata.location),
				(event) => {
					const parsed = exportAndParse([event]);
					expect(parsed.events[0].location).toBe(event.metadata.location);
				}
			),
			{ numRuns: 50 }
		);
	});
});
