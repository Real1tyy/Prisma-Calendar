import { describe, expect, it, vi } from "vitest";

import { createPageHeader } from "../../src/components/page-header/page-header";
import type { HeaderActionDefinition, PageHeaderConfig } from "../../src/components/page-header/types";

function makeApp(): any {
	return {
		workspace: {
			setActiveLeaf: vi.fn(),
		},
	};
}

function makeActions(count = 3): HeaderActionDefinition[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `action-${i}`,
		label: `Action ${i}`,
		icon: `icon-${i}`,
		onAction: vi.fn(),
	}));
}

function makeLeaf(): any {
	const actionsEl = document.createElement("div");

	const view = {
		addAction: (_icon: string, _title: string, _callback: () => void) => {
			const el = document.createElement("div");
			el.addClass = (cls: string) => el.classList.add(cls);
			el.removeClass = (cls: string) => el.classList.remove(cls);
			actionsEl.insertBefore(el, actionsEl.firstChild);
			return el;
		},
		getViewType: () => "markdown",
		actionsEl,
		containerEl: document.createElement("div"),
	};

	return { leaf: { view }, view, actionsEl };
}

function makeConfig(overrides: Partial<PageHeaderConfig> = {}): PageHeaderConfig {
	return {
		actions: makeActions(),
		cssPrefix: "test-",
		app: makeApp(),
		...overrides,
	};
}

