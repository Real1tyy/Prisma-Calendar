import { describe, expect, it, vi } from "vitest";

import { createTabbedContainer } from "../../src/components/tabbed-container/tabbed-container";
import type {
	GroupTabDefinition,
	TabbedContainerConfig,
	TabDefinition,
} from "../../src/components/tabbed-container/types";

function makeTabs(count: number, renderSpy?: ReturnType<typeof vi.fn>): TabDefinition[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `tab-${i}`,
		label: `Tab ${i}`,
		render: renderSpy ?? vi.fn((el: HTMLElement) => (el.textContent = `Content ${i}`)),
		cleanup: vi.fn(),
	}));
}

function makeConfig(overrides?: Partial<TabbedContainerConfig>): TabbedContainerConfig {
	return {
		tabs: makeTabs(3),
		cssPrefix: "test-",
		...overrides,
	};
}

function makeGroupTab(id: string, childCount: number): GroupTabDefinition {
	return {
		id,
		label: `Group ${id}`,
		children: Array.from({ length: childCount }, (_, i) => ({
			id: `${id}-child-${i}`,
			label: `Child ${i}`,
			render: vi.fn((el: HTMLElement) => (el.textContent = `Child content ${i}`)),
			cleanup: vi.fn(),
		})),
	};
}

function makeConfigWithGroup(overrides?: Partial<TabbedContainerConfig>): TabbedContainerConfig {
	return {
		tabs: [
			{ id: "plain-0", label: "Plain 0", render: vi.fn(), cleanup: vi.fn() },
			makeGroupTab("group-1", 3),
			{ id: "plain-1", label: "Plain 1", render: vi.fn(), cleanup: vi.fn() },
		],
		cssPrefix: "test-",
		...overrides,
	};
}

function isHidden(panel: HTMLElement): boolean {
	return panel.classList.contains("test-tab-panel-hidden");
}

