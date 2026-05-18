import { describe, expect, it } from "vitest";

import {
	buildState,
	getActiveChild,
	initialGroupChildState,
	moveItem,
	recalcActiveChildIndex,
	reorderList,
	resolveVisibleTabs,
	type GroupChildState,
} from "../../../src/views/tabbed-container/reorder";
import type { GroupTabDefinition, TabDefinition, TabEntry } from "../../../src/views/tabbed-container/types";

const tab = (id: string, label = id): TabDefinition => ({ id, label, content: null });
const group = (id: string, children: TabDefinition[]): GroupTabDefinition => ({ id, label: id, children });

describe("reorderList", () => {
	it("moves the dragged item before the target", () => {
		const out = reorderList([tab("a"), tab("b"), tab("c")], "a", "c");
		expect(out.map((t) => t.id)).toEqual(["b", "c", "a"]);
	});

	it("returns the original array when fromId is unknown", () => {
		const items = [tab("a"), tab("b")];
		expect(reorderList(items, "missing", "a")).toBe(items);
	});

	it("returns the original array when toId is unknown", () => {
		const items = [tab("a"), tab("b")];
		expect(reorderList(items, "a", "missing")).toBe(items);
	});
});

describe("moveItem", () => {
	it("moves an item right by one slot", () => {
		const out = moveItem([tab("a"), tab("b"), tab("c")], "a", 1);
		expect(out.map((t) => t.id)).toEqual(["b", "a", "c"]);
	});

	it("moves an item left by one slot", () => {
		const out = moveItem([tab("a"), tab("b"), tab("c")], "c", -1);
		expect(out.map((t) => t.id)).toEqual(["a", "c", "b"]);
	});

	it("returns the original array at left boundary", () => {
		const items = [tab("a"), tab("b")];
		expect(moveItem(items, "a", -1)).toBe(items);
	});

	it("returns the original array at right boundary", () => {
		const items = [tab("a"), tab("b")];
		expect(moveItem(items, "b", 1)).toBe(items);
	});
});

describe("recalcActiveChildIndex", () => {
	it("returns the index of the previous active id", () => {
		expect(recalcActiveChildIndex([tab("a"), tab("b"), tab("c")], "c")).toBe(2);
	});

	it("falls back to 0 when previous active id is missing", () => {
		expect(recalcActiveChildIndex([tab("a"), tab("b")], "missing")).toBe(0);
	});

	it("falls back to 0 when previousActiveId is undefined", () => {
		expect(recalcActiveChildIndex([tab("a")], undefined)).toBe(0);
	});
});

describe("initialGroupChildState", () => {
	it("uses all children when no saved state is present", () => {
		const g = group("g", [tab("c0"), tab("c1")]);
		const s = initialGroupChildState(g, undefined);
		expect(s.visibleChildren.map((c) => c.id)).toEqual(["c0", "c1"]);
		expect(s.activeChildIndex).toBe(0);
		expect(s.childRenames).toEqual({});
	});

	it("restores visibility order from saved visibleChildIds", () => {
		const g = group("g", [tab("c0"), tab("c1"), tab("c2")]);
		const s = initialGroupChildState(g, { visibleChildIds: ["c2", "c0"] });
		expect(s.visibleChildren.map((c) => c.id)).toEqual(["c2", "c0"]);
	});

	it("falls back to all children when saved visibleChildIds resolve to nothing", () => {
		const g = group("g", [tab("c0")]);
		const s = initialGroupChildState(g, { visibleChildIds: ["unknown"] });
		expect(s.visibleChildren.map((c) => c.id)).toEqual(["c0"]);
	});

	it("loads saved renames and overrides as fresh records", () => {
		const g = group("g", [tab("c0")]);
		const saved = {
			childRenames: { c0: "Renamed" },
			childIconOverrides: { c0: "heart" },
			childColorOverrides: { c0: "#ff0000" },
		};
		const s = initialGroupChildState(g, saved);
		expect(s.childRenames).toEqual({ c0: "Renamed" });
		expect(s.childIconOverrides).toEqual({ c0: "heart" });
		expect(s.childColorOverrides).toEqual({ c0: "#ff0000" });
		// Defensive copy: source records are not aliased.
		s.childRenames["c0"] = "Mutated";
		expect(saved.childRenames.c0).toBe("Renamed");
	});
});

