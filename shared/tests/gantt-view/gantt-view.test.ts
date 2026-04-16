import { describe, expect, it } from "vitest";

import { layoutArrows } from "../../src/components/gantt-view/arrow-layout";
import { layoutBars } from "../../src/components/gantt-view/bar-layout";
import type {
	BarLayout,
	GanttConfig,
	GanttTask,
	PackedTask,
	Viewport,
} from "../../src/components/gantt-view/gantt-types";
import { GANTT_DEFAULTS, MS_PER_DAY } from "../../src/components/gantt-view/gantt-types";
import { packRows, visualEndTime } from "../../src/components/gantt-view/row-packing";
import { buildViewport, centerViewportOnTasks } from "../../src/components/gantt-view/time-scale";

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

function toBarsMap(bars: BarLayout[]): Map<string, BarLayout> {
	return new Map(bars.map((b) => [b.taskId, b]));
}

function viewportForTasks(tasks: GanttTask[]): Viewport {
	return centerViewportOnTasks(tasks, 2000, 600, GANTT_DEFAULTS.pxPerDay);
}

// ─── buildViewport ───────────────────────────────────────────

describe("buildViewport", () => {
	it("toX maps startMs to 0", () => {
		const vp = buildViewport(1000000, 800, 600, 100);
		expect(vp.toX(vp.startMs)).toBe(0);
	});

	it("toX maps endMs to widthPx", () => {
		const vp = buildViewport(1000000, 800, 600, 100);
		expect(vp.toX(vp.endMs)).toBeCloseTo(vp.widthPx, 1);
	});

	it("toMs round-trips with toX", () => {
		const vp = buildViewport(1000000, 800, 600, 100);
		const midX = 400;
		const ms = vp.toMs(midX);
		expect(vp.toX(ms)).toBeCloseTo(midX, 5);
	});

	it("toWidth is linear — double duration = double width", () => {
		const vp = buildViewport(0, 800, 600, 100);
		const w1 = vp.toWidth(0, MS_PER_DAY);
		const w2 = vp.toWidth(0, 2 * MS_PER_DAY);
		expect(w2).toBeCloseTo(2 * w1, 5);
	});

	it("endMs covers the full viewport width", () => {
		const vp = buildViewport(0, 900, 600, 100);
		expect(vp.endMs - vp.startMs).toBeCloseTo(9 * MS_PER_DAY, -3);
	});

	it("toX returns negative for timestamps before startMs", () => {
		const vp = buildViewport(10 * MS_PER_DAY, 800, 600, 100);
		expect(vp.toX(5 * MS_PER_DAY)).toBeLessThan(0);
	});

	it("toX returns greater than widthPx for timestamps after endMs", () => {
		const vp = buildViewport(0, 800, 600, 100);
		expect(vp.toX(vp.endMs + MS_PER_DAY)).toBeGreaterThan(vp.widthPx);
	});

	it("toWidth returns pxPerDay for exactly one day", () => {
		const pxPerDay = 120;
		const vp = buildViewport(0, 800, 600, pxPerDay);
		expect(vp.toWidth(0, MS_PER_DAY)).toBeCloseTo(pxPerDay, 5);
	});

	it("preserves configured dimensions", () => {
		const vp = buildViewport(5000, 1200, 800, 150);
		expect(vp.widthPx).toBe(1200);
		expect(vp.heightPx).toBe(800);
		expect(vp.pxPerDay).toBe(150);
		expect(vp.startMs).toBe(5000);
	});

	it("toMs at x=0 returns startMs", () => {
		const vp = buildViewport(999999, 800, 600, 100);
		expect(vp.toMs(0)).toBe(999999);
	});

	it("toMs at x=widthPx returns endMs", () => {
		const vp = buildViewport(0, 800, 600, 100);
		expect(vp.toMs(vp.widthPx)).toBeCloseTo(vp.endMs, -3);
	});
});

