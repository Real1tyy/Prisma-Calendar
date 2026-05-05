import { describe, expect, it } from "vitest";

import type { SingleCalendarConfig } from "../../src/types/settings";
import {
	directoriesOverlap,
	findConflictForCalendar,
	findNormalizationConflicts,
} from "../../src/utils/calendar-conflicts";
import { createMockSingleCalendarSettings } from "../setup";

const calendar = (overrides: Partial<SingleCalendarConfig>): SingleCalendarConfig =>
	({
		...createMockSingleCalendarSettings(),
		...overrides,
	}) as SingleCalendarConfig;

describe("directoriesOverlap", () => {
	it("identical non-empty directories overlap", () => {
		expect(
			directoriesOverlap(
				{ directory: "Tasks", indexSubdirectories: false },
				{ directory: "Tasks", indexSubdirectories: false }
			)
		).toBe(true);
	});

	it("disjoint directories do not overlap", () => {
		expect(
			directoriesOverlap(
				{ directory: "Tasks", indexSubdirectories: true },
				{ directory: "Calendar", indexSubdirectories: true }
			)
		).toBe(false);
	});

	it("empty directory never overlaps (treated as unconfigured)", () => {
		expect(
			directoriesOverlap(
				{ directory: "", indexSubdirectories: true },
				{ directory: "Tasks", indexSubdirectories: true }
			)
		).toBe(false);
		expect(
			directoriesOverlap({ directory: "", indexSubdirectories: false }, { directory: "", indexSubdirectories: false })
		).toBe(false);
	});

	it("nested directory only overlaps when the parent indexes subdirectories", () => {
		expect(
			directoriesOverlap(
				{ directory: "Tasks", indexSubdirectories: true },
				{ directory: "Tasks/School", indexSubdirectories: false }
			)
		).toBe(true);
		expect(
			directoriesOverlap(
				{ directory: "Tasks", indexSubdirectories: false },
				{ directory: "Tasks/School", indexSubdirectories: false }
			)
		).toBe(false);
	});

	it("similar prefixes that aren't proper ancestors do not overlap", () => {
		// "TasksOther" is NOT a child of "Tasks" — string prefix isn't enough.
		expect(
			directoriesOverlap(
				{ directory: "Tasks", indexSubdirectories: true },
				{ directory: "TasksOther", indexSubdirectories: true }
			)
		).toBe(false);
	});

	it("treats trailing slashes as equivalent for overlap", () => {
		expect(
			directoriesOverlap(
				{ directory: "Tasks/", indexSubdirectories: false },
				{ directory: "Tasks", indexSubdirectories: false }
			)
		).toBe(true);
		expect(
			directoriesOverlap(
				{ directory: "Tasks", indexSubdirectories: true },
				{ directory: "Tasks/School/", indexSubdirectories: false }
			)
		).toBe(true);
	});
});

