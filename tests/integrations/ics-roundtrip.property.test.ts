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

	// Regression: recurring instances use a hashed rRuleId (`hashRRuleIdToZettelFormat`)
	// as the 14-digit suffix instead of a YYYYMMDDHHMMSS timestamp. When the hash
	// starts with zeros, naive `zettelIdToICALTime` produced year=0 and emitted
	// malformed `DTSTAMP:0-04-27T15:07:17Z`, which crashed re-import with
	// "Could not extract integer from `:1`".
	it("round-trips recurring-instance filenames with leading-zero hash zettels", () => {
		fc.assert(
			fc.property(
				fc.record({
					id: arbEventId,
					title: arbTitle,
					date: arbDate,
					hashSuffix: fc.integer({ min: 0, max: 99_999_999_999_999 }),
				}),
				({ id, title, date, hashSuffix }) => {
					const zettel = String(hashSuffix).padStart(14, "0");
					const event = createMockTimedEvent({
						id,
						title,
						start: `${date}T10:00:00`,
						end: `${date}T11:00:00`,
						ref: { filePath: `Events/${title} ${date}-${zettel}.md` },
					});
					const parsed = exportAndParse([event]);
					expect(parsed.success).toBe(true);
					expect(parsed.skipped).toEqual([]);
					expect(parsed.events).toHaveLength(1);
				}
			),
			{ numRuns: 50 }
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

	it("round-trips events with alarm (VALARM TRIGGER) without parsing errors", () => {
		fc.assert(
			fc.property(
				fc.record({
					id: arbEventId,
					title: arbTitle,
					date: arbDate,
					startHour: fc.integer({ min: 0, max: 22 }),
					durationHours: fc.integer({ min: 1, max: 8 }),
					minutesBefore: fc.integer({ min: 1, max: 1440 }),
				}),
				({ id, title, date, startHour, durationHours, minutesBefore }) => {
					const sh = String(startHour).padStart(2, "0");
					const eh = String(Math.min(startHour + durationHours, 23)).padStart(2, "0");
					const event = createMockTimedEvent({
						id,
						title,
						start: `${date}T${sh}:00:00`,
						end: `${date}T${eh}:00:00`,
						ref: { filePath: `Events/${id}.md` },
						metadata: { minutesBefore },
					});

					const options = createICSExportOptions({
						notifications: { minutesBeforeProp: "Minutes Before" },
					});
					const exportResult = createICSFromEvents([event], options);
					expect(exportResult.success).toBe(true);

					const parsed = parseICSContent(exportResult.content!);
					expect(parsed.success).toBe(true);
					expect(parsed.events).toHaveLength(1);
					expect(parsed.events[0].reminderMinutes).toBe(minutesBefore);
				}
			),
			{ numRuns: 50 }
		);
	});
});

describe("ICS round-trip: X-PRISMA-FM-* frontmatter preservation", () => {
	function exportAndParseWithMeta(meta: Record<string, unknown>): {
		frontmatter: Record<string, unknown> | undefined;
		success: boolean;
	} {
		const event = createMockTimedEvent({
			id: "fm-test",
			title: "Frontmatter Test",
			start: "2025-06-01T10:00:00",
			end: "2025-06-01T11:00:00",
			ref: { filePath: "Events/fm-test-20250601100000.md" },
			meta,
		});

		const exportResult = createICSFromEvents([event], createICSExportOptions());
		if (!exportResult.success || !exportResult.content) {
			return { frontmatter: undefined, success: false };
		}

		const parsed = parseICSContent(exportResult.content);
		return { frontmatter: parsed.events[0]?.frontmatter, success: parsed.success };
	}

	it("preserves string values", () => {
		const { frontmatter, success } = exportAndParseWithMeta({ Status: "Done", Priority: "High" });
		expect(success).toBe(true);
		expect(frontmatter?.["Status"]).toBe("Done");
		expect(frontmatter?.["Priority"]).toBe("High");
	});

	it("preserves numeric values", () => {
		const { frontmatter, success } = exportAndParseWithMeta({ Score: 42, Rating: 3.5 });
		expect(success).toBe(true);
		expect(frontmatter?.["Score"]).toBe(42);
		expect(frontmatter?.["Rating"]).toBe(3.5);
	});

	it("preserves boolean values", () => {
		const { frontmatter, success } = exportAndParseWithMeta({ _Archived: false, Completed: true });
		expect(success).toBe(true);
		expect(frontmatter?.["_Archived"]).toBe(false);
		expect(frontmatter?.["Completed"]).toBe(true);
	});

	it("preserves RRule property without ical.js parse errors", () => {
		const { frontmatter, success } = exportAndParseWithMeta({
			RRule: "daily",
			RRuleID: "1777753288856-VEJGF",
		});
		expect(success).toBe(true);
		expect(frontmatter?.["RRule"]).toBe("daily");
		expect(frontmatter?.["RRuleID"]).toBe("1777753288856-VEJGF");
	});

	it("preserves RRule with YEARLY;INTERVAL=1 format", () => {
		const { frontmatter, success } = exportAndParseWithMeta({
			RRule: "YEARLY;INTERVAL=1",
		});
		expect(success).toBe(true);
		expect(frontmatter?.["RRule"]).toBe("YEARLY;INTERVAL=1");
	});

	it("preserves JSON object values (CalDAV sync metadata)", () => {
		const caldavMeta = {
			accountId: "abc-123",
			calendarHref: "http://localhost:8080/remote.php/dav/calendars/admin/personal/",
			objectHref: "http://localhost:8080/remote.php/dav/calendars/admin/personal/event.ics",
			etag: '"32c714eaabadd923"',
			uid: "d1989b6e-eab7-4f7a-82e8-76389743b48b",
			lastSyncedAt: 1777979452954,
		};
		const { frontmatter, success } = exportAndParseWithMeta({ CalDAV: caldavMeta });
		expect(success).toBe(true);
		expect(frontmatter?.["CalDAV"]).toEqual(caldavMeta);
	});

	it("preserves datetime string values (Sort Date)", () => {
		const { frontmatter, success } = exportAndParseWithMeta({
			"Sort Date": "2026-04-29T07:30:00",
		});
		expect(success).toBe(true);
		expect(frontmatter?.["Sort Date"]).toBe("2026-04-29T07:30:00");
	});

	it("preserves wiki-link values", () => {
		const { frontmatter, success } = exportAndParseWithMeta({
			Template: "[[Templates/New Task Calendar|New Task Calendar]]",
		});
		expect(success).toBe(true);
		expect(frontmatter?.["Template"]).toBe("[[Templates/New Task Calendar|New Task Calendar]]");
	});

	it("preserves _ZettelID and internal properties (numeric strings become numbers)", () => {
		const { frontmatter, success } = exportAndParseWithMeta({
			_ZettelID: "20240701000000",
			_LastModifiedTime: "20240701000000",
		});
		expect(success).toBe(true);
		expect(frontmatter?.["_ZettelID"]).toBe(20240701000000);
		expect(frontmatter?.["_LastModifiedTime"]).toBe(20240701000000);
	});

	it("preserves empty string values", () => {
		const { frontmatter, success } = exportAndParseWithMeta({ Prerequisite: "" });
		expect(success).toBe(true);
		expect(frontmatter?.["Prerequisite"]).toBe("");
	});

	it("preserves all Prisma properties together in a realistic event", () => {
		const meta: Record<string, unknown> = {
			Status: "Done",
			_ZettelID: "20260502222128",
			_Archived: false,
			_LastModifiedTime: "20260502222128",
			"Already Notified": false,
			"Sort Date": "2026-04-29T07:30:00",
			Prerequisite: "",
			RRule: "daily",
			RRuleID: "1777753288856-VEJGF",
			test: "value",
		};

		const expected: Record<string, unknown> = {
			...meta,
			_ZettelID: 20260502222128,
			_LastModifiedTime: 20260502222128,
		};

		const { frontmatter, success } = exportAndParseWithMeta(meta);
		expect(success).toBe(true);

		for (const [key, value] of Object.entries(expected)) {
			expect(frontmatter?.[key]).toEqual(value);
		}
	});

	it("property-based: arbitrary frontmatter keys round-trip", () => {
		const arbKey = fc
			.string({ minLength: 1, maxLength: 20 })
			.filter((s) => /^[a-zA-Z][a-zA-Z0-9 _-]*$/.test(s) && s === s.trim());
		// Exclude purely numeric strings since parseFrontmatterValue coerces them to numbers.
		// Also exclude "true"/"false" which get coerced to booleans.
		const arbStringValue = fc
			.string({ minLength: 1, maxLength: 30 })
			.filter((s) => !/[\r\n]/.test(s) && s === s.trim() && Number.isNaN(Number(s)) && s !== "true" && s !== "false");
		const arbValue = fc.oneof(arbStringValue, fc.integer({ min: -1000, max: 1000 }), fc.boolean());

		fc.assert(
			fc.property(fc.array(fc.tuple(arbKey, arbValue), { minLength: 1, maxLength: 5 }), (entries) => {
				const meta = Object.fromEntries(entries);
				const { frontmatter, success } = exportAndParseWithMeta(meta);
				expect(success).toBe(true);

				for (const [key, value] of Object.entries(meta)) {
					expect(frontmatter?.[key]).toEqual(value);
				}
			}),
			{ numRuns: 50 }
		);
	});
});
