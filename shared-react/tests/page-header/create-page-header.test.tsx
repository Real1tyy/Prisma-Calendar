import { act, waitFor } from "@testing-library/react";
import type { App, ItemView, WorkspaceLeaf } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { createPageHeader } from "../../src/page-header/create-page-header";
import type { HeaderActionDefinition, PageHeaderConfig } from "../../src/page-header/types";

const PREFIX = "test-";

function makeApp(): App {
	return {
		workspace: { setActiveLeaf: vi.fn() },
	} as unknown as App;
}

function makeActions(count = 3): HeaderActionDefinition[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `action-${i}`,
		label: `Action ${i}`,
		icon: `icon-${i}`,
		onAction: vi.fn(),
	}));
}

interface MockLeaf {
	leaf: WorkspaceLeaf;
	view: ItemView;
	actionsEl: HTMLElement;
}

function makeLeaf(): MockLeaf {
	const actionsEl = document.createElement("div");

	const view = {
		addAction: (_icon: string, _title: string, _callback: () => void) => {
			const el = document.createElement("div");
			actionsEl.insertBefore(el, actionsEl.firstChild);
			return el;
		},
		getViewType: () => "markdown",
		actionsEl,
		containerEl: document.createElement("div"),
	} as unknown as ItemView;

	return { leaf: { view } as unknown as WorkspaceLeaf, view, actionsEl };
}

function makeConfig(overrides: Partial<PageHeaderConfig> = {}): PageHeaderConfig {
	return {
		actions: makeActions(),
		cssPrefix: PREFIX,
		app: makeApp(),
		...overrides,
	};
}

function buttonsIn(actionsEl: HTMLElement): HTMLElement[] {
	return Array.from(actionsEl.querySelectorAll<HTMLElement>(`[data-testid^="${PREFIX}toolbar-"]`));
}

async function expectButtons(actionsEl: HTMLElement, count: number): Promise<void> {
	await waitFor(() => expect(buttonsIn(actionsEl).length).toBe(count));
}

async function flushReact(): Promise<void> {
	await act(async () => {
		await Promise.resolve();
	});
}

