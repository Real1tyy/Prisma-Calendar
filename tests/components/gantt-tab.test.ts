import type { GanttTask, PackedTask } from "@real1ty-obsidian-plugins";
import {
	centerViewportOnTasks,
	GANTT_DEFAULTS,
	layoutArrows,
	layoutBars,
	packRows,
	visualEndTime,
} from "@real1ty-obsidian-plugins";
import { describe, expect, it } from "vitest";

import { sanitizeGanttId } from "../../src/components/gantt";

function makeTask(id: string, start: string, end: string, deps: string[] = [], title = "Event"): GanttTask {
	return {
		id,
		title,
		startMs: new Date(start).getTime(),
		endMs: new Date(end).getTime(),
		dependencies: deps,
		filePath: `${id}.md`,
	};
}

function viewportForTasks(tasks: GanttTask[]) {
	return centerViewportOnTasks(tasks, 2000, 600, GANTT_DEFAULTS.pxPerDay);
}

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

describe("packRows", () => {
	it("returns empty array for no tasks", () => {
		expect(packRows([], GANTT_DEFAULTS)).toEqual([]);
	});

	it("packs independent non-overlapping tasks onto the same row", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-05"), makeTask("b", "2024-02-01", "2024-02-05")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed[0].row).toBe(0);
		expect(packed[1].row).toBe(0);
	});

	it("puts overlapping tasks on separate rows", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-05", "2024-01-15")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed[0].row).toBe(0);
		expect(packed[1].row).toBe(1);
	});

	it("respects dependency constraints — dependent on higher row", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-05"), makeTask("b", "2024-02-01", "2024-02-05", ["a"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const a = packed.find((t) => t.id === "a")!;
		const b = packed.find((t) => t.id === "b")!;
		expect(a.row).toBe(0);
		expect(b.row).toBe(1);
	});

	it("packs independent chains into shared rows", () => {
		const tasks = [
			makeTask("a1", "2024-01-01", "2024-01-05"),
			makeTask("a2", "2024-01-20", "2024-01-25", ["a1"]),
			makeTask("b1", "2024-03-01", "2024-03-05"),
			makeTask("b2", "2024-03-20", "2024-03-25", ["b1"]),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed.find((t) => t.id === "b1")!.row).toBe(0);
		expect(packed.find((t) => t.id === "b2")!.row).toBe(1);
	});

	it("keeps nearby short events on separate rows to avoid label overlap", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-02", [], "Weekly Cross-Team Planning And Alignment Session"),
			makeTask("b", "2024-01-02", "2024-01-03", [], "Quarterly Project Retrospective And Review Meeting"),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const rowCount = Math.max(...packed.map((t) => t.row)) + 1;
		expect(rowCount).toBe(2);
	});

	it("handles single task", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-05")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed.length).toBe(1);
		expect(packed[0].row).toBe(0);
	});
});

describe("visualEndTime", () => {
	it("returns bar end when bar is longer than label", () => {
		const task = makeTask("a", "2024-01-01", "2024-06-01", [], "Hi");
		expect(visualEndTime(task, GANTT_DEFAULTS)).toBe(task.endMs);
	});

	it("extends end for short bars with long labels", () => {
		const task = makeTask("a", "2024-01-01", "2024-01-02", [], "Long Event Title Here");
		expect(visualEndTime(task, GANTT_DEFAULTS)).toBeGreaterThan(task.endMs);
	});
});

describe("layoutBars", () => {
	it("computes correct positions from packed tasks", () => {
		const tasks = [makeTask("a", "2024-01-10", "2024-01-20")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);

		expect(bars.length).toBe(1);
		expect(bars[0].taskId).toBe("a");
		expect(bars[0].y).toBe(GANTT_DEFAULTS.rowPadding);
		expect(bars[0].height).toBe(GANTT_DEFAULTS.barHeight);
	});

	it("assigns different y values for different rows", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-05", "2024-01-15")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[0].y).not.toBe(bars[1].y);
	});

	it("enforces minimum bar width", () => {
		const now = Date.now();
		const task: GanttTask = {
			id: "tiny",
			title: "X",
			startMs: now,
			endMs: now + 1000,
			dependencies: [],
			filePath: "tiny.md",
		};
		const packed = packRows([task], GANTT_DEFAULTS);
		const vp = viewportForTasks([task]);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[0].width).toBeGreaterThanOrEqual(20);
	});
});

describe("layoutArrows", () => {
	it("computes path for simple dependency", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-15", "2024-01-25", ["a"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const barsMap = new Map(bars.map((b) => [b.taskId, b]));
		const arrows = layoutArrows(packed, barsMap, GANTT_DEFAULTS);

		expect(arrows.length).toBe(1);
		expect(arrows[0].fromTaskId).toBe("a");
		expect(arrows[0].toTaskId).toBe("b");
		expect(arrows[0].path).toContain("M ");
	});

	it("returns empty array when dependency bar is missing", () => {
		const task: PackedTask = {
			id: "b",
			title: "Event",
			startMs: new Date("2024-01-15").getTime(),
			endMs: new Date("2024-01-25").getTime(),
			dependencies: ["nonexistent"],
			filePath: "b.md",
			row: 0,
			visualEndMs: new Date("2024-01-25").getTime(),
		};
		const bars = new Map([["b", { taskId: "b", x: 100, y: 50, width: 80, height: 40 }]]);
		expect(layoutArrows([task], bars, GANTT_DEFAULTS)).toHaveLength(0);
	});

	it("returns empty array for tasks with no dependencies", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const barsMap = new Map(bars.map((b) => [b.taskId, b]));
		expect(layoutArrows(packed, barsMap, GANTT_DEFAULTS)).toHaveLength(0);
	});
});
