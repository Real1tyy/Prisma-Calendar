import { describe, expect, it } from "vitest";

import { isAllDayEvent, isTimedEvent } from "../../src/types/calendar";
import { buildEventSchemaInput, createEventSchema, type EventSchemaInput } from "../../src/types/event-schemas";
import type { Frontmatter } from "../../src/types/index";
import type { SingleCalendarConfig } from "../../src/types/settings";
import { createParserSettings } from "../fixtures/settings-fixtures";

function makeInput(
	settings: SingleCalendarConfig,
	overrides: { filePath?: string; folder?: string; frontmatter?: Frontmatter } = {}
): EventSchemaInput {
	return buildEventSchemaInput(
		{
			filePath: overrides.filePath ?? "Events/event.md",
			folder: overrides.folder ?? "Events",
			frontmatter: overrides.frontmatter ?? {},
		},
		settings
	);
}

describe("event-schemas (mapped envelope)", () => {
	const settings = createParserSettings();
	const parser = createEventSchema(settings);

	describe("timed events", () => {
		it("parses a timed event with start and end", () => {
			const event = parser.parse(
				makeInput(settings, {
					filePath: "Events/Meeting.md",
					frontmatter: {
						"Start Date": "2024-01-15 10:00",
						"End Date": "2024-01-15 11:30",
						Title: "Team Meeting",
					},
				})
			);
			expect(event).not.toBeNull();
			expect(event && isTimedEvent(event)).toBe(true);
			if (!event || !isTimedEvent(event)) return;
			expect(event.title).toBe("Team Meeting");
			expect(event.start).toBe("2024-01-15T10:00:00");
			expect(event.end).toBe("2024-01-15T11:30:00");
			expect(event.allDay).toBe(false);
		});

		it("strips timezone offsets in transforms (no Z, no offset)", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { "Start Date": "2024-01-15T10:00:00Z" } }));
			expect(event?.start).not.toContain("Z");
			expect(event?.start).not.toMatch(/[+-]\d{2}:\d{2}$/);
		});

		it("derives end from defaultDurationMinutes when end is missing", () => {
			const s = createParserSettings({ defaultDurationMinutes: 45 });
			const event = createEventSchema(s).parse(makeInput(s, { frontmatter: { "Start Date": "2024-01-15 10:00" } }));
			expect(event && isTimedEvent(event) && event.end).toBe("2024-01-15T10:45:00");
		});

		it("returns null when start is missing", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: {} }));
			expect(event).toBeNull();
		});

		it("returns null when start is unparseable", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { "Start Date": "not-a-date" } }));
			expect(event).toBeNull();
		});

		it("falls back to filename when title prop is empty", () => {
			const event = parser.parse(
				makeInput(settings, {
					filePath: "Events/Lunch.md",
					frontmatter: { "Start Date": "2024-01-15 12:00" },
				})
			);
			expect(event?.title).toBe("Lunch");
		});

		it("propagates skip from the mapped skip prop", () => {
			const s = createParserSettings({ skipProp: "Skip" });
			const event = createEventSchema(s).parse(
				makeInput(s, { frontmatter: { "Start Date": "2024-01-15 10:00", Skip: true } })
			);
			expect(event?.skipped).toBe(true);
		});
	});

	describe("all-day events", () => {
		it("parses an all-day event with date and allDay flag", () => {
			const event = parser.parse(
				makeInput(settings, {
					filePath: "Events/Holiday.md",
					frontmatter: { Date: "2024-12-25", "All Day": true, Title: "Holiday" },
				})
			);
			expect(event && isAllDayEvent(event)).toBe(true);
			if (!event || !isAllDayEvent(event)) return;
			expect(event.title).toBe("Holiday");
			expect(event.start).toBe("2024-12-25T00:00:00");
		});

		it("accepts string 'true' for allDay flag", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { Date: "2024-12-25", "All Day": "true" } }));
			expect(event && isAllDayEvent(event)).toBe(true);
		});

		it("returns null when allDay flag is missing/false", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { Date: "2024-12-25" } }));
			expect(event).toBeNull();
		});

		it("returns null when date is missing", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { "All Day": true } }));
			expect(event).toBeNull();
		});

		it("returns null when date is unparseable", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { Date: "garbage", "All Day": true } }));
			expect(event).toBeNull();
		});
	});

	describe("untracked events", () => {
		it("parses an untracked event when neither start nor date is set", () => {
			const event = parser.parseUntracked(
				makeInput(settings, {
					filePath: "Notes/Idea.md",
					frontmatter: { Title: "Some Idea" },
				})
			);
			expect(event?.type).toBe("untracked");
			expect(event?.title).toBe("Some Idea");
			expect(event?.virtualKind).toBe("none");
			expect(event?.skipped).toBe(false);
		});

		it("returns null when start is present", () => {
			const event = parser.parseUntracked(makeInput(settings, { frontmatter: { "Start Date": "2024-01-15 10:00" } }));
			expect(event).toBeNull();
		});

		it("returns null when date is present", () => {
			const event = parser.parseUntracked(makeInput(settings, { frontmatter: { Date: "2024-01-15" } }));
			expect(event).toBeNull();
		});

		it("treats empty strings as absent (still untracked)", () => {
			const event = parser.parseUntracked(
				makeInput(settings, { frontmatter: { "Start Date": "", Date: "", Title: "Stub" } })
			);
			expect(event?.type).toBe("untracked");
		});
	});

	describe("dispatcher", () => {
		it("dispatches all-day events to allDay schema", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { Date: "2024-12-25", "All Day": true } }));
			expect(event && isAllDayEvent(event)).toBe(true);
		});

		it("dispatches timed events to timed schema", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: { "Start Date": "2024-01-15 10:00" } }));
			expect(event && isTimedEvent(event)).toBe(true);
		});

		it("returns null for events that match no schema", () => {
			const event = parser.parse(makeInput(settings, { frontmatter: {} }));
			expect(event).toBeNull();
		});

		it("parseAny falls back to untracked when tracked schemas fail", () => {
			const event = parser.parseAny(makeInput(settings, { frontmatter: { Title: "Standalone" } }));
			expect(event?.type).toBe("untracked");
		});

		it("parseAny prefers tracked over untracked", () => {
			const event = parser.parseAny(makeInput(settings, { frontmatter: { "Start Date": "2024-01-15 10:00" } }));
			expect(event?.type).toBe("timed");
		});
	});

	describe("settings-driven mapping", () => {
		it("respects custom prop names in the mapped schema", () => {
			const s = createParserSettings({
				startProp: "MyStart",
				endProp: "MyEnd",
				titleProp: "MyTitle",
			});
			const event = createEventSchema(s).parse(
				makeInput(s, {
					frontmatter: { MyStart: "2024-01-15 10:00", MyEnd: "2024-01-15 11:00", MyTitle: "Custom" },
				})
			);
			expect(event?.title).toBe("Custom");
			expect(event?.start).toBe("2024-01-15T10:00:00");
		});

		it("remaps non-conventional metadata keys (categories→categoryProp)", () => {
			const s = createParserSettings({ categoryProp: "Category" });
			const event = createEventSchema(s).parse(
				makeInput(s, {
					frontmatter: { "Start Date": "2024-01-15 10:00", Category: "Work, Meetings" },
				})
			);
			expect(event?.metadata.categories).toEqual(["Work", "Meetings"]);
		});
	});

	// Priority contract for makeTitle(): titleProp > calendarTitleProp > filename.
	// Regression guard for the inversion introduced during the parser refactor —
	// when both the user's configured titleProp and the auto-written calendarTitle
	// back-link are present on disk, the titleProp value must win.
	describe("title resolution priority", () => {
		it("prefers titleProp over calendarTitleProp when both are present", () => {
			const s = createParserSettings({ titleProp: "EventName", calendarTitleProp: "Calendar Title" });
			const event = createEventSchema(s).parse(
				makeInput(s, {
					filePath: "Events/hidden-filename.md",
					frontmatter: {
						"Start Date": "2024-01-15 10:00",
						EventName: "Display Alpha",
						"Calendar Title": "[[hidden-filename|hidden-filename]]",
					},
				})
			);
			expect(event?.title).toBe("Display Alpha");
		});

		it("falls back to calendarTitleProp when titleProp is unset", () => {
			const s = createParserSettings({ titleProp: "", calendarTitleProp: "Calendar Title" });
			const event = createEventSchema(s).parse(
				makeInput(s, {
					filePath: "Events/raw-filename.md",
					frontmatter: {
						"Start Date": "2024-01-15 10:00",
						"Calendar Title": "[[raw-filename|Pretty Name]]",
					},
				})
			);
			expect(event?.title).toBe("Pretty Name");
		});
	});
});
