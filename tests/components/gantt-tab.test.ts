import { describe, expect, it } from "vitest";

import { packGanttRows, sanitizeGanttId } from "../../src/components/views/gantt-tab";

describe("sanitizeGanttId", () => {
	it("replaces slashes with underscores", () => {
		expect(sanitizeGanttId("Events/meeting.md")).toBe("Events_meeting_md");
	});

	it("replaces spaces with underscores", () => {
		expect(sanitizeGanttId("My Folder/My Event.md")).toBe("My_Folder_My_Event_md");
	});

	it("replaces brackets with underscores", () => {
		expect(sanitizeGanttId("[[Event]]")).toBe("__Event__");
	});

	it("preserves alphanumeric characters", () => {
		expect(sanitizeGanttId("abc123")).toBe("abc123");
	});
});

function task(id: string, start: string, end: string, deps: string[] = [], name = "Event") {
	return {
		id,
		name,
		_start: new Date(start),
		_end: new Date(end),
		_index: 0,
		_arrayIndex: 0,
		dependencies: deps,
	};
}

describe("packGanttRows", () => {
	it("returns 0 for empty array", () => {
		expect(packGanttRows([])).toBe(0);
	});

	it("packs independent non-overlapping tasks onto the same row", () => {
		const tasks = [task("a", "2024-01-01", "2024-01-05"), task("b", "2024-02-01", "2024-02-05")];
		const rows = packGanttRows(tasks);
		expect(rows).toBe(1);
		expect(tasks[0]._index).toBe(0);
		expect(tasks[1]._index).toBe(0);
	});

	it("puts overlapping tasks on separate rows", () => {
		const tasks = [task("a", "2024-01-01", "2024-01-10"), task("b", "2024-01-05", "2024-01-15")];
		const rows = packGanttRows(tasks);
		expect(rows).toBe(2);
		expect(tasks[0]._index).toBe(0);
		expect(tasks[1]._index).toBe(1);
	});

	it("respects dependency constraints — dependent on higher row", () => {
		const tasks = [task("a", "2024-01-01", "2024-01-05"), task("b", "2024-02-01", "2024-02-05", ["a"])];
		const rows = packGanttRows(tasks);
		expect(rows).toBe(2);
		expect(tasks.find((t) => t.id === "a")!._index).toBe(0);
		expect(tasks.find((t) => t.id === "b")!._index).toBe(1);
	});

	it("packs independent chains into shared rows", () => {
		const tasks = [
			task("a1", "2024-01-01", "2024-01-05"),
			task("a2", "2024-01-20", "2024-01-25", ["a1"]),
			task("b1", "2024-03-01", "2024-03-05"),
			task("b2", "2024-03-20", "2024-03-25", ["b1"]),
		];
		const rows = packGanttRows(tasks);
		expect(rows).toBe(2);
		expect(tasks.find((t) => t.id === "b1")!._index).toBe(0);
		expect(tasks.find((t) => t.id === "b2")!._index).toBe(1);
	});

	it("packs nearby short events onto the same row (labels wrap inside bars)", () => {
		const tasks = [
			task("a", "2024-01-01", "2024-01-02", [], "Focus Session"),
			task("b", "2024-01-03", "2024-01-04", [], "Exercise"),
		];
		const rows = packGanttRows(tasks);
		expect(rows).toBe(1);
	});

	it("handles single task", () => {
		const tasks = [task("a", "2024-01-01", "2024-01-05")];
		const rows = packGanttRows(tasks);
		expect(rows).toBe(1);
		expect(tasks[0]._index).toBe(0);
	});
});