describe("findNormalizationConflicts", () => {
	it("no conflict when one calendar has no overlap", () => {
		const calendars = [
			calendar({
				id: "a",
				name: "A",
				directory: "Tasks",
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
			}),
			calendar({
				id: "b",
				name: "B",
				directory: "Calendar",
				sortingStrategy: "none" as any,
				sortDateProp: "Sort Date",
			}),
		];
		expect(findNormalizationConflicts(calendars)).toEqual([]);
	});

	it("no conflict when both write the same (strategy, prop)", () => {
		const calendars = [
			calendar({
				id: "a",
				name: "A",
				directory: "Tasks",
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
			}),
			calendar({
				id: "b",
				name: "B",
				directory: "Tasks",
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
			}),
		];
		expect(findNormalizationConflicts(calendars)).toEqual([]);
	});

	it("no conflict when both calendars opt out (strategy=none on both)", () => {
		const calendars = [
			calendar({ id: "a", name: "A", directory: "Tasks", sortingStrategy: "none" as any }),
			calendar({ id: "b", name: "B", directory: "Tasks", sortingStrategy: "none" as any }),
		];
		expect(findNormalizationConflicts(calendars)).toEqual([]);
	});

	// The exact bug the user hit: A=allStartDate, B=none, both pointing at Tasks.
	it("flags one writer + one none in the same directory (the user's incident)", () => {
		const calendars = [
			calendar({
				id: "main",
				name: "Main Calendar",
				directory: "Tasks",
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
			}),
			calendar({
				id: "second",
				name: "Second",
				directory: "Tasks",
				sortingStrategy: "none" as any,
				sortDateProp: "Sort Date",
			}),
		];
		const conflicts = findNormalizationConflicts(calendars);
		expect(conflicts).toHaveLength(2);
		expect(conflicts[0]).toMatchObject({ calendarId: "main", otherCalendarId: "second", reason: "different-strategy" });
		expect(conflicts[1]).toMatchObject({ calendarId: "second", otherCalendarId: "main", reason: "different-strategy" });
	});

	it("flags two writers with the same prop but different strategies", () => {
		const calendars = [
			calendar({
				id: "a",
				name: "A",
				directory: "Tasks",
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
			}),
			calendar({
				id: "b",
				name: "B",
				directory: "Tasks",
				sortingStrategy: "allEndDate" as any,
				sortDateProp: "Sort Date",
			}),
		];
		const conflicts = findNormalizationConflicts(calendars);
		expect(conflicts).toHaveLength(2);
		expect(conflicts[0].reason).toBe("different-strategy");
	});

	it("flags two writers with the same strategy but different prop names", () => {
		const calendars = [
			calendar({
				id: "a",
				name: "A",
				directory: "Tasks",
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
			}),
			calendar({
				id: "b",
				name: "B",
				directory: "Tasks",
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort",
			}),
		];
		const conflicts = findNormalizationConflicts(calendars);
		expect(conflicts).toHaveLength(2);
		expect(conflicts[0].reason).toBe("different-prop");
	});

	it("ignores disabled calendars", () => {
		const calendars = [
			calendar({ id: "a", name: "A", enabled: true, directory: "Tasks", sortingStrategy: "allStartDate" as any }),
			calendar({ id: "b", name: "B", enabled: false, directory: "Tasks", sortingStrategy: "none" as any }),
		];
		expect(findNormalizationConflicts(calendars)).toEqual([]);
	});

	it("flags conflicts via subdirectory overlap when parent indexes subdirectories", () => {
		const calendars = [
			calendar({
				id: "parent",
				name: "Parent",
				directory: "Tasks",
				indexSubdirectories: true,
				sortingStrategy: "allStartDate" as any,
				sortDateProp: "Sort Date",
			}),
			calendar({
				id: "child",
				name: "Child",
				directory: "Tasks/School",
				indexSubdirectories: false,
				sortingStrategy: "none" as any,
				sortDateProp: "Sort Date",
			}),
		];
		const conflicts = findNormalizationConflicts(calendars);
		expect(conflicts).toHaveLength(2);
	});
});

describe("findConflictForCalendar", () => {
	it("returns the matching conflict by calendarId", () => {
		const calendars = [
			calendar({ id: "main", name: "Main", directory: "Tasks", sortingStrategy: "allStartDate" as any }),
			calendar({ id: "second", name: "Second", directory: "Tasks", sortingStrategy: "none" as any }),
		];
		const conflict = findConflictForCalendar("main", calendars);
		expect(conflict).not.toBeNull();
		expect(conflict?.otherCalendarName).toBe("Second");
	});

	it("returns null when no conflict involves the calendar", () => {
		const calendars = [
			calendar({ id: "a", name: "A", directory: "Tasks" }),
			calendar({ id: "b", name: "B", directory: "Calendar" }),
		];
		expect(findConflictForCalendar("a", calendars)).toBeNull();
	});
});
