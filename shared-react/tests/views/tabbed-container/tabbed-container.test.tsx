import { act, screen } from "@testing-library/react";
import type { App } from "obsidian";
import { createElement, type RefObject } from "react";
import { describe, expect, it, vi } from "vitest";

import { TabbedContainer, type TabbedContainerHandle, type TabEntry } from "../../../src/views/tabbed-container/index";
import { MountImperative } from "../../../src/widgets/mount-imperative/mount-imperative";
import { renderReact } from "../../helpers/render-react";

const stubApp = {} as unknown as App;

function makeTabs(count = 3): TabEntry[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `tab-${i}`,
		label: `Tab ${i}`,
		content: <div data-testid={`content-${i}`}>Content {i}</div>,
	}));
}

function makeRef(): RefObject<TabbedContainerHandle | null> {
	return { current: null };
}

describe("TabbedContainer", () => {
	it("renders one button per visible tab", () => {
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" />);
		expect(screen.getByTestId("t-view-tab-tab-0")).toBeInTheDocument();
		expect(screen.getByTestId("t-view-tab-tab-1")).toBeInTheDocument();
		expect(screen.getByTestId("t-view-tab-tab-2")).toBeInTheDocument();
	});

	it("activates the first tab by default", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		expect(handleRef.current?.activeId).toBe("tab-0");
		expect(screen.getByTestId("t-view-tab-tab-0")).toHaveAttribute("aria-selected", "true");
	});

	it("switches tab on click and fires onTabChange", async () => {
		const onTabChange = vi.fn();
		const { user } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" onTabChange={onTabChange} />);

		await user.click(screen.getByTestId("t-view-tab-tab-2"));
		expect(onTabChange).toHaveBeenCalledWith("tab-2", 2);
		expect(screen.getByTestId("t-view-tab-tab-2")).toHaveAttribute("aria-selected", "true");
	});

	it("emits a state snapshot on tab switch via onStateChange", async () => {
		const onStateChange = vi.fn();
		const { user } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" onStateChange={onStateChange} />);

		await user.click(screen.getByTestId("t-view-tab-tab-1"));
		expect(onStateChange).toHaveBeenCalled();
		expect(onStateChange.mock.calls[onStateChange.mock.calls.length - 1][0]).toEqual({});
	});

	it("only renders the active tab content with lazy=true", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);

		expect(screen.getByTestId("content-0")).toBeInTheDocument();
		expect(screen.queryByTestId("content-1")).not.toBeInTheDocument();
		expect(screen.queryByTestId("content-2")).not.toBeInTheDocument();
	});

	it("renders all tab content with lazy=false", () => {
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" lazy={false} />);
		expect(screen.getByTestId("content-0")).toBeInTheDocument();
		expect(screen.getByTestId("content-1")).toBeInTheDocument();
		expect(screen.getByTestId("content-2")).toBeInTheDocument();
	});

	it("keeps previously-rendered tabs mounted after switching back (lazy)", async () => {
		const { user } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" />);

		await user.click(screen.getByTestId("t-view-tab-tab-1"));
		expect(screen.getByTestId("content-1")).toBeInTheDocument();
		// content-0 was mounted first; should remain in DOM (just hidden)
		expect(screen.getByTestId("content-0")).toBeInTheDocument();

		await user.click(screen.getByTestId("t-view-tab-tab-0"));
		expect(screen.getByTestId("content-0")).toBeInTheDocument();
	});

	// Lazy gate: a tab's content thunk must not fire until the tab is first
	// activated. Re-invocation on later re-renders is fine — the thunk only
	// produces React elements that reconcile. The expensive work lives inside
	// components like `MountImperative`, which is tested below.
	it("never invokes a content thunk until its tab is first activated", async () => {
		const thunk0 = vi.fn(() => <div data-testid="content-0">0</div>);
		const thunk1 = vi.fn(() => <div data-testid="content-1">1</div>);
		const thunk2 = vi.fn(() => <div data-testid="content-2">2</div>);
		const tabs: TabEntry[] = [
			{ id: "tab-0", label: "Tab 0", content: thunk0 },
			{ id: "tab-1", label: "Tab 1", content: thunk1 },
			{ id: "tab-2", label: "Tab 2", content: thunk2 },
		];

		const { user } = renderReact(<TabbedContainer tabs={tabs} cssPrefix="t-" />);

		// Initial render: only the active tab's thunk fired.
		expect(thunk0).toHaveBeenCalled();
		expect(thunk1).not.toHaveBeenCalled();
		expect(thunk2).not.toHaveBeenCalled();

		// Switching to tab-1 invokes its thunk for the first time.
		await user.click(screen.getByTestId("t-view-tab-tab-1"));
		expect(thunk1).toHaveBeenCalled();
		expect(thunk2).not.toHaveBeenCalled();

		// Tab-2 still hasn't been touched, even after a switch.
		await user.click(screen.getByTestId("t-view-tab-tab-0"));
		expect(thunk2).not.toHaveBeenCalled();

		// First visit to tab-2 finally invokes its thunk.
		await user.click(screen.getByTestId("t-view-tab-tab-2"));
		expect(thunk2).toHaveBeenCalled();
	});

	it("does not invoke any non-active tab's content thunk on initial mount", () => {
		const thunk0 = vi.fn(() => <div data-testid="content-0">0</div>);
		const thunk1 = vi.fn(() => <div data-testid="content-1">1</div>);
		const thunk2 = vi.fn(() => <div data-testid="content-2">2</div>);
		const tabs: TabEntry[] = [
			{ id: "tab-0", label: "Tab 0", content: thunk0 },
			{ id: "tab-1", label: "Tab 1", content: thunk1 },
			{ id: "tab-2", label: "Tab 2", content: thunk2 },
		];

		renderReact(<TabbedContainer tabs={tabs} cssPrefix="t-" />);
		expect(thunk1).not.toHaveBeenCalled();
		expect(thunk2).not.toHaveBeenCalled();
	});

	it("invokes every tab's content thunk eagerly when lazy=false", () => {
		const thunk0 = vi.fn(() => <div data-testid="content-0">0</div>);
		const thunk1 = vi.fn(() => <div data-testid="content-1">1</div>);
		const thunk2 = vi.fn(() => <div data-testid="content-2">2</div>);
		const tabs: TabEntry[] = [
			{ id: "tab-0", label: "Tab 0", content: thunk0 },
			{ id: "tab-1", label: "Tab 1", content: thunk1 },
			{ id: "tab-2", label: "Tab 2", content: thunk2 },
		];

		renderReact(<TabbedContainer tabs={tabs} cssPrefix="t-" lazy={false} />);
		expect(thunk0).toHaveBeenCalledTimes(1);
		expect(thunk1).toHaveBeenCalledTimes(1);
		expect(thunk2).toHaveBeenCalledTimes(1);
	});

	// The real-world case: each tab's body is a `MountImperative` wrapping
	// an expensive imperative engine (FullCalendar, Chart.js, etc.). The
	// lazy gate must keep the engine from booting until the user actually
	// visits the tab — that's what makes the calendar view affordable.
	it("does not call MountImperative's render until the wrapping tab is first activated", async () => {
		const render0 = vi.fn();
		const render1 = vi.fn();
		const render2 = vi.fn();
		const tabs: TabEntry[] = [
			{ id: "tab-0", label: "Tab 0", content: createElement(MountImperative, { render: render0 }) },
			{
				id: "tab-1",
				label: "Tab 1",
				content: () => createElement(MountImperative, { render: render1 }),
			},
			{
				id: "tab-2",
				label: "Tab 2",
				content: () => createElement(MountImperative, { render: render2 }),
			},
		];

		const { user } = renderReact(<TabbedContainer tabs={tabs} cssPrefix="t-" />);

		// Initial render mounts only tab-0's imperative engine.
		expect(render0).toHaveBeenCalledTimes(1);
		expect(render1).not.toHaveBeenCalled();
		expect(render2).not.toHaveBeenCalled();

		// Visiting tab-1 boots tab-1's engine for the first time.
		await user.click(screen.getByTestId("t-view-tab-tab-1"));
		expect(render1).toHaveBeenCalledTimes(1);
		expect(render2).not.toHaveBeenCalled();

		// Going back to tab-0 must NOT re-boot its engine — MountImperative
		// holds the same React instance, just unhides its panel.
		await user.click(screen.getByTestId("t-view-tab-tab-0"));
		expect(render0).toHaveBeenCalledTimes(1);

		// And tab-2 is still untouched.
		expect(render2).not.toHaveBeenCalled();

		// First visit boots it.
		await user.click(screen.getByTestId("t-view-tab-tab-2"));
		expect(render2).toHaveBeenCalledTimes(1);
	});

	it("renames tabs from currentState", () => {
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" currentState={{ renames: { "tab-1": "Custom" } }} />);
		expect(screen.getByTestId("t-view-tab-tab-1")).toHaveTextContent("Custom");
	});

	it("respects visibleTabIds in currentState", () => {
		const handleRef = makeRef();
		renderReact(
			<TabbedContainer
				tabs={makeTabs()}
				cssPrefix="t-"
				currentState={{ visibleTabIds: ["tab-2", "tab-0"] }}
				handleRef={handleRef}
			/>
		);
		expect(handleRef.current?.tabCount).toBe(2);
		expect(handleRef.current?.activeId).toBe("tab-2");
	});

	it("renders an icon span when a tab declares an icon", () => {
		const tabs: TabEntry[] = [
			{ id: "with-icon", label: "Tab", icon: "calendar", content: null },
			{ id: "no-icon", label: "Plain", content: null },
		];
		const { container } = renderReact(<TabbedContainer tabs={tabs} cssPrefix="t-" />);
		expect(container.querySelector('[data-tab-id="with-icon"] .t-tab-icon')).toBeInTheDocument();
		expect(container.querySelector('[data-tab-id="no-icon"] .t-tab-icon')).toBeNull();
	});

	it("applies colorOverrides to the icon span", () => {
		const tabs: TabEntry[] = [{ id: "x", label: "X", icon: "star", content: null }];
		const { container } = renderReact(
			<TabbedContainer tabs={tabs} cssPrefix="t-" currentState={{ colorOverrides: { x: "rgb(255, 0, 0)" } }} />
		);
		const iconEl = container.querySelector<HTMLElement>(".t-tab-icon");
		expect(iconEl?.style.color).toBe("rgb(255, 0, 0)");
	});
});