describe("createPageHeader (React bridge)", () => {
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

	it("starts with all actions visible", () => {
		const handle = createPageHeader(makeConfig({ actions: makeActions(3) }));
		expect(handle.visibleCount).toBe(3);
		handle.destroy();
	});

	it("renders one button per action when applied to a leaf", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const handle = createPageHeader(makeConfig());

		handle.apply(leaf);
		await expectButtons(actionsEl, 3);

		await act(async () => handle.destroy());
	});

	it("hides existing buttons in override mode (default)", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const existing = document.createElement("div");
		actionsEl.appendChild(existing);

		const handle = createPageHeader(makeConfig());
		handle.apply(leaf);
		await flushReact();

		expect(existing.classList.contains("page-header-original-hidden")).toBe(true);
		await act(async () => handle.destroy());
	});

	it("does not hide existing buttons in append mode", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const existing = document.createElement("div");
		actionsEl.appendChild(existing);

		const handle = createPageHeader(makeConfig({ mode: "append" }));
		handle.apply(leaf);
		await expectButtons(actionsEl, 3);

		expect(existing.classList.contains("page-header-original-hidden")).toBe(false);
		await act(async () => handle.destroy());
	});

	it("restores existing buttons on remove", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const existing = document.createElement("div");
		actionsEl.appendChild(existing);

		const handle = createPageHeader(makeConfig());
		handle.apply(leaf);
		await flushReact();
		expect(existing.classList.contains("page-header-original-hidden")).toBe(true);

		await act(async () => handle.remove(leaf));
		expect(existing.classList.contains("page-header-original-hidden")).toBe(false);
		await act(async () => handle.destroy());
	});

	it("removes our buttons on remove", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const handle = createPageHeader(makeConfig());

		handle.apply(leaf);
		await expectButtons(actionsEl, 3);

		await act(async () => handle.remove(leaf));
		expect(buttonsIn(actionsEl).length).toBe(0);
		await act(async () => handle.destroy());
	});

	it("destroys all leaf state and restores existing buttons", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const existing = document.createElement("div");
		actionsEl.appendChild(existing);

		const handle = createPageHeader(makeConfig());
		handle.apply(leaf);
		await flushReact();

		await act(async () => handle.destroy());
		expect(existing.classList.contains("page-header-original-hidden")).toBe(false);
		expect(buttonsIn(actionsEl).length).toBe(0);
	});

	it("no-ops apply after destroy", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const handle = createPageHeader(makeConfig());

		handle.destroy();
		handle.apply(leaf);
		await flushReact();
		expect(buttonsIn(actionsEl).length).toBe(0);
	});

	it("applies to multiple leaves independently", async () => {
		const leaf1 = makeLeaf();
		const leaf2 = makeLeaf();
		const handle = createPageHeader(makeConfig());

		handle.apply(leaf1.leaf);
		handle.apply(leaf2.leaf);
		await expectButtons(leaf1.actionsEl, 3);
		await expectButtons(leaf2.actionsEl, 3);

		await act(async () => handle.remove(leaf1.leaf));
		expect(buttonsIn(leaf1.actionsEl).length).toBe(0);
		expect(buttonsIn(leaf2.actionsEl).length).toBe(3);

		await act(async () => handle.destroy());
	});

	it("re-applying to the same leaf replaces buttons", async () => {
		const { leaf, actionsEl } = makeLeaf();
		const handle = createPageHeader(makeConfig());

		handle.apply(leaf);
		await expectButtons(actionsEl, 3);
		handle.apply(leaf);
		await expectButtons(actionsEl, 3);

		await act(async () => handle.destroy());
	});

	it("emits state on hideAction", () => {
		const onStateChange = vi.fn();
		const handle = createPageHeader(makeConfig({ onStateChange }));

		handle.hideAction("action-0");
		expect(handle.visibleCount).toBe(2);
		expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ visibleActionIds: ["action-1", "action-2"] }));

		handle.destroy();
	});

	it("hideAction is a no-op when only one action visible", () => {
		const handle = createPageHeader(makeConfig({ actions: makeActions(1) }));

		handle.hideAction("action-0");
		expect(handle.visibleCount).toBe(1);

		handle.destroy();
	});

	it("emits state on moveAction", () => {
		const onStateChange = vi.fn();
		const handle = createPageHeader(makeConfig({ onStateChange }));

		handle.moveAction("action-0", 1);
		expect(onStateChange).toHaveBeenCalledWith(
			expect.objectContaining({ visibleActionIds: ["action-1", "action-0", "action-2"] })
		);

		handle.destroy();
	});

	it("restores from currentState", () => {
		const handle = createPageHeader(
			makeConfig({
				currentState: {
					visibleActionIds: ["action-2", "action-0"],
					renames: { "action-0": "Renamed" },
				},
			})
		);

		expect(handle.visibleCount).toBe(2);
		const state = handle.getState();
		expect(state.visibleActionIds).toEqual(["action-2", "action-0"]);
		expect(state.renames).toEqual({ "action-0": "Renamed" });

		handle.destroy();
	});

	it("forwards click to the action's onAction with the view", async () => {
		const { leaf, actionsEl, view } = makeLeaf();
		const onAction = vi.fn();
		const actions: HeaderActionDefinition[] = [{ id: "create", label: "Create", icon: "plus", onAction }];
		const handle = createPageHeader(makeConfig({ actions }));

		handle.apply(leaf);
		await waitFor(() => expect(actionsEl.querySelector(`[data-testid="${PREFIX}toolbar-create"]`)).not.toBeNull());
		const btn = actionsEl.querySelector<HTMLElement>(`[data-testid="${PREFIX}toolbar-create"]`);
		await act(async () => {
			btn?.click();
		});

		expect(onAction).toHaveBeenCalledWith(view);
		await act(async () => handle.destroy());
	});
});