describe("getActiveChild", () => {
	it("returns plain tabs unchanged", () => {
		const t = tab("a");
		expect(getActiveChild(t, new Map())).toBe(t);
	});

	it("returns the active child of a group based on group state", () => {
		const g = group("g", [tab("c0"), tab("c1")]);
		const states = new Map<string, GroupChildState>([
			[
				"g",
				{
					visibleChildren: g.children,
					activeChildIndex: 1,
					childRenames: {},
					childIconOverrides: {},
					childColorOverrides: {},
				},
			],
		]);
		expect(getActiveChild(g, states).id).toBe("c1");
	});

	it("falls back to the first child when no group state exists", () => {
		const g = group("g", [tab("c0"), tab("c1")]);
		expect(getActiveChild(g, new Map()).id).toBe("c0");
	});
});

describe("resolveVisibleTabs", () => {
	it("returns all tabs when no initial state is provided", () => {
		const tabs: TabEntry[] = [tab("a"), tab("b")];
		const out = resolveVisibleTabs(tabs, undefined);
		expect(out.visibleTabs).toBe(tabs);
		expect(out.showSettingsButton).toBe(true);
	});

	it("respects visibleTabIds order", () => {
		const tabs: TabEntry[] = [tab("a"), tab("b"), tab("c")];
		const out = resolveVisibleTabs(tabs, { visibleTabIds: ["c", "a"] });
		expect(out.visibleTabs.map((t) => t.id)).toEqual(["c", "a"]);
	});

	it("falls back to all tabs when visibleTabIds resolve to nothing", () => {
		const tabs: TabEntry[] = [tab("a")];
		const out = resolveVisibleTabs(tabs, { visibleTabIds: ["unknown"] });
		expect(out.visibleTabs.map((t) => t.id)).toEqual(["a"]);
	});

	it("treats showSettingsButton: false as opt-out", () => {
		const out = resolveVisibleTabs([tab("a")], { showSettingsButton: false });
		expect(out.showSettingsButton).toBe(false);
	});
});

describe("buildState", () => {
	const baseInput = {
		allTabs: [tab("a"), tab("b")] as TabEntry[],
		visibleTabs: [tab("a"), tab("b")] as TabEntry[],
		renames: {},
		iconOverrides: {},
		colorOverrides: {},
		showSettingsButton: true,
		groupStates: new Map<string, GroupChildState>(),
	};

	it("omits empty fields", () => {
		const state = buildState(baseInput);
		expect(state.renames).toBeUndefined();
		expect(state.iconOverrides).toBeUndefined();
		expect(state.colorOverrides).toBeUndefined();
		expect(state.visibleTabIds).toBeUndefined();
		expect(state.showSettingsButton).toBeUndefined();
	});

	it("emits visibleTabIds when order differs from default", () => {
		const state = buildState({ ...baseInput, visibleTabs: [tab("b"), tab("a")] });
		expect(state.visibleTabIds).toEqual(["b", "a"]);
	});

	it("emits visibleTabIds when a tab is hidden", () => {
		const state = buildState({ ...baseInput, visibleTabs: [tab("a")] });
		expect(state.visibleTabIds).toEqual(["a"]);
	});

	it("includes renames/icon/color overrides when present", () => {
		const state = buildState({
			...baseInput,
			renames: { a: "Alpha" },
			iconOverrides: { a: "heart" },
			colorOverrides: { a: "#ff0000" },
		});
		expect(state.renames).toEqual({ a: "Alpha" });
		expect(state.iconOverrides).toEqual({ a: "heart" });
		expect(state.colorOverrides).toEqual({ a: "#ff0000" });
	});

	it("emits showSettingsButton: false only when opted out", () => {
		expect(buildState({ ...baseInput, showSettingsButton: false }).showSettingsButton).toBe(false);
	});

	it("includes groupState for groups with non-default child state", () => {
		const g = group("g", [tab("c0"), tab("c1")]);
		const groupStates = new Map<string, GroupChildState>([
			[
				"g",
				{
					visibleChildren: [tab("c1"), tab("c0")],
					activeChildIndex: 0,
					childRenames: { c0: "Custom" },
					childIconOverrides: {},
					childColorOverrides: {},
				},
			],
		]);
		const state = buildState({
			...baseInput,
			allTabs: [g],
			visibleTabs: [g],
			groupStates,
		});
		expect(state.groupState?.g?.visibleChildIds).toEqual(["c1", "c0"]);
		expect(state.groupState?.g?.childRenames).toEqual({ c0: "Custom" });
	});

	it("omits groupState when nothing is overridden", () => {
		const g = group("g", [tab("c0")]);
		const groupStates = new Map<string, GroupChildState>([
			[
				"g",
				{
					visibleChildren: g.children,
					activeChildIndex: 0,
					childRenames: {},
					childIconOverrides: {},
					childColorOverrides: {},
				},
			],
		]);
		const state = buildState({ ...baseInput, allTabs: [g], visibleTabs: [g], groupStates });
		expect(state.groupState).toBeUndefined();
	});
});