describe("TabbedContainer imperative handle", () => {
	it("exposes tabCount, activeIndex, activeId", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		expect(handleRef.current?.tabCount).toBe(3);
		expect(handleRef.current?.activeIndex).toBe(0);
		expect(handleRef.current?.activeId).toBe("tab-0");
	});

	it("switchTo changes the active tab", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.switchTo(2));
		expect(handleRef.current?.activeId).toBe("tab-2");
	});

	it("next/previous wrap around", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);

		act(() => handleRef.current!.previous());
		expect(handleRef.current?.activeIndex).toBe(2);

		act(() => handleRef.current!.next());
		expect(handleRef.current?.activeIndex).toBe(0);
	});

	it("hideTab removes a tab and adjusts activeId", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);

		act(() => handleRef.current!.switchTo(2));
		act(() => handleRef.current!.hideTab("tab-2"));

		expect(handleRef.current?.tabCount).toBe(2);
		expect(handleRef.current?.activeId).not.toBe("tab-2");
	});

	it("hideTab is a no-op when only one tab is visible", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs(1)} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.hideTab("tab-0"));
		expect(handleRef.current?.tabCount).toBe(1);
	});

	it("restoreTab brings back a hidden tab", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);

		act(() => handleRef.current!.hideTab("tab-1"));
		expect(handleRef.current?.tabCount).toBe(2);

		act(() => handleRef.current!.restoreTab("tab-1"));
		expect(handleRef.current?.tabCount).toBe(3);
	});

	it("moveTab swaps adjacent tabs and preserves the active id", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);

		act(() => handleRef.current!.moveTab("tab-0", 1));
		const state = handleRef.current!.getState();
		expect(state.visibleTabIds).toEqual(["tab-1", "tab-0", "tab-2"]);
	});

	it("getVisibleLabels returns ordered labels honoring renames", () => {
		const handleRef = makeRef();
		renderReact(
			<TabbedContainer
				tabs={makeTabs()}
				cssPrefix="t-"
				currentState={{ renames: { "tab-1": "Custom" } }}
				handleRef={handleRef}
			/>
		);
		expect(handleRef.current?.getVisibleLabels()).toEqual(["Tab 0", "Custom", "Tab 2"]);
	});
});