describe("centerViewportOnTasks", () => {
	it("centers viewport on task data range", () => {
		const tasks = [makeTask("a", "2024-06-10", "2024-06-20")];
		const vp = centerViewportOnTasks(tasks, 1000, 600, 100);
		const dataCenter = (tasks[0].startMs + tasks[0].endMs) / 2;
		const vpCenter = (vp.startMs + vp.endMs) / 2;
		expect(Math.abs(vpCenter - dataCenter)).toBeLessThan(MS_PER_DAY);
	});

	it("centers on today when no tasks", () => {
		const vp = centerViewportOnTasks([], 1000, 600, 100);
		const now = Date.now();
		const vpCenter = (vp.startMs + vp.endMs) / 2;
		expect(Math.abs(vpCenter - now)).toBeLessThan(MS_PER_DAY);
	});

	it("centers on the midpoint of widely spread tasks", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-02"), makeTask("b", "2024-12-01", "2024-12-02")];
		const vp = centerViewportOnTasks(tasks, 1000, 600, 100);
		const dataCenter = (tasks[0].startMs + tasks[1].endMs) / 2;
		const vpCenter = (vp.startMs + vp.endMs) / 2;
		expect(Math.abs(vpCenter - dataCenter)).toBeLessThan(MS_PER_DAY);
	});

	it("viewport width matches requested widthPx", () => {
		const tasks = [makeTask("a", "2024-06-10", "2024-06-20")];
		const vp = centerViewportOnTasks(tasks, 1500, 600, 100);
		expect(vp.widthPx).toBe(1500);
	});
});

// ─── packRows ────────────────────────────────────────────────

