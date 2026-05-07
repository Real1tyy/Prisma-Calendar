import { describe, expect, it } from "vitest";

import {
	type EventsModalSortMode,
	filterEventsModalItemsByQuery,
	sortEventsModalItems,
} from "../../src/react/modals/event-list/events-modal-shared";

interface Row {
	title: string;
	count: number;
}

const rows: Row[] = [
	{ title: "Workout", count: 3 },
	{ title: "Team Meeting", count: 7 },
	{ title: "Review", count: 7 },
	{ title: "Project Planning", count: 1 },
];

describe("sortEventsModalItems", () => {
	it.each([
		["count-desc", ["Review", "Team Meeting", "Workout", "Project Planning"]],
		["count-asc", ["Project Planning", "Workout", "Review", "Team Meeting"]],
		["name-asc", ["Project Planning", "Review", "Team Meeting", "Workout"]],
		["name-desc", ["Workout", "Team Meeting", "Review", "Project Planning"]],
	] satisfies [EventsModalSortMode, string[]][])("sorts by %s", (mode, expected) => {
		const sorted = sortEventsModalItems(rows, (r) => r.count, mode);
		expect(sorted.map((r) => r.title)).toEqual(expected);
	});

	it("breaks count ties alphabetically (asc) regardless of direction", () => {
		const ties = sortEventsModalItems(rows, (r) => r.count, "count-desc");
		const tied = ties.filter((r) => r.count === 7).map((r) => r.title);
		expect(tied).toEqual(["Review", "Team Meeting"]);
	});

	it("does not mutate the source array", () => {
		const original = [...rows];
		sortEventsModalItems(rows, (r) => r.count, "name-asc");
		expect(rows).toEqual(original);
	});

	it("returns an empty array when given one", () => {
		expect(sortEventsModalItems<Row>([], (r) => r.count, "count-desc")).toEqual([]);
	});
});

describe("filterEventsModalItemsByQuery", () => {
	it("returns all items for empty/whitespace queries", () => {
		expect(filterEventsModalItemsByQuery(rows, "")).toEqual(rows);
		expect(filterEventsModalItemsByQuery(rows, "   ")).toEqual(rows);
	});

	it("matches case-insensitively on title substring", () => {
		const result = filterEventsModalItemsByQuery(rows, "TEAM");
		expect(result.map((r) => r.title)).toEqual(["Team Meeting"]);
	});

	it("trims surrounding whitespace from the query", () => {
		const result = filterEventsModalItemsByQuery(rows, "   review   ");
		expect(result.map((r) => r.title)).toEqual(["Review"]);
	});

	it("returns an empty array when nothing matches", () => {
		expect(filterEventsModalItemsByQuery(rows, "nope")).toEqual([]);
	});
});