describe("TabbedContainer manage button", () => {
	it("renders the manage button when editable + app are provided", () => {
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" editable app={stubApp} />);
		expect(screen.getByTestId("t-tabbed-container-manage")).toBeInTheDocument();
	});

	it("hides the manage button when showSettingsButton is false", () => {
		renderReact(
			<TabbedContainer
				tabs={makeTabs()}
				cssPrefix="t-"
				editable
				app={stubApp}
				currentState={{ showSettingsButton: false }}
			/>
		);
		expect(screen.queryByTestId("t-tabbed-container-manage")).not.toBeInTheDocument();
	});

	it("does not render the manage button when editable=false", () => {
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" />);
		expect(screen.queryByTestId("t-tabbed-container-manage")).not.toBeInTheDocument();
	});

	// Modal lifecycle / portal teardown regressions live in use-modal-portal.test.tsx
	// where an enhanced Modal mock fires onOpen/onClose. The shared mock here is
	// just spies, so those scenarios can't be exercised through TabbedContainer.
});

describe("TabbedContainer groups", () => {
	const groupTabs: TabEntry[] = [
		{
			id: "single",
			label: "Single",
			content: <div data-testid="single-body">Single</div>,
		},
		{
			id: "g",
			label: "Group",
			children: [
				{ id: "child-a", label: "Child A", content: <div data-testid="child-a-body">A</div> },
				{ id: "child-b", label: "Child B", content: <div data-testid="child-b-body">B</div> },
			],
		},
	];

	it("renders the group's first child by default", () => {
		const handleRef = makeRef();
		renderReact(
			<TabbedContainer tabs={groupTabs} cssPrefix="t-" currentState={{ visibleTabIds: ["g"] }} handleRef={handleRef} />
		);
		expect(screen.getByTestId("child-a-body")).toBeInTheDocument();
	});

	it("opens the dropdown on group tab click and switches to selected child", async () => {
		const { user } = renderReact(
			<TabbedContainer tabs={groupTabs} cssPrefix="t-" currentState={{ visibleTabIds: ["g"] }} />
		);

		await user.click(screen.getByTestId("t-view-tab-g"));
		const childItem = await screen.findByTestId("t-view-tab-child-b");
		await user.click(childItem);

		expect(screen.getByTestId("child-b-body")).toBeInTheDocument();
	});

	it("closes the dropdown on a second click of the group tab", async () => {
		const { user } = renderReact(
			<TabbedContainer tabs={groupTabs} cssPrefix="t-" currentState={{ visibleTabIds: ["g"] }} />
		);

		const groupBtn = screen.getByTestId("t-view-tab-g");
		await user.click(groupBtn);
		expect(screen.getByTestId("t-tab-group-dropdown-g")).toBeInTheDocument();

		await user.click(groupBtn);
		expect(screen.queryByTestId("t-tab-group-dropdown-g")).not.toBeInTheDocument();
	});

	it("renders child icons inside the group dropdown when the children declare icons", async () => {
		const tabsWithChildIcons: TabEntry[] = [
			{
				id: "g",
				label: "Group",
				children: [
					{ id: "child-a", label: "Child A", icon: "calendar", content: null },
					{ id: "child-b", label: "Child B", icon: "star", content: null },
				],
			},
		];
		const { user } = renderReact(<TabbedContainer tabs={tabsWithChildIcons} cssPrefix="t-" />);
		await user.click(screen.getByTestId("t-view-tab-g"));

		const childA = await screen.findByTestId("t-view-tab-child-a");
		const childB = await screen.findByTestId("t-view-tab-child-b");
		expect(childA.querySelector(".t-tab-icon")).toBeInTheDocument();
		expect(childB.querySelector(".t-tab-icon")).toBeInTheDocument();
	});

	it("applies child icon overrides from currentState inside the group dropdown", async () => {
		const tabsWithChildIcons: TabEntry[] = [
			{
				id: "g",
				label: "Group",
				children: [{ id: "child-a", label: "Child A", content: null }],
			},
		];
		const { user } = renderReact(
			<TabbedContainer
				tabs={tabsWithChildIcons}
				cssPrefix="t-"
				currentState={{
					groupState: {
						g: {
							childIconOverrides: { "child-a": "star" },
							childColorOverrides: { "child-a": "rgb(255, 0, 0)" },
						},
					},
				}}
			/>
		);
		await user.click(screen.getByTestId("t-view-tab-g"));

		const childA = await screen.findByTestId("t-view-tab-child-a");
		const iconEl = childA.querySelector<HTMLElement>(".t-tab-icon");
		expect(iconEl).toBeInTheDocument();
		expect(iconEl?.style.color).toBe("rgb(255, 0, 0)");
	});
});