describe("packRows", () => {
	it("returns empty array for empty input", () => {
		expect(packRows([], GANTT_DEFAULTS)).toEqual([]);
	});

	it("assigns row 0 to a single task", () => {
		const packed = packRows([makeTask("a", "2024-01-01", "2024-01-05")], GANTT_DEFAULTS);
		expect(packed[0].row).toBe(0);
	});

	it("packs non-overlapping tasks onto the same row", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-05"), makeTask("b", "2024-06-01", "2024-06-05")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed[0].row).toBe(0);
		expect(packed[1].row).toBe(0);
	});

	it("separates overlapping tasks into different rows", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-05", "2024-01-15")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed[0].row).toBe(0);
		expect(packed[1].row).toBe(1);
	});

	it("forces dependent task to higher row than prerequisite even if non-overlapping", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-05"), makeTask("b", "2024-06-01", "2024-06-05", ["a"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const a = packed.find((t) => t.id === "a")!;
		const b = packed.find((t) => t.id === "b")!;
		expect(b.row).toBeGreaterThan(a.row);
	});

	it("packs independent chains onto shared rows", () => {
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

	it("sorts by start time before packing", () => {
		const tasks = [makeTask("late", "2024-06-01", "2024-06-10"), makeTask("early", "2024-01-01", "2024-01-10")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed[0].id).toBe("early");
	});

	it("produces PackedTask with row and visualEndMs", () => {
		const packed = packRows([makeTask("a", "2024-01-01", "2024-01-10")], GANTT_DEFAULTS);
		expect(packed[0]).toHaveProperty("row");
		expect(packed[0]).toHaveProperty("visualEndMs");
		expect(packed[0].visualEndMs).toBeGreaterThanOrEqual(packed[0].endMs);
	});

	it("handles deep dependency chain — each level gets a new row", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-05"),
			makeTask("b", "2024-02-01", "2024-02-05", ["a"]),
			makeTask("c", "2024-03-01", "2024-03-05", ["b"]),
			makeTask("d", "2024-04-01", "2024-04-05", ["c"]),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed.find((t) => t.id === "a")!.row).toBe(0);
		expect(packed.find((t) => t.id === "b")!.row).toBe(1);
		expect(packed.find((t) => t.id === "c")!.row).toBe(2);
		expect(packed.find((t) => t.id === "d")!.row).toBe(3);
	});

	it("handles fan-out — multiple dependents of the same prereq", () => {
		const tasks = [
			makeTask("root", "2024-01-01", "2024-01-05"),
			makeTask("c1", "2024-02-01", "2024-02-05", ["root"]),
			makeTask("c2", "2024-03-01", "2024-03-05", ["root"]),
			makeTask("c3", "2024-04-01", "2024-04-05", ["root"]),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed.find((t) => t.id === "root")!.row).toBe(0);
		const childRows = ["c1", "c2", "c3"].map((id) => packed.find((t) => t.id === id)!.row);
		childRows.forEach((r) => expect(r).toBeGreaterThan(0));
	});

	it("handles fan-in — task with multiple prerequisites", () => {
		const tasks = [
			makeTask("p1", "2024-01-01", "2024-01-05"),
			makeTask("p2", "2024-01-01", "2024-01-05"),
			makeTask("p3", "2024-01-01", "2024-01-05"),
			makeTask("merge", "2024-02-01", "2024-02-05", ["p1", "p2", "p3"]),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const mergeRow = packed.find((t) => t.id === "merge")!.row;
		const maxPrereqRow = Math.max(...["p1", "p2", "p3"].map((id) => packed.find((t) => t.id === id)!.row));
		expect(mergeRow).toBeGreaterThan(maxPrereqRow);
	});

	it("does not mutate input array", () => {
		const tasks = [makeTask("b", "2024-06-01", "2024-06-10"), makeTask("a", "2024-01-01", "2024-01-10")];
		const original = [...tasks];
		packRows(tasks, GANTT_DEFAULTS);
		expect(tasks[0].id).toBe(original[0].id);
		expect(tasks[1].id).toBe(original[1].id);
	});

	it("handles tasks with identical start times", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-10"),
			makeTask("b", "2024-01-01", "2024-01-10"),
			makeTask("c", "2024-01-01", "2024-01-10"),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const rows = new Set(packed.map((t) => t.row));
		expect(rows.size).toBe(3);
	});

	it("reuses rows after gaps in timeline", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-05"),
			makeTask("b", "2024-01-01", "2024-01-05"),
			makeTask("c", "2024-06-01", "2024-06-05"),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed.find((t) => t.id === "c")!.row).toBe(0);
	});

	it("handles dependency on a task that does not exist in the list", () => {
		const tasks = [makeTask("orphan", "2024-01-01", "2024-01-05", ["nonexistent"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed[0].row).toBe(0);
	});

	it("label overlap prevents row sharing for nearby short tasks", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-02", [], "Weekly Cross-Team Planning And Alignment Session"),
			makeTask("b", "2024-01-02", "2024-01-03", [], "Quarterly Project Retrospective And Review Meeting"),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed[0].row).not.toBe(packed[1].row);
	});

	it("packs many independent tasks onto minimal rows", () => {
		const tasks = Array.from({ length: 20 }, (_, i) =>
			makeTask(`t${i}`, `2024-${String(i + 1).padStart(2, "0")}-01`, `2024-${String(i + 1).padStart(2, "0")}-02`)
		);
		const packed = packRows(tasks.slice(0, 12), GANTT_DEFAULTS);
		const maxRow = Math.max(...packed.map((t) => t.row));
		expect(maxRow).toBe(0);
	});
});

// ─── visualEndTime ───────────────────────────────────────────

