import { describe, expect, it } from "vitest";

import { createEventFrontmatterSchema } from "../../src/types/event-frontmatter-schema";
import { createDefaultCalendarConfig } from "../../src/utils/calendar/settings";

// The schema is built once per prop mapping and reused for every event on ingest
// (the perf-critical path). Caching lives in the shared `createMappedSchema`
// (see its own tests + docs/specs/2026-05-23-prisma-perf-analysis.md #1); these
// assert the win flows through to Prisma's per-event usage.
describe("createEventFrontmatterSchema", () => {
	it("reuses one memoized schema across calendars with the same prop mapping", () => {
		// Different config objects, identical default prop names → shared cache hit.
		const a = createDefaultCalendarConfig("a", "Calendar A");
		const b = createDefaultCalendarConfig("b", "Calendar B");
		expect(createEventFrontmatterSchema(a)).toBe(createEventFrontmatterSchema(b));
	});

	it("builds a distinct schema when a prop name differs", () => {
		const base = createDefaultCalendarConfig("default", "Main Calendar");
		const remapped = { ...base, startProp: "CustomStart" };
		expect(createEventFrontmatterSchema(base)).not.toBe(createEventFrontmatterSchema(remapped));
	});

	it("still remaps the configured prop names when parsing", () => {
		const settings = createDefaultCalendarConfig("default", "Main Calendar");
		const titleKey = String(settings.titleProp);
		const parsed = createEventFrontmatterSchema(settings).parse({ [titleKey]: "Team Meeting" });
		expect(parsed.title).toBe("Team Meeting");
	});
});