describe("createTabbedContainer", () => {
	it("creates tab bar and content containers", () => {
		const container = document.createElement("div");
		createTabbedContainer(container, makeConfig());

		expect(container.querySelector(".test-tab-bar")).toBeTruthy();
		expect(container.querySelector(".test-tab-content")).toBeTruthy();
	});

	it("creates one button per tab in the tab bar", () => {
		const container = document.createElement("div");
		createTabbedContainer(container, makeConfig());

		const buttons = container.querySelectorAll(".test-tab-bar button");
		expect(buttons.length).toBe(3);
		expect(buttons[0].textContent).toBe("Tab 0");
		expect(buttons[1].textContent).toBe("Tab 1");
		expect(buttons[2].textContent).toBe("Tab 2");
	});

	it("creates one panel per tab", () => {
		const container = document.createElement("div");
		createTabbedContainer(container, makeConfig());

		const panels = container.querySelectorAll(".test-tab-panel");
		expect(panels.length).toBe(3);
	});

	it("first tab is active by default", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		expect(handle.activeIndex).toBe(0);
		expect(handle.activeId).toBe("tab-0");

		const panels = container.querySelectorAll<HTMLElement>(".test-tab-panel");
		expect(isHidden(panels[0])).toBe(false);
		expect(isHidden(panels[1])).toBe(true);
		expect(isHidden(panels[2])).toBe(true);

		const buttons = container.querySelectorAll("button");
		expect(buttons[0].classList.contains("test-tab-active")).toBe(true);
		expect(buttons[1].classList.contains("test-tab-active")).toBe(false);
	});

	it("switchTo by index shows correct panel", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(2);

		expect(handle.activeIndex).toBe(2);
		expect(handle.activeId).toBe("tab-2");

		const panels = container.querySelectorAll<HTMLElement>(".test-tab-panel");
		expect(isHidden(panels[0])).toBe(true);
		expect(isHidden(panels[2])).toBe(false);
	});

	it("switchTo by string id shows correct panel", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo("tab-1");

		expect(handle.activeIndex).toBe(1);
		expect(handle.activeId).toBe("tab-1");
	});

	it("switchTo with out-of-bounds index is a no-op", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(99);
		expect(handle.activeIndex).toBe(0);

		handle.switchTo(-1);
		expect(handle.activeIndex).toBe(0);
	});

	it("switchTo with unknown id is a no-op", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo("nonexistent");
		expect(handle.activeIndex).toBe(0);
	});

	it("switchTo same index is a no-op", () => {
		const onTabChange = vi.fn();
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig({ onTabChange }));

		handle.switchTo(0);
		expect(onTabChange).not.toHaveBeenCalled();
	});

	it("next wraps around", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.next();
		expect(handle.activeIndex).toBe(1);
		handle.next();
		expect(handle.activeIndex).toBe(2);
		handle.next();
		expect(handle.activeIndex).toBe(0);
	});

	it("previous wraps around", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.previous();
		expect(handle.activeIndex).toBe(2);
		handle.previous();
		expect(handle.activeIndex).toBe(1);
		handle.previous();
		expect(handle.activeIndex).toBe(0);
	});

	it("lazy rendering calls render only on first activation", () => {
		const tabs = makeTabs(3);
		const container = document.createElement("div");
		createTabbedContainer(container, { tabs, cssPrefix: "test-", lazy: true });

		expect(tabs[0].render).toHaveBeenCalledOnce();
		expect(tabs[1].render).not.toHaveBeenCalled();
		expect(tabs[2].render).not.toHaveBeenCalled();
	});

	it("lazy rendering renders tab on first switch only", () => {
		const tabs = makeTabs(3);
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs, cssPrefix: "test-", lazy: true });

		handle.switchTo(1);
		expect(tabs[1].render).toHaveBeenCalledOnce();

		handle.switchTo(0);
		handle.switchTo(1);
		expect(tabs[1].render).toHaveBeenCalledOnce();
	});

	it("eager rendering calls all render closures on creation", () => {
		const tabs = makeTabs(3);
		const container = document.createElement("div");
		createTabbedContainer(container, { tabs, cssPrefix: "test-", lazy: false });

		expect(tabs[0].render).toHaveBeenCalledOnce();
		expect(tabs[1].render).toHaveBeenCalledOnce();
		expect(tabs[2].render).toHaveBeenCalledOnce();
	});

	it("onTabChange fires on switch", () => {
		const onTabChange = vi.fn();
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig({ onTabChange }));

		handle.switchTo(1);
		expect(onTabChange).toHaveBeenCalledWith("tab-1", 1);

		handle.switchTo(2);
		expect(onTabChange).toHaveBeenCalledWith("tab-2", 2);
	});

	it("destroy calls all cleanup functions", () => {
		const tabs = makeTabs(3);
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs, cssPrefix: "test-" });

		handle.destroy();

		for (const tab of tabs) {
			expect(tab.cleanup).toHaveBeenCalledOnce();
		}
	});

	it("destroy empties the container", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		expect(container.children.length).toBeGreaterThan(0);

		handle.destroy();
		expect(container.innerHTML).toBe("");
	});

	it("operations after destroy are no-ops", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());
		handle.destroy();

		handle.switchTo(1);
		handle.next();
		handle.previous();
		expect(handle.activeIndex).toBe(0);
	});

	it("tabCount reflects number of tabs", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		expect(handle.tabCount).toBe(3);
	});

	it("handles zero tabs gracefully", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs: [], cssPrefix: "test-" });

		expect(handle.tabCount).toBe(0);
		expect(handle.activeIndex).toBe(0);
		expect(handle.activeId).toBe("");

		handle.next();
		handle.previous();
		handle.switchTo(0);
		handle.destroy();
	});

	it("handles single tab", () => {
		const tabs = makeTabs(1);
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs, cssPrefix: "test-" });

		expect(handle.tabCount).toBe(1);
		expect(handle.activeIndex).toBe(0);

		handle.next();
		expect(handle.activeIndex).toBe(0);
	});

	it("clicking a tab button switches to it", () => {
		const onTabChange = vi.fn();
		const container = document.createElement("div");
		createTabbedContainer(container, makeConfig({ onTabChange }));

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		buttons[2].click();

		expect(onTabChange).toHaveBeenCalledWith("tab-2", 2);
	});

	it("tab buttons have data-tab-id attribute", () => {
		const container = document.createElement("div");
		createTabbedContainer(container, makeConfig());

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		expect(buttons[0].dataset.tabId).toBe("tab-0");
		expect(buttons[1].dataset.tabId).toBe("tab-1");
		expect(buttons[2].dataset.tabId).toBe("tab-2");
	});

	it("updates active class on buttons when switching", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		const buttons = container.querySelectorAll("button");

		expect(buttons[0].classList.contains("test-tab-active")).toBe(true);
		expect(buttons[1].classList.contains("test-tab-active")).toBe(false);

		handle.switchTo(1);

		expect(buttons[0].classList.contains("test-tab-active")).toBe(false);
		expect(buttons[1].classList.contains("test-tab-active")).toBe(true);
	});

	it("initialState.visibleTabIds controls which tabs are shown", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(
			container,
			makeConfig({
				initialState: { visibleTabIds: ["tab-2", "tab-0"] },
			})
		);

		expect(handle.tabCount).toBe(2);
		expect(handle.activeId).toBe("tab-2");

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		expect(buttons.length).toBe(2);
		expect(buttons[0].dataset.tabId).toBe("tab-2");
		expect(buttons[1].dataset.tabId).toBe("tab-0");
	});

	it("initialState.renames overrides tab labels", () => {
		const container = document.createElement("div");
		createTabbedContainer(
			container,
			makeConfig({
				initialState: { renames: { "tab-1": "Custom Name" } },
			})
		);

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		expect(buttons[0].textContent).toBe("Tab 0");
		expect(buttons[1].textContent).toBe("Custom Name");
		expect(buttons[2].textContent).toBe("Tab 2");
	});

	it("getState returns current state with visibleTabIds when order differs", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(
			container,
			makeConfig({
				initialState: { visibleTabIds: ["tab-2", "tab-0"] },
			})
		);

		const state = handle.getState();
		expect(state.visibleTabIds).toEqual(["tab-2", "tab-0"]);
	});

	it("getState omits visibleTabIds when all tabs shown in default order", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		const state = handle.getState();
		expect(state.visibleTabIds).toBeUndefined();
	});

	it("onStateChange fires with full state on tab switch", () => {
		const onStateChange = vi.fn();
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig({ onStateChange }));

		handle.switchTo(2);
		expect(onStateChange).toHaveBeenCalled();
	});

	it("moveTab swaps tab order and preserves active tab", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(0);
		handle.moveTab("tab-0", 1);

		expect(handle.activeId).toBe("tab-0");
		expect(handle.activeIndex).toBe(1);

		const state = handle.getState();
		expect(state.visibleTabIds).toEqual(["tab-1", "tab-0", "tab-2"]);
	});

	it("moveTab left works correctly", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(2);
		handle.moveTab("tab-2", -1);

		expect(handle.activeId).toBe("tab-2");
		expect(handle.activeIndex).toBe(1);

		const state = handle.getState();
		expect(state.visibleTabIds).toEqual(["tab-0", "tab-2", "tab-1"]);
	});

	it("moveTab at boundary is a no-op", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.moveTab("tab-0", -1);
		expect(handle.getState().visibleTabIds).toBeUndefined();

		handle.moveTab("tab-2", 1);
		expect(handle.getState().visibleTabIds).toBeUndefined();
	});

	it("moveTab preserves active tab when moving a non-active tab", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(0);
		handle.moveTab("tab-1", 1);

		expect(handle.activeId).toBe("tab-0");
		expect(handle.activeIndex).toBe(0);
	});

	it("moveTab updates button order in DOM", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.moveTab("tab-0", 1);

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		expect(buttons[0].dataset.tabId).toBe("tab-1");
		expect(buttons[1].dataset.tabId).toBe("tab-0");
		expect(buttons[2].dataset.tabId).toBe("tab-2");
	});

	it("hideTab removes a tab and adjusts active index", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(1);
		handle.hideTab("tab-1");

		expect(handle.tabCount).toBe(2);
		expect(handle.activeId).not.toBe("tab-1");

		const state = handle.getState();
		expect(state.visibleTabIds).toEqual(["tab-0", "tab-2"]);
	});

	it("hideTab when active tab is hidden activates nearest", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(2);
		handle.hideTab("tab-2");

		expect(handle.tabCount).toBe(2);
		expect(handle.activeIndex).toBe(1);
		expect(handle.activeId).toBe("tab-1");
	});

	it("hideTab when first tab is hidden keeps correct active", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(1);
		handle.hideTab("tab-0");

		expect(handle.activeId).toBe("tab-1");
		expect(handle.tabCount).toBe(2);
	});

	it("hideTab is a no-op when only one tab visible", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.hideTab("tab-0");
		handle.hideTab("tab-1");
		handle.hideTab("tab-2");

		expect(handle.tabCount).toBe(1);
	});

	it("hideTab removes button from DOM", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.hideTab("tab-1");

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		expect(buttons.length).toBe(2);
		expect(buttons[0].dataset.tabId).toBe("tab-0");
		expect(buttons[1].dataset.tabId).toBe("tab-2");
	});

	it("restoreTab brings back a hidden tab", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.hideTab("tab-1");
		expect(handle.tabCount).toBe(2);

		handle.restoreTab("tab-1");
		expect(handle.tabCount).toBe(3);

		const state = handle.getState();
		expect(state.visibleTabIds).toContain("tab-1");
	});

	it("restoreTab preserves the active tab", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.switchTo(2);
		handle.hideTab("tab-0");
		expect(handle.activeId).toBe("tab-2");

		handle.restoreTab("tab-0");
		expect(handle.activeId).toBe("tab-2");
	});

	it("restoreTab is a no-op for already-visible tab", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.restoreTab("tab-0");
		expect(handle.tabCount).toBe(3);
	});

	it("moveTab emits onStateChange", () => {
		const onStateChange = vi.fn();
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig({ onStateChange }));

		handle.moveTab("tab-0", 1);
		expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ visibleTabIds: ["tab-1", "tab-0", "tab-2"] }));
	});

	it("hideTab emits onStateChange", () => {
		const onStateChange = vi.fn();
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig({ onStateChange }));

		handle.hideTab("tab-1");
		expect(onStateChange).toHaveBeenCalledWith(expect.objectContaining({ visibleTabIds: ["tab-0", "tab-2"] }));
	});

	it("panel content preserved after moveTab", () => {
		const tabs = makeTabs(3);
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs, cssPrefix: "test-" });

		handle.switchTo(0);

		const panelBefore = container.querySelector<HTMLElement>('.test-tab-content [data-tab-id="tab-0"]');
		expect(panelBefore).toBeTruthy();

		handle.moveTab("tab-0", 1);

		const panelAfter = container.querySelector<HTMLElement>('.test-tab-content [data-tab-id="tab-0"]');
		expect(panelAfter).toBeTruthy();
		expect(panelAfter).toBe(panelBefore);
	});

	it("panel content preserved after hideTab and restoreTab", () => {
		const tabs = makeTabs(3);
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs, cssPrefix: "test-" });

		handle.switchTo(1);
		const panelBefore = container.querySelector<HTMLElement>('.test-tab-content [data-tab-id="tab-1"]');

		handle.hideTab("tab-1");
		handle.restoreTab("tab-1");

		const panelAfter = container.querySelector<HTMLElement>('.test-tab-content [data-tab-id="tab-1"]');
		expect(panelAfter).toBe(panelBefore);
	});

	it("switching to a tab after moveTab renders correctly", () => {
		const tabs = makeTabs(3);
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs, cssPrefix: "test-" });

		handle.moveTab("tab-0", 1);
		handle.switchTo("tab-2");

		expect(handle.activeId).toBe("tab-2");
		expect(handle.activeIndex).toBe(2);

		const panel = container.querySelector<HTMLElement>('[data-tab-id="tab-2"]');
		expect(panel).toBeTruthy();
		expect(isHidden(panel!)).toBe(false);
	});

	it("multiple moves maintain correct state", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.moveTab("tab-0", 1);
		handle.moveTab("tab-0", 1);

		const state = handle.getState();
		expect(state.visibleTabIds).toEqual(["tab-1", "tab-2", "tab-0"]);
	});

	it("editable renders settings button in tab bar", () => {
		const container = document.createElement("div");
		createTabbedContainer(
			container,
			makeConfig({
				editable: true,
				app: {} as never,
			})
		);

		const settingsBtn = container.querySelector(".test-tab-settings");
		expect(settingsBtn).toBeTruthy();
	});

	it("showTabManager is a no-op without app", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());

		handle.showTabManager();
	});

	it("showTabManager is a no-op after destroy", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfig());
		handle.destroy();

		handle.showTabManager();
	});
});