describe("visualEndTime", () => {
	it("returns endMs when bar is longer than label", () => {
		const task = makeTask("a", "2024-01-01", "2024-12-31", [], "Hi");
		expect(visualEndTime(task, GANTT_DEFAULTS)).toBe(task.endMs);
	});

	it("extends past endMs for short bars with long labels", () => {
		const task = makeTask("a", "2024-01-01", "2024-01-02", [], "A Very Long Event Title That Extends");
		expect(visualEndTime(task, GANTT_DEFAULTS)).toBeGreaterThan(task.endMs);
	});

	it("uses config.labelCharWidth and config.pxPerDay", () => {
		const task = makeTask("a", "2024-01-01", "2024-01-02", [], "ABCD");
		const narrowConfig: GanttConfig = { ...GANTT_DEFAULTS, labelCharWidth: 100, pxPerDay: 50 };
		const wideConfig: GanttConfig = { ...GANTT_DEFAULTS, labelCharWidth: 1, pxPerDay: 500 };
		expect(visualEndTime(task, narrowConfig)).toBeGreaterThan(visualEndTime(task, wideConfig));
	});

	it("returns endMs for empty title", () => {
		const task = makeTask("a", "2024-01-01", "2024-01-10", [], "");
		expect(visualEndTime(task, GANTT_DEFAULTS)).toBe(task.endMs);
	});

	it("extends proportionally to title length", () => {
		const short = makeTask("a", "2024-01-01", "2024-01-02", [], "ABC");
		const long = makeTask("b", "2024-01-01", "2024-01-02", [], "ABCDEF");
		expect(visualEndTime(long, GANTT_DEFAULTS)).toBeGreaterThanOrEqual(visualEndTime(short, GANTT_DEFAULTS));
	});

	it("never returns less than endMs", () => {
		const task = makeTask("a", "2024-01-01", "2024-12-31", [], "X".repeat(100));
		expect(visualEndTime(task, GANTT_DEFAULTS)).toBeGreaterThanOrEqual(task.endMs);
	});
});

// ─── layoutBars ──────────────────────────────────────────────

describe("layoutBars", () => {
	it("positions first bar at rowPadding y-offset", () => {
		const tasks = [makeTask("a", "2024-01-10", "2024-01-20")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);

		expect(bars[0].y).toBe(GANTT_DEFAULTS.rowPadding);
		expect(bars[0].height).toBe(GANTT_DEFAULTS.barHeight);
	});

	it("staggers y-position for tasks on different rows", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-05", "2024-01-15")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[0].y).not.toBe(bars[1].y);
		const expectedRow1Y = GANTT_DEFAULTS.rowPadding + GANTT_DEFAULTS.barHeight + GANTT_DEFAULTS.rowPadding;
		expect(bars[1].y).toBe(expectedRow1Y);
	});

	it("short titles get compact bars", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10", [], "Walk")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const expectedWidth = "Walk".length * GANTT_DEFAULTS.labelCharWidth + 20;
		expect(bars[0].width).toBe(expectedWidth);
	});

	it("long titles are capped at max width", () => {
		const title = "A Very Long Event Title That Should Be Capped";
		const tasks = [makeTask("a", "2024-01-01", "2024-03-01", [], title)];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[0].width).toBe(180);
	});

	it("long titles produce wider bars than short titles", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-10", [], "Walk"),
			makeTask("b", "2024-03-01", "2024-03-10", [], "Focus Session"),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[1].width).toBeGreaterThan(bars[0].width);
	});

	it("x position reflects task startMs relative to viewport", () => {
		const tasks = [makeTask("a", "2024-06-15", "2024-06-20")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[0].x).toBeCloseTo(vp.toX(tasks[0].startMs), 1);
	});

	it("produces one BarLayout per PackedTask", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-05"), makeTask("b", "2024-02-01", "2024-02-05")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars).toHaveLength(2);
	});

	it("all bars on the same row share the same y", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-05"), makeTask("b", "2024-06-01", "2024-06-05")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[0].y).toBe(bars[1].y);
	});

	it("single char title gets small bar", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-03", [], "X")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars[0].width).toBe(1 * GANTT_DEFAULTS.labelCharWidth + 20);
	});

	it("row spacing formula is consistent: y = rowPadding + row * (barHeight + rowPadding)", () => {
		const tasks = Array.from({ length: 5 }, (_, i) =>
			makeTask(`t${i}`, "2024-01-01", "2024-01-10", i > 0 ? [`t${i - 1}`] : [])
		);
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		for (const bar of bars) {
			const task = packed.find((t) => t.id === bar.taskId)!;
			const expectedY = GANTT_DEFAULTS.rowPadding + task.row * (GANTT_DEFAULTS.barHeight + GANTT_DEFAULTS.rowPadding);
			expect(bar.y).toBe(expectedY);
		}
	});
});

// ─── layoutArrows ────────────────────────────────────────────

