import { describe, expect, it, vi } from "vitest";

import { redo, undo } from "../../src/core/api/read-operations";
import type CustomCalendarPlugin from "../../src/main";

interface FakeBundleOptions {
	calendarId: string;
	canUndo?: boolean;
	canRedo?: boolean;
	activityOrder?: number;
}

function createFakeBundle({ calendarId, canUndo = false, canRedo = false, activityOrder = 0 }: FakeBundleOptions) {
	return {
		calendarId,
		undo: vi.fn().mockResolvedValue(true),
		redo: vi.fn().mockResolvedValue(true),
		commandManager: {
			canUndo: () => canUndo,
			canRedo: () => canRedo,
			lastActivityOrder: activityOrder,
		},
	};
}

function createFakePlugin(bundles: ReturnType<typeof createFakeBundle>[], lastUsedCalendarId: string | null = null) {
	return { calendarBundles: bundles, lastUsedCalendarId } as unknown as CustomCalendarPlugin;
}

describe("undo / redo bundle resolution", () => {
	it("undoes the only calendar that has history", async () => {
		const bundle = createFakeBundle({ calendarId: "a", canUndo: true, activityOrder: 1 });
		const plugin = createFakePlugin([bundle], "a");

		await expect(undo(plugin)).resolves.toBe(true);
		expect(bundle.undo).toHaveBeenCalledTimes(1);
	});

	it("undoes the source calendar after a move flips last-used to the destination", async () => {
		// moveEventToCalendar records the command on the source's stack but sets
		// the destination as last-used. The destination has no history, so
		// resolving by last-used alone would wrongly report "Nothing to undo".
		const source = createFakeBundle({ calendarId: "source", canUndo: true, activityOrder: 5 });
		const destination = createFakeBundle({ calendarId: "destination", canUndo: false, activityOrder: 0 });
		const plugin = createFakePlugin([source, destination], "destination");

		await expect(undo(plugin)).resolves.toBe(true);

		expect(source.undo).toHaveBeenCalledTimes(1);
		expect(destination.undo).not.toHaveBeenCalled();
	});

	it("returns false without touching any calendar when nothing can be undone", async () => {
		const a = createFakeBundle({ calendarId: "a", canUndo: false });
		const b = createFakeBundle({ calendarId: "b", canUndo: false });
		const plugin = createFakePlugin([a, b], "a");

		await expect(undo(plugin)).resolves.toBe(false);
		expect(a.undo).not.toHaveBeenCalled();
		expect(b.undo).not.toHaveBeenCalled();
	});

	it("undoes the most recently mutated calendar when several have history", async () => {
		const older = createFakeBundle({ calendarId: "older", canUndo: true, activityOrder: 2 });
		const newer = createFakeBundle({ calendarId: "newer", canUndo: true, activityOrder: 9 });
		const plugin = createFakePlugin([older, newer], "older");

		await undo(plugin);

		expect(newer.undo).toHaveBeenCalledTimes(1);
		expect(older.undo).not.toHaveBeenCalled();
	});

	it("breaks ties toward the last-used calendar", async () => {
		const a = createFakeBundle({ calendarId: "a", canUndo: true, activityOrder: 4 });
		const b = createFakeBundle({ calendarId: "b", canUndo: true, activityOrder: 4 });
		const plugin = createFakePlugin([a, b], "b");

		await undo(plugin);

		expect(b.undo).toHaveBeenCalledTimes(1);
		expect(a.undo).not.toHaveBeenCalled();
	});

	it("redoes the most recently mutated calendar that has a redo stack", async () => {
		const source = createFakeBundle({ calendarId: "source", canRedo: true, activityOrder: 7 });
		const destination = createFakeBundle({ calendarId: "destination", canRedo: false, activityOrder: 0 });
		const plugin = createFakePlugin([source, destination], "destination");

		await expect(redo(plugin)).resolves.toBe(true);

		expect(source.redo).toHaveBeenCalledTimes(1);
		expect(destination.redo).not.toHaveBeenCalled();
	});
});
