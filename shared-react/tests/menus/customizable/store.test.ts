import { describe, expect, it, vi } from "vitest";

import { CustomizableMenuStore } from "../../../src/menus/customizable/store";
import type { ContextMenuState, CustomizableContextMenuItem } from "../../../src/menus/customizable/types";

function makeItems(count = 5, sectionPattern?: string[]): CustomizableContextMenuItem[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `item-${i}`,
		label: `Item ${i}`,
		icon: `icon-${i}`,
		...(sectionPattern ? { section: sectionPattern[i % sectionPattern.length] } : {}),
		onAction: vi.fn(),
	}));
}

function makeStore(
	opts: {
		items?: CustomizableContextMenuItem[];
		initialState?: ContextMenuState;
		onStateChange?: (s: ContextMenuState) => void;
	} = {}
): CustomizableMenuStore {
	return new CustomizableMenuStore({
		allItems: opts.items ?? makeItems(),
		initialState: opts.initialState,
		onStateChange: opts.onStateChange,
	});
}

describe("CustomizableMenuStore", () => {
	describe("initial state", () => {
		it("starts with all items visible by default", () => {
			const store = makeStore();
			expect(store.visibleCount).toBe(5);
			expect(store.getSnapshot().showSettingsButton).toBe(true);
		});

		it("returns minimal state when no overrides exist", () => {
			const state = makeStore().getState();
			expect(state.visibleItemIds).toBeUndefined();
			expect(state.renames).toBeUndefined();
			expect(state.iconOverrides).toBeUndefined();
			expect(state.colorOverrides).toBeUndefined();
			expect(state.sectionOverrides).toBeUndefined();
			expect(state.showSettingsButton).toBeUndefined();
		});

		it("only includes showSettingsButton when explicitly false", () => {
			const onTrue = makeStore({ initialState: { showSettingsButton: true } }).getState();
			expect(onTrue.showSettingsButton).toBeUndefined();

			const onFalse = makeStore({ initialState: { showSettingsButton: false } }).getState();
			expect(onFalse.showSettingsButton).toBe(false);
		});
	});

	describe("hideItem", () => {
		it("reduces visible count and emits state", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });

			store.hideItem("item-0");
			expect(store.visibleCount).toBe(4);
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ visibleItemIds: ["item-1", "item-2", "item-3", "item-4"] })
			);
		});

		it("is a no-op when only one item visible", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ items: makeItems(1), onStateChange });

			store.hideItem("item-0");
			expect(store.visibleCount).toBe(1);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("is a no-op for non-existent item ID", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });

			store.hideItem("nope");
			expect(store.visibleCount).toBe(5);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("can hide multiple items down to a minimum of one", () => {
			const store = makeStore();
			store.hideItem("item-0");
			store.hideItem("item-1");
			store.hideItem("item-2");
			store.hideItem("item-3");
			expect(store.visibleCount).toBe(1);

			store.hideItem("item-4");
			expect(store.visibleCount).toBe(1);
		});
	});

	describe("restoreItem", () => {
		it("brings back a hidden item", () => {
			const store = makeStore();
			store.hideItem("item-0");
			store.restoreItem("item-0");
			expect(store.visibleCount).toBe(5);
		});

		it("is a no-op for already-visible item", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });
			store.restoreItem("item-0");
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("is a no-op for unknown ID", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });
			store.restoreItem("nope");
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("appends restored item to end of list when no sections", () => {
			const store = makeStore();
			store.hideItem("item-1");
			store.restoreItem("item-1");
			expect(store.getState().visibleItemIds).toEqual(["item-0", "item-2", "item-3", "item-4", "item-1"]);
		});
	});

	describe("moveItem", () => {
		it("swaps order forward", () => {
			const store = makeStore();
			store.moveItem("item-0", 1);
			expect(store.getState().visibleItemIds).toEqual(["item-1", "item-0", "item-2", "item-3", "item-4"]);
		});

		it("swaps order backward", () => {
			const store = makeStore();
			store.moveItem("item-2", -1);
			expect(store.getState().visibleItemIds).toEqual(["item-0", "item-2", "item-1", "item-3", "item-4"]);
		});

		it("is a no-op moving first up", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });
			store.moveItem("item-0", -1);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("is a no-op moving last down", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });
			store.moveItem("item-4", 1);
			expect(onStateChange).not.toHaveBeenCalled();
		});
	});

	describe("section-aware behavior", () => {
		const items: CustomizableContextMenuItem[] = [
			{ id: "nav-0", label: "Nav 0", icon: "icon-0", section: "navigation", onAction: vi.fn() },
			{ id: "nav-1", label: "Nav 1", icon: "icon-1", section: "navigation", onAction: vi.fn() },
			{ id: "edit-0", label: "Edit 0", icon: "icon-2", section: "edit", onAction: vi.fn() },
			{ id: "edit-1", label: "Edit 1", icon: "icon-3", section: "edit", onAction: vi.fn() },
			{ id: "edit-2", label: "Edit 2", icon: "icon-4", section: "edit", onAction: vi.fn() },
			{ id: "danger-0", label: "Danger 0", icon: "icon-5", section: "danger", onAction: vi.fn() },
		];

		it("moveItem only moves within the same section", () => {
			const store = makeStore({ items });
			store.moveItem("edit-0", 1);
			expect(store.getState().visibleItemIds).toEqual(["nav-0", "nav-1", "edit-1", "edit-0", "edit-2", "danger-0"]);
		});

		it("moveItem cannot cross section going down", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ items, onStateChange });
			store.moveItem("nav-1", 1);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("moveItem cannot cross section going up", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ items, onStateChange });
			store.moveItem("edit-0", -1);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("restored item lands at end of its section", () => {
			const store = makeStore({ items });
			store.hideItem("nav-0");
			store.restoreItem("nav-0");
			expect(store.getState().visibleItemIds).toEqual(["nav-1", "nav-0", "edit-0", "edit-1", "edit-2", "danger-0"]);
		});

		it("moveItemToSection moves item to a new section and records override", () => {
			const store = makeStore({ items });
			store.moveItemToSection("nav-0", "danger");
			const state = store.getState();
			expect(state.sectionOverrides).toEqual({ "nav-0": "danger" });
			expect(state.visibleItemIds?.indexOf("nav-0")).toBe(state.visibleItemIds!.length - 1);
		});

		it("moveItemToSection back to default section clears the override", () => {
			const store = makeStore({
				items,
				initialState: { sectionOverrides: { "nav-0": "danger" } },
			});
			store.moveItemToSection("nav-0", "navigation");
			expect(store.getState().sectionOverrides).toBeUndefined();
		});

		it("sectionOverrides absent when no reassignment", () => {
			expect(makeStore({ items }).getState().sectionOverrides).toBeUndefined();
		});
	});

	describe("rename / icon / color overrides", () => {
		it("setRename writes when label differs and clears when reset", () => {
			const store = makeStore();
			store.setRename("item-0", "Custom");
			expect(store.getState().renames).toEqual({ "item-0": "Custom" });
			store.setRename("item-0", undefined);
			expect(store.getState().renames).toBeUndefined();
		});

		it("setRename is a no-op when label equals original (no override stored)", () => {
			const store = makeStore();
			store.setRename("item-0", "Item 0");
			expect(store.getState().renames).toBeUndefined();
		});

		it("setIcon writes only when different from default", () => {
			const store = makeStore();
			store.setIcon("item-0", "icon-0"); // matches default → no override
			expect(store.getState().iconOverrides).toBeUndefined();
			store.setIcon("item-0", "star");
			expect(store.getState().iconOverrides).toEqual({ "item-0": "star" });
		});

		it("setColor writes any color and clears when undefined", () => {
			const store = makeStore();
			store.setColor("item-0", "#ff0000");
			expect(store.getState().colorOverrides).toEqual({ "item-0": "#ff0000" });
			store.setColor("item-0", undefined);
			expect(store.getState().colorOverrides).toBeUndefined();
		});

		it("setShowSettingsButton toggles snapshot and emits state", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });
			store.setShowSettingsButton(false);
			expect(store.getSnapshot().showSettingsButton).toBe(false);
			expect(onStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ showSettingsButton: false }));
			store.setShowSettingsButton(false); // idempotent
			expect(onStateChange).toHaveBeenCalledTimes(1);
		});
	});

	describe("initialState restoration", () => {
		it("restores visibleItemIds and falls back when empty", () => {
			expect(makeStore({ initialState: { visibleItemIds: ["item-2", "item-0"] } }).visibleCount).toBe(2);
			expect(makeStore({ initialState: { visibleItemIds: [] } }).visibleCount).toBe(5);
			expect(makeStore({ initialState: { visibleItemIds: ["bogus"] } }).visibleCount).toBe(5);
		});

		it("drops invalid ids from visibleItemIds", () => {
			const store = makeStore({ initialState: { visibleItemIds: ["item-0", "bogus", "item-2"] } });
			expect(store.getState().visibleItemIds).toEqual(["item-0", "item-2"]);
		});

		it("roundtrips all override types", () => {
			const initial: ContextMenuState = {
				visibleItemIds: ["item-1", "item-0"],
				renames: { "item-0": "Custom" },
				iconOverrides: { "item-1": "star" },
				colorOverrides: { "item-0": "#ff0000" },
				showSettingsButton: false,
			};
			const out = makeStore({ initialState: initial }).getState();
			expect(out.visibleItemIds).toEqual(initial.visibleItemIds);
			expect(out.renames).toEqual(initial.renames);
			expect(out.iconOverrides).toEqual(initial.iconOverrides);
			expect(out.colorOverrides).toEqual(initial.colorOverrides);
			expect(out.showSettingsButton).toBe(false);
		});
	});

	describe("subscribe", () => {
		it("notifies subscribers on mutations and stops after unsubscribe", () => {
			const store = makeStore();
			const listener = vi.fn();
			const unsubscribe = store.subscribe(listener);

			store.hideItem("item-0");
			store.moveItem("item-1", 1);
			expect(listener).toHaveBeenCalledTimes(2);

			unsubscribe();
			store.hideItem("item-2");
			expect(listener).toHaveBeenCalledTimes(2);
		});
	});

	describe("resetToDefaults", () => {
		it("restores order, overrides, sections, and showSettingsButton in one shot", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });

			store.hideItem("item-0");
			store.moveItem("item-1", 1);
			store.setRename("item-2", "Custom");
			store.setIcon("item-3", "star");
			store.setColor("item-4", "#ff0000");
			store.setShowSettingsButton(false);
			onStateChange.mockClear();

			store.resetToDefaults();

			expect(store.visibleCount).toBe(5);
			expect(store.getState()).toEqual({});
			expect(onStateChange).toHaveBeenCalledOnce();
			expect(onStateChange).toHaveBeenCalledWith({});
		});

		it("emits a serialized state matching the factory defaults", () => {
			const onStateChange = vi.fn();
			const store = makeStore({ onStateChange });

			store.resetToDefaults();

			expect(store.getState()).toEqual({});
			expect(onStateChange).toHaveBeenCalledOnce();
		});

		it("clears sectionOverrides too", () => {
			const store = makeStore({ initialState: { sectionOverrides: { "item-0": "danger" } } });
			expect(store.getState().sectionOverrides).toEqual({ "item-0": "danger" });

			store.resetToDefaults();

			expect(store.getState().sectionOverrides).toBeUndefined();
		});

		it("restores consumer-supplied factory defaults when provided", () => {
			const onStateChange = vi.fn();
			const store = new CustomizableMenuStore({
				allItems: makeItems(5),
				initialState: { visibleItemIds: ["item-0", "item-1"], renames: { "item-0": "Custom" } },
				defaults: { visibleItemIds: ["item-2", "item-3"] },
				onStateChange,
			});
			onStateChange.mockClear();

			store.resetToDefaults();

			expect(store.getState().visibleItemIds).toEqual(["item-2", "item-3"]);
			expect(store.getState().renames).toBeUndefined();
			expect(onStateChange).toHaveBeenCalledOnce();
		});
	});

	describe("compound operations", () => {
		it("hide + move changes both visibility and order", () => {
			const store = makeStore();
			store.hideItem("item-2");
			store.moveItem("item-0", 1);
			expect(store.getState().visibleItemIds).toEqual(["item-1", "item-0", "item-3", "item-4"]);
			expect(store.visibleCount).toBe(4);
		});

		it("getState round-trips through a fresh store", () => {
			const a = makeStore();
			a.hideItem("item-2");
			a.moveItem("item-0", 1);
			const persisted = a.getState();

			const b = makeStore({ initialState: persisted });
			expect(b.visibleCount).toBe(4);
			expect(b.getState().visibleItemIds).toEqual(persisted.visibleItemIds);
		});
	});
});
