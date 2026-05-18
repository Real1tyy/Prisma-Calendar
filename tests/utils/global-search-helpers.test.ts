import { describe, expect, it } from "vitest";

import {
	applyTriStateFilter,
	cycleFilterState,
	filterButtonText,
	formatEventSubtitle,
	type FilterState,
} from "../../src/react/modals/event-list/open-global-search-modal";
import { createMockAllDayEvent, createMockTimedEvent } from "../fixtures/event-fixtures";

describe("cycleFilterState", () => {
	it("cycles none → only → skip → none", () => {
		expect(cycleFilterState("none")).toBe("only");
		expect(cycleFilterState("only")).toBe("skip");
		expect(cycleFilterState("skip")).toBe("none");
	});
});

describe("filterButtonText", () => {
	it("returns the bare label when state is none", () => {
		expect(filterButtonText("Recurring", "none")).toBe("Recurring");
	});

	it("prefixes 'Only ' when state is only", () => {
		expect(filterButtonText("Recurring", "only")).toBe("Only recurring");
		expect(filterButtonText("All-day", "only")).toBe("Only all-day");
	});

	it("prefixes 'Skip ' when state is skip", () => {
		expect(filterButtonText("Recurring", "skip")).toBe("Skip recurring");
		expect(filterButtonText("Skipped", "skip")).toBe("Skip skipped");
	});
});

describe("applyTriStateFilter", () => {
	const items = [
		{ name: "alpha", flag: true },
		{ name: "beta", flag: false },
		{ name: "gamma", flag: true },
	];
	const isFlag = (item: (typeof items)[number]) => item.flag;

	it("returns items unchanged when state is none", () => {
		const result = applyTriStateFilter(items, "none", isFlag);
		expect(result).toEqual(items);
	});

	it("keeps only matches when state is only", () => {
		const result = applyTriStateFilter(items, "only", isFlag);
		expect(result.map((i) => i.name)).toEqual(["alpha", "gamma"]);
	});

	it("removes matches when state is skip", () => {
		const result = applyTriStateFilter(items, "skip", isFlag);
		expect(result.map((i) => i.name)).toEqual(["beta"]);
	});

	it.each(["none", "only", "skip"] satisfies FilterState[])("does not mutate the source array (state=%s)", (state) => {
		const source = [...items];
		applyTriStateFilter(source, state, isFlag);
		expect(source).toEqual(items);
	});
});

describe("formatEventSubtitle", () => {
	it("formats all-day events as 'All-day • <date>'", () => {
		const event = createMockAllDayEvent({ start: "2026-03-15T00:00:00" });
		const subtitle = formatEventSubtitle(event);
		expect(subtitle.startsWith("All-day • ")).toBe(true);
	});

	it("formats timed same-day events with start - end times", () => {
		const event = createMockTimedEvent({
			start: "2026-03-15T09:00:00",
			end: "2026-03-15T10:30:00",
		});
		const subtitle = formatEventSubtitle(event);
		expect(subtitle.startsWith("Timed • ")).toBe(true);
		// Same-day format: <date> <start> - <end>
		expect(subtitle).toMatch(/\d{1,2}:\d{2}.*-.*\d{1,2}:\d{2}/);
	});

	it("formats timed cross-day events with both dates", () => {
		const event = createMockTimedEvent({
			start: "2026-03-15T22:00:00",
			end: "2026-03-16T01:30:00",
		});
		const subtitle = formatEventSubtitle(event);
		expect(subtitle.startsWith("Timed • ")).toBe(true);
		// Cross-day: <startDate> <startTime> - <endDate> <endTime>
		const dashCount = (subtitle.match(/-/g) ?? []).length;
		expect(dashCount).toBeGreaterThanOrEqual(1);
	});

	it("formats timed events without end as date+start only", () => {
		const event = createMockTimedEvent({ start: "2026-03-15T09:00:00", end: undefined });
		const subtitle = formatEventSubtitle(event);
		expect(subtitle.startsWith("Timed • ")).toBe(true);
		// No end-time dash separator
		expect(subtitle.split(" • ")).toHaveLength(2);
	});

	it("appends 'Recurring' when the event has an rruleType", () => {
		const event = createMockTimedEvent({
			start: "2026-03-15T09:00:00",
			end: "2026-03-15T10:00:00",
			metadata: { rruleType: "weekly" },
		});
		const subtitle = formatEventSubtitle(event);
		expect(subtitle.endsWith(" • Recurring")).toBe(true);
	});

	it("does not append 'Recurring' for non-recurring events", () => {
		const event = createMockTimedEvent({ start: "2026-03-15T09:00:00", end: "2026-03-15T10:00:00" });
		expect(formatEventSubtitle(event)).not.toContain("Recurring");
	});
});