describe("layoutArrows", () => {
	it("produces arrow for a simple dependency", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-15", "2024-01-25", ["a"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const arrows = layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS);

		expect(arrows).toHaveLength(1);
		expect(arrows[0].fromTaskId).toBe("a");
		expect(arrows[0].toTaskId).toBe("b");
		expect(arrows[0].path).toMatch(/^M /);
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

	it("returns empty for tasks with no dependencies", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10")];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS)).toHaveLength(0);
	});

	it("handles multiple dependencies on one task", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-05"),
			makeTask("b", "2024-01-01", "2024-01-05"),
			makeTask("c", "2024-01-10", "2024-01-15", ["a", "b"]),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS)).toHaveLength(2);
	});

	it("produces wrap-around path when target is left of source", () => {
		const fromBar: BarLayout = { taskId: "a", x: 500, y: 16, width: 100, height: 40 };
		const toBar: BarLayout = { taskId: "b", x: 100, y: 72, width: 80, height: 40 };
		const task: PackedTask = {
			id: "b",
			title: "Event",
			startMs: 0,
			endMs: MS_PER_DAY,
			dependencies: ["a"],
			filePath: "b.md",
			row: 1,
			visualEndMs: MS_PER_DAY,
		};
		const bars = new Map<string, BarLayout>([
			["a", fromBar],
			["b", toBar],
		]);
		const arrows = layoutArrows([task], bars, GANTT_DEFAULTS);
		expect(arrows).toHaveLength(1);
		expect(arrows[0].path).toContain("V");
	});

	it("arrow starts at right edge of source bar", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-20", "2024-01-25", ["a"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const barA = bars.find((b) => b.taskId === "a")!;
		const arrows = layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS);
		const pathStart = arrows[0].path.match(/^M (\S+),(\S+)/);
		expect(Number(pathStart![1])).toBeCloseTo(barA.x + barA.width, 1);
	});

	it("arrow ends at left edge of target bar", () => {
		const tasks = [makeTask("a", "2024-01-01", "2024-01-10"), makeTask("b", "2024-01-20", "2024-01-25", ["a"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const barB = bars.find((b) => b.taskId === "b")!;
		const arrows = layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS);
		const lastH = arrows[0].path.match(/H (\S+)$/);
		expect(Number(lastH![1])).toBeCloseTo(barB.x, 1);
	});

	it("forward path uses rounded corners when dy is large enough", () => {
		const fromBar: BarLayout = { taskId: "a", x: 100, y: 16, width: 80, height: 40 };
		const toBar: BarLayout = { taskId: "b", x: 300, y: 200, width: 80, height: 40 };
		const task: PackedTask = {
			id: "b",
			title: "Event",
			startMs: 0,
			endMs: MS_PER_DAY,
			dependencies: ["a"],
			filePath: "b.md",
			row: 3,
			visualEndMs: MS_PER_DAY,
		};
		const bars = new Map<string, BarLayout>([
			["a", fromBar],
			["b", toBar],
		]);
		const arrows = layoutArrows([task], bars, GANTT_DEFAULTS);
		expect(arrows[0].path).toContain("a ");
	});

	it("forward path uses straight segments when dy is small", () => {
		const fromBar: BarLayout = { taskId: "a", x: 100, y: 16, width: 80, height: 40 };
		const toBar: BarLayout = { taskId: "b", x: 300, y: 20, width: 80, height: 40 };
		const task: PackedTask = {
			id: "b",
			title: "Event",
			startMs: 0,
			endMs: MS_PER_DAY,
			dependencies: ["a"],
			filePath: "b.md",
			row: 0,
			visualEndMs: MS_PER_DAY,
		};
		const bars = new Map<string, BarLayout>([
			["a", fromBar],
			["b", toBar],
		]);
		const arrows = layoutArrows([task], bars, GANTT_DEFAULTS);
		expect(arrows[0].path).not.toContain("a ");
	});

	it("produces correct count for diamond dependency pattern", () => {
		const tasks = [
			makeTask("root", "2024-01-01", "2024-01-05"),
			makeTask("left", "2024-01-10", "2024-01-15", ["root"]),
			makeTask("right", "2024-01-10", "2024-01-15", ["root"]),
			makeTask("merge", "2024-01-20", "2024-01-25", ["left", "right"]),
		];
		const packed = packRows(tasks, GANTT_DEFAULTS);
		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const arrows = layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS);
		expect(arrows).toHaveLength(4);
	});
});