describe("TabbedContainer DOM isolation", () => {
	it("renders the tab bar into an external host when tabBarContainer is provided", () => {
		const externalHost = document.createElement("div");
		externalHost.id = "external-host";
		document.body.appendChild(externalHost);

		try {
			renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" tabBarContainer={externalHost} />);
			const buttons = externalHost.querySelectorAll(".t-tab-bar button");
			expect(buttons.length).toBe(3);
		} finally {
			externalHost.remove();
		}
	});

	it("inserts the tab bar before the given sibling when tabBarInsertBefore is provided", () => {
		const host = document.createElement("div");
		const sibling = document.createElement("span");
		sibling.id = "sibling";
		host.appendChild(sibling);
		document.body.appendChild(host);

		try {
			renderReact(
				<TabbedContainer tabs={makeTabs()} cssPrefix="t-" tabBarContainer={host} tabBarInsertBefore={sibling} />
			);
			// The portal placeholder hosting the tab bar should sit before #sibling.
			expect(host.firstElementChild?.contains(host.querySelector(".t-tab-bar"))).toBe(true);
			expect(host.lastElementChild).toBe(sibling);
		} finally {
			host.remove();
		}
	});

	it("removes the portaled tab bar when the component unmounts", () => {
		const host = document.createElement("div");
		document.body.appendChild(host);

		try {
			const { unmount } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" tabBarContainer={host} />);
			expect(host.querySelectorAll(".t-tab-bar").length).toBe(1);
			unmount();
			expect(host.querySelectorAll(".t-tab-bar").length).toBe(0);
		} finally {
			host.remove();
		}
	});

	it("clears the imperative handle ref on unmount", () => {
		const handleRef = makeRef();
		const { unmount } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		expect(handleRef.current).not.toBeNull();
		unmount();
		expect(handleRef.current).toBeNull();
	});
});

