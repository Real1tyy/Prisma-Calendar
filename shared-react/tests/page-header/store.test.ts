import { describe, expect, it, vi } from "vitest";

import { PageHeaderStore } from "../../src/page-header/store";
import type { HeaderActionDefinition } from "../../src/page-header/types";

function makeActions(count = 3): HeaderActionDefinition[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `action-${i}`,
		label: `Action ${i}`,
		icon: `icon-${i}`,
		onAction: vi.fn(),
	}));
}

describe("PageHeaderStore", () => {
	it("reports all actions visible by default", () => {
		const store = new PageHeaderStore(makeActions(3));
		expect(store.visibleCount).toBe(3);
		expect(store.serialize().visibleActionIds).toBeUndefined();
	});

	it("returns minimal state when no overrides exist", () => {
		const store = new PageHeaderStore(makeActions());
		const state = store.serialize();
		expect(state.visibleActionIds).toBeUndefined();
		expect(state.renames).toBeUndefined();
		expect(state.iconOverrides).toBeUndefined();
		expect(state.colorOverrides).toBeUndefined();
		expect(state.showSettingsButton).toBeUndefined();
	});

	it("hideAction reduces visible count and notifies subscribers", () => {
		const store = new PageHeaderStore(makeActions());
		const listener = vi.fn();
		store.subscribe(listener);

		store.hideAction("action-0");
		expect(store.visibleCount).toBe(2);
		expect(listener).toHaveBeenCalledOnce();
		expect(store.serialize().visibleActionIds).toEqual(["action-1", "action-2"]);
	});

	it("hideAction is a no-op when only one action visible", () => {
		const store = new PageHeaderStore(makeActions(1));
		const listener = vi.fn();
		store.subscribe(listener);

		store.hideAction("action-0");
		expect(store.visibleCount).toBe(1);
		expect(listener).not.toHaveBeenCalled();
	});

	it("restoreAction brings back a hidden action", () => {
		const store = new PageHeaderStore(makeActions());

		store.hideAction("action-0");
		expect(store.visibleCount).toBe(2);

		store.restoreAction("action-0");
		expect(store.visibleCount).toBe(3);
	});

	it("restoreAction is a no-op for already visible action", () => {
		const store = new PageHeaderStore(makeActions());
		const listener = vi.fn();
		store.subscribe(listener);

		store.restoreAction("action-0");
		expect(listener).not.toHaveBeenCalled();
	});

	it("moveAction swaps action order", () => {
		const store = new PageHeaderStore(makeActions());

		store.moveAction("action-0", 1);
		expect(store.serialize().visibleActionIds).toEqual(["action-1", "action-0", "action-2"]);
	});

	it("moveAction is a no-op for out-of-bounds moves", () => {
		const store = new PageHeaderStore(makeActions());
		const listener = vi.fn();
		store.subscribe(listener);

		store.moveAction("action-0", -1);
		expect(listener).not.toHaveBeenCalled();

		store.moveAction("action-2", 1);
		expect(listener).not.toHaveBeenCalled();
	});

	it("setRename adds and clears renames", () => {
		const store = new PageHeaderStore(makeActions());

		store.setRename("action-0", "Renamed");
		expect(store.serialize().renames).toEqual({ "action-0": "Renamed" });

		store.setRename("action-0", undefined);
		expect(store.serialize().renames).toBeUndefined();
	});

	it("setRename ignores label equal to original", () => {
		const store = new PageHeaderStore(makeActions());

		store.setRename("action-0", "Action 0");
		expect(store.serialize().renames).toBeUndefined();
	});

	it("setIconOverride respects original icon", () => {
		const store = new PageHeaderStore(makeActions());

		store.setIconOverride("action-0", "star");
		expect(store.serialize().iconOverrides).toEqual({ "action-0": "star" });

		store.setIconOverride("action-0", "icon-0");
		expect(store.serialize().iconOverrides).toBeUndefined();
	});

	it("setColorOverride round-trips", () => {
		const store = new PageHeaderStore(makeActions());

		store.setColorOverride("action-0", "#ff0000");
		expect(store.serialize().colorOverrides).toEqual({ "action-0": "#ff0000" });

		store.setColorOverride("action-0", undefined);
		expect(store.serialize().colorOverrides).toBeUndefined();
	});

	it("setShowSettingsButton emits state when toggled off", () => {
		const store = new PageHeaderStore(makeActions());
		const listener = vi.fn();
		store.subscribe(listener);

		store.setShowSettingsButton(false);
		expect(store.serialize().showSettingsButton).toBe(false);
		expect(listener).toHaveBeenCalledOnce();
	});

	it("restores state from initialState", () => {
		const store = new PageHeaderStore(makeActions(), {
			visibleActionIds: ["action-2", "action-0"],
			renames: { "action-0": "Renamed" },
			iconOverrides: { "action-2": "star" },
			colorOverrides: { "action-0": "#ff0000" },
		});

		expect(store.visibleCount).toBe(2);
		const state = store.serialize();
		expect(state.visibleActionIds).toEqual(["action-2", "action-0"]);
		expect(state.renames).toEqual({ "action-0": "Renamed" });
		expect(state.iconOverrides).toEqual({ "action-2": "star" });
		expect(state.colorOverrides).toEqual({ "action-0": "#ff0000" });
	});

	it("drops invalid IDs from initialState.visibleActionIds", () => {
		const store = new PageHeaderStore(makeActions(), {
			visibleActionIds: ["action-0", "nonexistent", "action-2"],
		});

		expect(store.visibleCount).toBe(2);
		expect(store.serialize().visibleActionIds).toEqual(["action-0", "action-2"]);
	});

	it("falls back to all actions when initialState has empty visibleActionIds", () => {
		const store = new PageHeaderStore(makeActions(), { visibleActionIds: [] });

		expect(store.visibleCount).toBe(3);
	});

	it("subscribe returns an unsubscribe handle", () => {
		const store = new PageHeaderStore(makeActions());
		const listener = vi.fn();
		const sub = store.subscribe(listener);

		store.hideAction("action-0");
		expect(listener).toHaveBeenCalledOnce();

		sub.unsubscribe();
		store.hideAction("action-1");
		expect(listener).toHaveBeenCalledOnce();
	});

	it("emits a new snapshot reference on every change", () => {
		const store = new PageHeaderStore(makeActions());
		const before = store.getValue();
		store.hideAction("action-0");
		const after = store.getValue();
		expect(before).not.toBe(after);
	});
});