describe("group tabs", () => {
	it("creates tab bar with group tab showing group label", () => {
		const container = document.createElement("div");
		createTabbedContainer(container, makeConfigWithGroup());

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		expect(buttons.length).toBeGreaterThanOrEqual(2);
	});

	it("renders panel for group active child", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, makeConfigWithGroup());

		handle.switchTo("group-1");
		const panel = container.querySelector('[data-tab-id="group-1-child-0"]');
		expect(panel).toBeTruthy();
	});

	it("destroy calls cleanup on group children", () => {
		const group = makeGroupTab("g", 2);
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, { tabs: [group], cssPrefix: "test-" });

		handle.destroy();

		for (const child of group.children) {
			expect(child.cleanup).toHaveBeenCalledOnce();
		}
	});

	it("getState includes groupState when child visibility changes", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, {
			tabs: [makeGroupTab("g", 3)],
			cssPrefix: "test-",
			initialState: {
				groupState: {
					g: { visibleChildIds: ["g-child-2", "g-child-0"] },
				},
			},
		});

		const state = handle.getState();
		expect(state.groupState?.g?.visibleChildIds).toEqual(["g-child-2", "g-child-0"]);
	});
});

describe("tab icons", () => {
	it("renders icon span when tab has icon", () => {
		const container = document.createElement("div");
		const tabs = [
			{ id: "tab-0", label: "Tab 0", icon: "calendar", render: vi.fn() },
			{ id: "tab-1", label: "Tab 1", render: vi.fn() },
		];
		createTabbedContainer(container, { tabs, cssPrefix: "test-" });

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		expect(buttons[0].querySelector(".test-tab-icon")).toBeTruthy();
		expect(buttons[1].querySelector(".test-tab-icon")).toBeNull();
	});

	it("tab label text is preserved when icon is present", () => {
		const container = document.createElement("div");
		const tabs = [{ id: "tab-0", label: "Tab 0", icon: "calendar", render: vi.fn() }];
		createTabbedContainer(container, { tabs, cssPrefix: "test-" });

		const button = container.querySelector(".test-tab-bar button") as HTMLElement;
		expect(button.textContent).toBe("Tab 0");
	});

	it("tab without icon renders label with no icon span", () => {
		const container = document.createElement("div");
		createTabbedContainer(container, makeConfig());

		const buttons = container.querySelectorAll<HTMLElement>(".test-tab-bar button");
		for (const btn of buttons) {
			expect(btn.querySelector(".test-tab-icon")).toBeNull();
		}
	});
});

describe("group tab manager modal", () => {
	it("showTabManager does not throw with group tabs", () => {
		const container = document.createElement("div");
		const handle = createTabbedContainer(container, {
			...makeConfigWithGroup(),
			editable: true,
			app: {} as never,
		});
		expect(() => handle.showTabManager()).not.toThrow();
	});
});