describe("TabbedContainer switchTo guards", () => {
	it("switches by string id", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.switchTo("tab-2"));
		expect(handleRef.current?.activeId).toBe("tab-2");
	});

	it("is a no-op for an out-of-bounds index", () => {
		const handleRef = makeRef();
		const onTabChange = vi.fn();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} onTabChange={onTabChange} />);
		act(() => handleRef.current!.switchTo(99));
		expect(handleRef.current?.activeIndex).toBe(0);
		expect(onTabChange).not.toHaveBeenCalled();
	});

	it("is a no-op for an unknown id", () => {
		const handleRef = makeRef();
		const onTabChange = vi.fn();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} onTabChange={onTabChange} />);
		act(() => handleRef.current!.switchTo("nope"));
		expect(handleRef.current?.activeIndex).toBe(0);
		expect(onTabChange).not.toHaveBeenCalled();
	});

	it("does not re-fire onTabChange for the already-active index", () => {
		const handleRef = makeRef();
		const onTabChange = vi.fn();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} onTabChange={onTabChange} />);
		act(() => handleRef.current!.switchTo(0));
		expect(onTabChange).not.toHaveBeenCalled();
	});

	it("renders cleanly with zero tabs and a no-op next/previous", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={[]} cssPrefix="t-" handleRef={handleRef} />);
		expect(handleRef.current?.tabCount).toBe(0);
		act(() => handleRef.current!.next());
		act(() => handleRef.current!.previous());
		expect(handleRef.current?.activeIndex).toBe(0);
	});
});