describe("createPageHeader", () => {
	it("returns a handle with the expected API", () => {
		const handle = createPageHeader(makeConfig());
		expect(handle.apply).toBeTypeOf("function");
		expect(handle.remove).toBeTypeOf("function");
		expect(handle.refresh).toBeTypeOf("function");
		expect(handle.hideAction).toBeTypeOf("function");
		expect(handle.restoreAction).toBeTypeOf("function");
		expect(handle.moveAction).toBeTypeOf("function");
		expect(handle.showActionManager).toBeTypeOf("function");
		expect(handle.getState).toBeTypeOf("function");
		expect(handle.destroy).toBeTypeOf("function");
		handle.destroy();
	});

	it("reports all actions visible by default", () => {
		const actions = makeActions(3);
		const handle = createPageHeader(makeConfig({ actions }));
		expect(handle.visibleCount).toBe(3);
		handle.destroy();
	});

	it("returns minimal state when no overrides exist", () => {
		const handle = createPageHeader(makeConfig());
		const state = handle.getState();
		expect(state.visibleActionIds).toBeUndefined();
		expect(state.renames).toBeUndefined();
		expect(state.iconOverrides).toBeUndefined();
		expect(state.colorOverrides).toBeUndefined();
		handle.destroy();
	});

	describe("apply/remove lifecycle", () => {
		it("adds buttons to the view on apply", () => {
			const { leaf, actionsEl } = makeLeaf();
			const handle = createPageHeader(makeConfig());

			handle.apply(leaf);
			const buttons = actionsEl.querySelectorAll(".test-header-btn");
			expect(buttons.length).toBe(3);

			handle.destroy();
		});

		it("hides existing buttons on apply in override mode (default)", () => {
			const { leaf, actionsEl } = makeLeaf();
			const existingBtn = document.createElement("div");
			actionsEl.appendChild(existingBtn);

			const handle = createPageHeader(makeConfig());
			handle.apply(leaf);

			expect(existingBtn.classList.contains("page-header-original-hidden")).toBe(true);
			handle.destroy();
		});

		it("does not hide existing buttons in append mode", () => {
			const { leaf, actionsEl } = makeLeaf();
			const existingBtn = document.createElement("div");
			actionsEl.appendChild(existingBtn);

			const handle = createPageHeader(makeConfig({ mode: "append" }));
			handle.apply(leaf);

			expect(existingBtn.classList.contains("page-header-original-hidden")).toBe(false);
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(3);
			handle.destroy();
		});

		it("restores existing buttons on remove", () => {
			const { leaf, actionsEl } = makeLeaf();
			const existingBtn = document.createElement("div");
			actionsEl.appendChild(existingBtn);

			const handle = createPageHeader(makeConfig());
			handle.apply(leaf);
			expect(existingBtn.classList.contains("page-header-original-hidden")).toBe(true);

			handle.remove(leaf);
			expect(existingBtn.classList.contains("page-header-original-hidden")).toBe(false);
		});

		it("removes our buttons on remove", () => {
			const { leaf, actionsEl } = makeLeaf();
			const handle = createPageHeader(makeConfig());

			handle.apply(leaf);
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(3);

			handle.remove(leaf);
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(0);
		});

		it("restores all existing buttons on destroy", () => {
			const { leaf, actionsEl } = makeLeaf();
			const existingBtn = document.createElement("div");
			actionsEl.appendChild(existingBtn);

			const handle = createPageHeader(makeConfig());
			handle.apply(leaf);

			handle.destroy();
			expect(existingBtn.classList.contains("page-header-original-hidden")).toBe(false);
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(0);
		});

		it("no-ops apply after destroy", () => {
			const { leaf, actionsEl } = makeLeaf();
			const handle = createPageHeader(makeConfig());

			handle.destroy();
			handle.apply(leaf);
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(0);
		});

		it("supports applying to multiple leaves", () => {
			const leaf1 = makeLeaf();
			const leaf2 = makeLeaf();
			const handle = createPageHeader(makeConfig());

			handle.apply(leaf1.leaf);
			handle.apply(leaf2.leaf);

			expect(leaf1.actionsEl.querySelectorAll(".test-header-btn").length).toBe(3);
			expect(leaf2.actionsEl.querySelectorAll(".test-header-btn").length).toBe(3);

			handle.remove(leaf1.leaf);
			expect(leaf1.actionsEl.querySelectorAll(".test-header-btn").length).toBe(0);
			expect(leaf2.actionsEl.querySelectorAll(".test-header-btn").length).toBe(3);

			handle.destroy();
		});

		it("re-applying to the same leaf replaces buttons", () => {
			const { leaf, actionsEl } = makeLeaf();
			const handle = createPageHeader(makeConfig());

			handle.apply(leaf);
			handle.apply(leaf);
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(3);

			handle.destroy();
		});
	});

	describe("state management", () => {
		it("hideAction reduces visible count and emits state", () => {
			const onStateChange = vi.fn();
			const handle = createPageHeader(makeConfig({ onStateChange }));

			handle.hideAction("action-0");
			expect(handle.visibleCount).toBe(2);
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ visibleActionIds: ["action-1", "action-2"] })
			);

			handle.destroy();
		});

		it("hideAction is a no-op when only one action visible", () => {
			const actions = makeActions(1);
			const handle = createPageHeader(makeConfig({ actions }));

			handle.hideAction("action-0");
			expect(handle.visibleCount).toBe(1);

			handle.destroy();
		});

		it("restoreAction brings back a hidden action", () => {
			const handle = createPageHeader(makeConfig());

			handle.hideAction("action-0");
			expect(handle.visibleCount).toBe(2);

			handle.restoreAction("action-0");
			expect(handle.visibleCount).toBe(3);

			handle.destroy();
		});

		it("restoreAction is a no-op for already visible action", () => {
			const onStateChange = vi.fn();
			const handle = createPageHeader(makeConfig({ onStateChange }));

			handle.restoreAction("action-0");
			expect(onStateChange).not.toHaveBeenCalled();

			handle.destroy();
		});

		it("moveAction swaps action order", () => {
			const onStateChange = vi.fn();
			const handle = createPageHeader(makeConfig({ onStateChange }));

			handle.moveAction("action-0", 1);
			expect(onStateChange).toHaveBeenCalledWith(
				expect.objectContaining({ visibleActionIds: ["action-1", "action-0", "action-2"] })
			);

			handle.destroy();
		});

		it("moveAction is a no-op for out-of-bounds moves", () => {
			const onStateChange = vi.fn();
			const handle = createPageHeader(makeConfig({ onStateChange }));

			handle.moveAction("action-0", -1);
			expect(onStateChange).not.toHaveBeenCalled();

			handle.moveAction("action-2", 1);
			expect(onStateChange).not.toHaveBeenCalled();

			handle.destroy();
		});

		it("restores state from initialState", () => {
			const handle = createPageHeader(
				makeConfig({
					initialState: {
						visibleActionIds: ["action-2", "action-0"],
						renames: { "action-0": "Renamed" },
						iconOverrides: { "action-2": "star" },
						colorOverrides: { "action-0": "#ff0000" },
					},
				})
			);

			expect(handle.visibleCount).toBe(2);
			const state = handle.getState();
			expect(state.visibleActionIds).toEqual(["action-2", "action-0"]);
			expect(state.renames).toEqual({ "action-0": "Renamed" });
			expect(state.iconOverrides).toEqual({ "action-2": "star" });
			expect(state.colorOverrides).toEqual({ "action-0": "#ff0000" });

			handle.destroy();
		});

		it("drops invalid IDs from initialState.visibleActionIds", () => {
			const handle = createPageHeader(
				makeConfig({
					initialState: {
						visibleActionIds: ["action-0", "nonexistent", "action-2"],
					},
				})
			);

			expect(handle.visibleCount).toBe(2);
			expect(handle.getState().visibleActionIds).toEqual(["action-0", "action-2"]);

			handle.destroy();
		});

		it("falls back to all actions when initialState has empty visibleActionIds", () => {
			const handle = createPageHeader(
				makeConfig({
					initialState: { visibleActionIds: [] },
				})
			);

			expect(handle.visibleCount).toBe(3);
			handle.destroy();
		});
	});

	describe("refresh", () => {
		it("re-renders buttons on applied leaves after state change", () => {
			const { leaf, actionsEl } = makeLeaf();
			const handle = createPageHeader(makeConfig());

			handle.apply(leaf);
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(3);

			handle.hideAction("action-0");
			expect(actionsEl.querySelectorAll(".test-header-btn").length).toBe(2);

			handle.destroy();
		});
	});
});
