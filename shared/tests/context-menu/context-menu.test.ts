import { describe, expect, it, vi } from "vitest";

import { createContextMenu } from "../../src/components/context-menu/context-menu";
import type {
	ContextMenuConfig,
	ContextMenuItemDefinition,
	ContextMenuState,
} from "../../src/components/context-menu/types";

function makeApp(): any {
	return {};
}

function makeItems(count = 5, sectionPattern?: string[]): ContextMenuItemDefinition[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `item-${i}`,
		label: `Item ${i}`,
		icon: `icon-${i}`,
		...(sectionPattern ? { section: sectionPattern[i % sectionPattern.length] } : {}),
		onAction: vi.fn(),
	}));
}

function makeConfig(overrides: Partial<ContextMenuConfig> = {}): ContextMenuConfig {
	return {
		items: makeItems(),
		cssPrefix: "test-",
		app: makeApp(),
		...overrides,
	};
}

describe("createContextMenu", () => {
	describe("API surface", () => {
		it("returns a handle with the expected API", () => {
			const handle = createContextMenu(makeConfig());
			expect(handle.show).toBeTypeOf("function");
			expect(handle.hideItem).toBeTypeOf("function");
			expect(handle.restoreItem).toBeTypeOf("function");
			expect(handle.moveItem).toBeTypeOf("function");
			expect(handle.showItemManager).toBeTypeOf("function");
			expect(handle.getState).toBeTypeOf("function");
			expect(handle.destroy).toBeTypeOf("function");
			handle.destroy();
		});

		it("reports all items visible by default", () => {
			const items = makeItems(4);
			const handle = createContextMenu(makeConfig({ items }));
			expect(handle.visibleCount).toBe(4);
			handle.destroy();
		});
	});

	describe("sparse state", () => {
		it("returns minimal state when no overrides exist", () => {
			const handle = createContextMenu(makeConfig());
			const state = handle.getState();
			expect(state.visibleItemIds).toBeUndefined();
			expect(state.renames).toBeUndefined();
			expect(state.iconOverrides).toBeUndefined();
			expect(state.colorOverrides).toBeUndefined();
			expect(state.showSettingsButton).toBeUndefined();
			handle.destroy();
		});

		it("only includes visibleItemIds when order differs from default", () => {
			const handle = createContextMenu(makeConfig());
			handle.moveItem("item-0", 1);
			const state = handle.getState();
			expect(state.visibleItemIds).toEqual(["item-1", "item-0", "item-2", "item-3", "item-4"]);
			handle.destroy();
		});

		it("only includes showSettingsButton when false", () => {
			const handle = createContextMenu(makeConfig({ initialState: { showSettingsButton: true } }));
			expect(handle.getState().showSettingsButton).toBeUndefined();
			handle.destroy();
		});
	});

	describe("hideItem", () => {
		it("reduces visible count and emits state", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.hideItem("item-0");
			expect(handle.visibleCount).toBe(4);
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ visibleItemIds: ["item-1", "item-2", "item-3", "item-4"] })
			);
			handle.destroy();
		});

		it("is a no-op when only one item visible", () => {
			const items = makeItems(1);
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ items, onStateChange }));

			handle.hideItem("item-0");
			expect(handle.visibleCount).toBe(1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});

		it("is a no-op for non-existent item ID", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.hideItem("nonexistent");
			expect(handle.visibleCount).toBe(5);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});

		it("can hide multiple items down to minimum of one", () => {
			const handle = createContextMenu(makeConfig());

			handle.hideItem("item-0");
			handle.hideItem("item-1");
			handle.hideItem("item-2");
			handle.hideItem("item-3");
			expect(handle.visibleCount).toBe(1);

			handle.hideItem("item-4");
			expect(handle.visibleCount).toBe(1);
			handle.destroy();
		});
	});

	describe("restoreItem", () => {
		it("brings back a hidden item", () => {
			const handle = createContextMenu(makeConfig());

			handle.hideItem("item-0");
			expect(handle.visibleCount).toBe(4);

			handle.restoreItem("item-0");
			expect(handle.visibleCount).toBe(5);
			handle.destroy();
		});

		it("is a no-op for already visible item", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.restoreItem("item-0");
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});

		it("is a no-op for non-existent item ID", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.restoreItem("nonexistent");
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});
	});

	describe("moveItem", () => {
		it("swaps item order forward", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.moveItem("item-0", 1);
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ visibleItemIds: ["item-1", "item-0", "item-2", "item-3", "item-4"] })
			);
			handle.destroy();
		});

		it("swaps item order backward", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.moveItem("item-2", -1);
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ visibleItemIds: ["item-0", "item-2", "item-1", "item-3", "item-4"] })
			);
			handle.destroy();
		});

		it("is a no-op when moving first item up", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.moveItem("item-0", -1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});

		it("is a no-op when moving last item down", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.moveItem("item-4", 1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});

		it("is a no-op for non-existent item ID", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.moveItem("nonexistent", 1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});
	});

	describe("initialState restoration", () => {
		it("restores visibility from initialState", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: {
						visibleItemIds: ["item-2", "item-0"],
					},
				})
			);

			expect(handle.visibleCount).toBe(2);
			expect(handle.getState().visibleItemIds).toEqual(["item-2", "item-0"]);
			handle.destroy();
		});

		it("restores renames from initialState", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: {
						renames: { "item-0": "Renamed Item" },
					},
				})
			);

			expect(handle.getState().renames).toEqual({ "item-0": "Renamed Item" });
			handle.destroy();
		});

		it("restores icon overrides from initialState", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: {
						iconOverrides: { "item-1": "star" },
					},
				})
			);

			expect(handle.getState().iconOverrides).toEqual({ "item-1": "star" });
			handle.destroy();
		});

		it("restores color overrides from initialState", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: {
						colorOverrides: { "item-0": "#ff0000" },
					},
				})
			);

			expect(handle.getState().colorOverrides).toEqual({ "item-0": "#ff0000" });
			handle.destroy();
		});

		it("restores all overrides together", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: {
						visibleItemIds: ["item-2", "item-0"],
						renames: { "item-0": "Custom Name" },
						iconOverrides: { "item-2": "star" },
						colorOverrides: { "item-0": "#ff0000" },
						showSettingsButton: false,
					},
				})
			);

			const state = handle.getState();
			expect(state.visibleItemIds).toEqual(["item-2", "item-0"]);
			expect(state.renames).toEqual({ "item-0": "Custom Name" });
			expect(state.iconOverrides).toEqual({ "item-2": "star" });
			expect(state.colorOverrides).toEqual({ "item-0": "#ff0000" });
			expect(state.showSettingsButton).toBe(false);
			handle.destroy();
		});

		it("drops invalid IDs from initialState.visibleItemIds", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: {
						visibleItemIds: ["item-0", "nonexistent", "item-2"],
					},
				})
			);

			expect(handle.visibleCount).toBe(2);
			expect(handle.getState().visibleItemIds).toEqual(["item-0", "item-2"]);
			handle.destroy();
		});

		it("falls back to all items when initialState has empty visibleItemIds", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: { visibleItemIds: [] },
				})
			);

			expect(handle.visibleCount).toBe(5);
			handle.destroy();
		});

		it("falls back to all items when all visibleItemIds are invalid", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: { visibleItemIds: ["bogus-a", "bogus-b"] },
				})
			);

			expect(handle.visibleCount).toBe(5);
			handle.destroy();
		});
	});

	describe("destroy behavior", () => {
		it("show is a no-op after destroy", () => {
			const handle = createContextMenu(makeConfig());
			handle.destroy();
			expect(() => handle.show({ x: 0, y: 0 })).not.toThrow();
		});

		it("hideItem is a no-op after destroy", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));
			handle.destroy();

			handle.hideItem("item-0");
			expect(handle.visibleCount).toBe(5);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("restoreItem is a no-op after destroy", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));
			handle.hideItem("item-0");
			onStateChange.mockClear();

			handle.destroy();
			handle.restoreItem("item-0");
			expect(handle.visibleCount).toBe(4);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("moveItem is a no-op after destroy", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));
			handle.destroy();

			handle.moveItem("item-0", 1);
			expect(onStateChange).not.toHaveBeenCalled();
		});

		it("showItemManager is a no-op after destroy", () => {
			const handle = createContextMenu(makeConfig({ editable: true }));
			handle.destroy();
			expect(() => handle.showItemManager()).not.toThrow();
		});
	});

	describe("editable / showItemManager", () => {
		it("showItemManager is a no-op when editable is false", () => {
			const handle = createContextMenu(makeConfig({ editable: false }));
			expect(() => handle.showItemManager()).not.toThrow();
			handle.destroy();
		});

		it("showItemManager is a no-op when editable is undefined", () => {
			const handle = createContextMenu(makeConfig());
			expect(() => handle.showItemManager()).not.toThrow();
			handle.destroy();
		});
	});

	describe("state change callbacks", () => {
		it("emits state on hideItem", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.hideItem("item-2");
			expect(onStateChange).toHaveBeenCalledTimes(1);
			const state = onStateChange.mock.calls[0][0] as ContextMenuState;
			expect(state.visibleItemIds).toEqual(["item-0", "item-1", "item-3", "item-4"]);
			handle.destroy();
		});

		it("emits state on restoreItem", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.hideItem("item-2");
			onStateChange.mockClear();

			handle.restoreItem("item-2");
			expect(onStateChange).toHaveBeenCalledTimes(1);
			handle.destroy();
		});

		it("emits state on moveItem", () => {
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ onStateChange }));

			handle.moveItem("item-1", 1);
			expect(onStateChange).toHaveBeenCalledTimes(1);
			handle.destroy();
		});

		it("does not emit when no onStateChange is provided", () => {
			const handle = createContextMenu(makeConfig());
			expect(() => {
				handle.hideItem("item-0");
				handle.restoreItem("item-0");
				handle.moveItem("item-0", 1);
			}).not.toThrow();
			handle.destroy();
		});
	});

	describe("compound operations", () => {
		it("hide then restore returns to original count", () => {
			const handle = createContextMenu(makeConfig());

			handle.hideItem("item-1");
			handle.hideItem("item-3");
			expect(handle.visibleCount).toBe(3);

			handle.restoreItem("item-1");
			handle.restoreItem("item-3");
			expect(handle.visibleCount).toBe(5);
			handle.destroy();
		});

		it("restored item appends to end of its section (no sections = end of list)", () => {
			const handle = createContextMenu(makeConfig());

			handle.hideItem("item-1");
			handle.restoreItem("item-1");

			const state = handle.getState();
			expect(state.visibleItemIds).toEqual(["item-0", "item-2", "item-3", "item-4", "item-1"]);
			handle.destroy();
		});

		it("hide + move changes both visibility and order", () => {
			const handle = createContextMenu(makeConfig());

			handle.hideItem("item-2");
			handle.moveItem("item-0", 1);

			const state = handle.getState();
			expect(state.visibleItemIds).toEqual(["item-1", "item-0", "item-3", "item-4"]);
			expect(handle.visibleCount).toBe(4);
			handle.destroy();
		});
	});

	describe("getState roundtrip", () => {
		it("state from getState can be used as initialState for a new handle", () => {
			const handle1 = createContextMenu(makeConfig());
			handle1.hideItem("item-2");
			handle1.moveItem("item-0", 1);
			const state = handle1.getState();
			handle1.destroy();

			const handle2 = createContextMenu(makeConfig({ initialState: state }));
			expect(handle2.visibleCount).toBe(4);
			expect(handle2.getState().visibleItemIds).toEqual(state.visibleItemIds);
			handle2.destroy();
		});

		it("roundtrip preserves all override types", () => {
			const initialState: ContextMenuState = {
				visibleItemIds: ["item-1", "item-0"],
				renames: { "item-0": "Custom" },
				iconOverrides: { "item-1": "star" },
				colorOverrides: { "item-0": "#ff0000" },
				showSettingsButton: false,
			};

			const handle = createContextMenu(makeConfig({ initialState }));
			const restored = handle.getState();

			expect(restored.visibleItemIds).toEqual(initialState.visibleItemIds);
			expect(restored.renames).toEqual(initialState.renames);
			expect(restored.iconOverrides).toEqual(initialState.iconOverrides);
			expect(restored.colorOverrides).toEqual(initialState.colorOverrides);
			expect(restored.showSettingsButton).toBe(false);
			handle.destroy();
		});
	});

	describe("section-aware behavior", () => {
		function makeSectionedItems(): ContextMenuItemDefinition[] {
			return [
				{ id: "nav-0", label: "Nav 0", icon: "icon-0", section: "navigation", onAction: vi.fn() },
				{ id: "nav-1", label: "Nav 1", icon: "icon-1", section: "navigation", onAction: vi.fn() },
				{ id: "edit-0", label: "Edit 0", icon: "icon-2", section: "edit", onAction: vi.fn() },
				{ id: "edit-1", label: "Edit 1", icon: "icon-3", section: "edit", onAction: vi.fn() },
				{ id: "edit-2", label: "Edit 2", icon: "icon-4", section: "edit", onAction: vi.fn() },
				{ id: "danger-0", label: "Danger 0", icon: "icon-5", section: "danger", onAction: vi.fn() },
			];
		}

		it("moveItem only moves within the same section", () => {
			const items = makeSectionedItems();
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ items, onStateChange }));

			handle.moveItem("edit-0", 1);
			const state = onStateChange.mock.calls[0][0] as ContextMenuState;
			expect(state.visibleItemIds).toEqual(["nav-0", "nav-1", "edit-1", "edit-0", "edit-2", "danger-0"]);
			handle.destroy();
		});

		it("moveItem does not cross section boundary going down", () => {
			const items = makeSectionedItems();
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ items, onStateChange }));

			handle.moveItem("nav-1", 1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});

		it("moveItem does not cross section boundary going up", () => {
			const items = makeSectionedItems();
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ items, onStateChange }));

			handle.moveItem("edit-0", -1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});

		it("restoreItem inserts at end of its section", () => {
			const items = makeSectionedItems();
			const handle = createContextMenu(makeConfig({ items }));

			handle.hideItem("nav-0");
			handle.restoreItem("nav-0");

			const state = handle.getState();
			// nav-0 should be after nav-1 (end of navigation section), before edit items
			expect(state.visibleItemIds).toEqual(["nav-1", "nav-0", "edit-0", "edit-1", "edit-2", "danger-0"]);
			handle.destroy();
		});

		it("sectionOverrides is sparse — absent when no sections are reassigned", () => {
			const items = makeSectionedItems();
			const handle = createContextMenu(makeConfig({ items }));
			expect(handle.getState().sectionOverrides).toBeUndefined();
			handle.destroy();
		});

		it("sectionOverrides persists from initialState", () => {
			const items = makeSectionedItems();
			const handle = createContextMenu(
				makeConfig({
					items,
					initialState: {
						sectionOverrides: { "nav-0": "danger" },
					},
				})
			);

			expect(handle.getState().sectionOverrides).toEqual({ "nav-0": "danger" });
			handle.destroy();
		});

		it("multiple moves within a section produce correct order", () => {
			const items = makeSectionedItems();
			const handle = createContextMenu(makeConfig({ items }));

			handle.moveItem("edit-2", -1);
			handle.moveItem("edit-2", -1);

			const state = handle.getState();
			expect(state.visibleItemIds).toEqual(["nav-0", "nav-1", "edit-2", "edit-0", "edit-1", "danger-0"]);
			handle.destroy();
		});

		it("single-item section: move is a no-op", () => {
			const items = makeSectionedItems();
			const onStateChange = vi.fn();
			const handle = createContextMenu(makeConfig({ items, onStateChange }));

			handle.moveItem("danger-0", -1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.moveItem("danger-0", 1);
			expect(onStateChange).not.toHaveBeenCalled();
			handle.destroy();
		});
	});

	describe("edge cases", () => {
		it("handles a single item", () => {
			const items = makeItems(1);
			const handle = createContextMenu(makeConfig({ items }));

			expect(handle.visibleCount).toBe(1);
			handle.hideItem("item-0");
			expect(handle.visibleCount).toBe(1);
			handle.moveItem("item-0", 1);
			handle.moveItem("item-0", -1);
			expect(handle.getState().visibleItemIds).toBeUndefined();
			handle.destroy();
		});

		it("handles zero items gracefully", () => {
			const handle = createContextMenu(makeConfig({ items: [] }));
			expect(handle.visibleCount).toBe(0);
			expect(handle.getState().visibleItemIds).toBeUndefined();
			handle.destroy();
		});

		it("handles duplicate IDs in initialState.visibleItemIds", () => {
			const handle = createContextMenu(
				makeConfig({
					initialState: { visibleItemIds: ["item-0", "item-0", "item-1"] },
				})
			);

			// First occurrence of item-0 resolves, second is also valid (same Map lookup)
			expect(handle.visibleCount).toBe(3);
			handle.destroy();
		});
	});
});