describe("TabbedContainer onStateChange on mutations", () => {
	it("fires on moveTab with reordered visibleTabIds", () => {
		const handleRef = makeRef();
		const onStateChange = vi.fn();
		renderReact(
			<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} onStateChange={onStateChange} />
		);
		act(() => handleRef.current!.moveTab("tab-0", 1));
		const last = onStateChange.mock.calls.at(-1)?.[0];
		expect(last?.visibleTabIds).toEqual(["tab-1", "tab-0", "tab-2"]);
	});

	it("fires on hideTab with the remaining visible ids", () => {
		const handleRef = makeRef();
		const onStateChange = vi.fn();
		renderReact(
			<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} onStateChange={onStateChange} />
		);
		act(() => handleRef.current!.hideTab("tab-1"));
		const last = onStateChange.mock.calls.at(-1)?.[0];
		expect(last?.visibleTabIds).toEqual(["tab-0", "tab-2"]);
	});

	it("fires on restoreTab returning to the default ordering", () => {
		const handleRef = makeRef();
		const onStateChange = vi.fn();
		renderReact(
			<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} onStateChange={onStateChange} />
		);
		act(() => handleRef.current!.hideTab("tab-1"));
		act(() => handleRef.current!.restoreTab("tab-1"));
		const last = onStateChange.mock.calls.at(-1)?.[0];
		expect(last?.visibleTabIds ?? []).toContain("tab-1");
	});
});

describe("TabbedContainer mutation invariants", () => {
	it("moveTab preserves the active tab when moving a non-active one", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.switchTo(2));
		expect(handleRef.current?.activeId).toBe("tab-2");

		act(() => handleRef.current!.moveTab("tab-0", 1));
		expect(handleRef.current?.activeId).toBe("tab-2");
		expect(handleRef.current!.getState().visibleTabIds).toEqual(["tab-1", "tab-0", "tab-2"]);
	});

	it("moveTab at the left boundary is a no-op", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.moveTab("tab-0", -1));
		expect(handleRef.current!.getState().visibleTabIds).toBeUndefined();
	});

	it("moveTab at the right boundary is a no-op", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.moveTab("tab-2", 1));
		expect(handleRef.current!.getState().visibleTabIds).toBeUndefined();
	});

	it("restoreTab is a no-op for an already-visible tab", () => {
		const handleRef = makeRef();
		const onStateChange = vi.fn();
		renderReact(
			<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} onStateChange={onStateChange} />
		);
		act(() => handleRef.current!.restoreTab("tab-0"));
		expect(handleRef.current?.tabCount).toBe(3);
		expect(onStateChange).not.toHaveBeenCalled();
	});

	it("restoreTab preserves the active tab", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.switchTo(2));
		act(() => handleRef.current!.hideTab("tab-1"));
		expect(handleRef.current?.activeId).toBe("tab-2");
		act(() => handleRef.current!.restoreTab("tab-1"));
		expect(handleRef.current?.activeId).toBe("tab-2");
	});

	it("hideTab when the active tab is removed activates a sibling", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.switchTo(1));
		act(() => handleRef.current!.hideTab("tab-1"));
		expect(handleRef.current?.activeId).not.toBe("tab-1");
		expect(handleRef.current?.tabCount).toBe(2);
	});
});