// ─── Integration: full pipeline ──────────────────────────────

describe("full pipeline integration", () => {
	it("processes a chain of 3 tasks end-to-end", () => {
		const tasks = [
			makeTask("a", "2024-01-01", "2024-01-05"),
			makeTask("b", "2024-01-10", "2024-01-15", ["a"]),
			makeTask("c", "2024-01-20", "2024-01-25", ["b"]),
		];

		const packed = packRows(tasks, GANTT_DEFAULTS);
		expect(packed.find((t) => t.id === "a")!.row).toBe(0);
		expect(packed.find((t) => t.id === "b")!.row).toBe(1);
		expect(packed.find((t) => t.id === "c")!.row).toBe(2);

		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		expect(bars).toHaveLength(3);

		const arrows = layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS);
		expect(arrows).toHaveLength(2);
	});

	it("handles diamond dependency pattern", () => {
		const tasks = [
			makeTask("root", "2024-01-01", "2024-01-05"),
			makeTask("left", "2024-01-10", "2024-01-15", ["root"]),
			makeTask("right", "2024-01-10", "2024-01-15", ["root"]),
			makeTask("merge", "2024-01-20", "2024-01-25", ["left", "right"]),
		];

		const packed = packRows(tasks, GANTT_DEFAULTS);
		const root = packed.find((t) => t.id === "root")!;
		const merge = packed.find((t) => t.id === "merge")!;
		expect(merge.row).toBeGreaterThan(root.row);

		const vp = viewportForTasks(tasks);
		const bars = layoutBars(packed, vp, GANTT_DEFAULTS);
		const arrows = layoutArrows(packed, toBarsMap(bars), GANTT_DEFAULTS);
		expect(arrows).toHaveLength(4);
	});

	it("bar ordering is consistent across viewport positions", () => {
		const tasks = [makeTask("a", "2024-06-01", "2024-06-05"), makeTask("b", "2024-06-10", "2024-06-15", ["a"])];
		const packed = packRows(tasks, GANTT_DEFAULTS);

		const vp1 = buildViewport(new Date("2024-05-01").getTime(), 2000, 600, GANTT_DEFAULTS.pxPerDay);
		const vp2 = buildViewport(new Date("2024-07-01").getTime(), 2000, 600, GANTT_DEFAULTS.pxPerDay);

		const bars1 = layoutBars(packed, vp1, GANTT_DEFAULTS);
		const bars2 = layoutBars(packed, vp2, GANTT_DEFAULTS);

		expect(bars1[0].y).toBe(bars2[0].y);
		expect(bars1[1].y).toBe(bars2[1].y);
		expect(bars1[0].width).toBeCloseTo(bars2[0].width, 1);
	});

	it("viewport panning shifts x positions but preserves relative layout", () => {
		const tasks = [makeTask("a", "2024-06-01", "2024-06-05"), makeTask("b", "2024-06-10", "2024-06-15")];
		const packed = packRows(tasks, GANTT_DEFAULTS);

		const vp1 = buildViewport(new Date("2024-05-15").getTime(), 1000, 600, GANTT_DEFAULTS.pxPerDay);
		const vp2 = buildViewport(new Date("2024-05-20").getTime(), 1000, 600, GANTT_DEFAULTS.pxPerDay);

		const bars1 = layoutBars(packed, vp1, GANTT_DEFAULTS);
		const bars2 = layoutBars(packed, vp2, GANTT_DEFAULTS);

		const gap1 = bars1[1].x - bars1[0].x;
		const gap2 = bars2[1].x - bars2[0].x;
		expect(gap1).toBeCloseTo(gap2, 1);
	});
});