describe("TabbedContainer DOM updates", () => {
	it("moveTab updates button order in the tab bar", () => {
		const handleRef = makeRef();
		const { container } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.moveTab("tab-0", 1));
		const order = Array.from(container.querySelectorAll(".t-tab-bar [data-tab-id]")).map((el) =>
			el.getAttribute("data-tab-id")
		);
		expect(order).toEqual(["tab-1", "tab-0", "tab-2"]);
	});

	it("hideTab removes the button from the DOM", () => {
		const handleRef = makeRef();
		renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		act(() => handleRef.current!.hideTab("tab-1"));
		expect(screen.queryByTestId("t-view-tab-tab-1")).not.toBeInTheDocument();
	});

	it("preserves panel content across moveTab", async () => {
		const handleRef = makeRef();
		const { user } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		await user.click(screen.getByTestId("t-view-tab-tab-1"));
		expect(screen.getByTestId("content-1")).toBeInTheDocument();
		act(() => handleRef.current!.moveTab("tab-0", 1));
		expect(screen.getByTestId("content-1")).toBeInTheDocument();
	});

	it("preserves panel content across hideTab + restoreTab", async () => {
		const handleRef = makeRef();
		const { user } = renderReact(<TabbedContainer tabs={makeTabs()} cssPrefix="t-" handleRef={handleRef} />);
		await user.click(screen.getByTestId("t-view-tab-tab-1"));
		await user.click(screen.getByTestId("t-view-tab-tab-2"));
		act(() => handleRef.current!.hideTab("tab-1"));
		act(() => handleRef.current!.restoreTab("tab-1"));
		expect(screen.getByTestId("content-1")).toBeInTheDocument();
	});
});

describe("TabbedContainer icon overrides", () => {
	it("renders iconOverrides from currentState", () => {
		const tabs: TabEntry[] = [{ id: "x", label: "X", icon: "calendar", content: null }];
		const { container } = renderReact(
			<TabbedContainer tabs={tabs} cssPrefix="t-" currentState={{ iconOverrides: { x: "star" } }} />
		);
		expect(container.querySelector('[data-tab-id="x"] .t-tab-icon')).toBeInTheDocument();
	});

	it("adds an icon span when iconOverrides set on a tab that had no default icon", () => {
		const tabs: TabEntry[] = [{ id: "x", label: "X", content: null }];
		const { container } = renderReact(
			<TabbedContainer tabs={tabs} cssPrefix="t-" currentState={{ iconOverrides: { x: "star" } }} />
		);
		expect(container.querySelector('[data-tab-id="x"] .t-tab-icon')).toBeInTheDocument();
	});

	it("does not render an icon span when only a color override is set on an iconless tab", () => {
		const tabs: TabEntry[] = [{ id: "x", label: "X", content: null }];
		const { container } = renderReact(
			<TabbedContainer tabs={tabs} cssPrefix="t-" currentState={{ colorOverrides: { x: "rgb(0, 255, 0)" } }} />
		);
		expect(container.querySelector('[data-tab-id="x"] .t-tab-icon')).toBeNull();
	});
});
