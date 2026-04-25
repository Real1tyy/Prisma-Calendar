import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ReactTabDefinition } from "../../src/views/tabbed-container";
import { TabbedContainer } from "../../src/views/tabbed-container";
import { renderReact } from "../helpers/render-react";

const TABS: ReactTabDefinition[] = [
	{ id: "general", label: "General" },
	{ id: "advanced", label: "Advanced", icon: "settings" },
	{ id: "about", label: "About" },
];

function renderContent(tab: ReactTabDefinition) {
	return <div data-testid={`content-${tab.id}`}>Content for {tab.label}</div>;
}

describe("TabbedContainer", () => {
	it("renders all tab buttons", () => {
		renderReact(<TabbedContainer tabs={TABS} activeId="general" onChange={vi.fn()} renderContent={renderContent} />);

		expect(screen.getByTestId("tab-general")).toBeInTheDocument();
		expect(screen.getByTestId("tab-advanced")).toBeInTheDocument();
		expect(screen.getByTestId("tab-about")).toBeInTheDocument();
	});

	it("marks active tab with aria-selected", () => {
		renderReact(<TabbedContainer tabs={TABS} activeId="advanced" onChange={vi.fn()} renderContent={renderContent} />);

		expect(screen.getByTestId("tab-advanced")).toHaveAttribute("aria-selected", "true");
		expect(screen.getByTestId("tab-general")).toHaveAttribute("aria-selected", "false");
	});

	it("renders active tab content", () => {
		renderReact(<TabbedContainer tabs={TABS} activeId="general" onChange={vi.fn()} renderContent={renderContent} />);

		expect(screen.getByTestId("content-general")).toBeInTheDocument();
	});

	it("fires onChange when a tab is clicked", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(
			<TabbedContainer tabs={TABS} activeId="general" onChange={onChange} renderContent={renderContent} />
		);

		await user.click(screen.getByTestId("tab-advanced"));
		expect(onChange).toHaveBeenCalledWith("advanced");
	});

	it("uses tablist and tabpanel roles", () => {
		renderReact(<TabbedContainer tabs={TABS} activeId="general" onChange={vi.fn()} renderContent={renderContent} />);

		expect(screen.getByRole("tablist")).toBeInTheDocument();
		expect(screen.getAllByRole("tabpanel").length).toBeGreaterThanOrEqual(1);
	});

	it("hides inactive tab panels", () => {
		function Harness() {
			const [activeId, setActiveId] = useState("general");
			return <TabbedContainer tabs={TABS} activeId={activeId} onChange={setActiveId} renderContent={renderContent} />;
		}
		renderReact(<Harness />);

		const generalPanel = screen.getByTestId("tab-content-general");
		expect(generalPanel).not.toHaveClass("tab-panel-hidden");
	});

	it("uses custom testIdPrefix", () => {
		renderReact(
			<TabbedContainer
				tabs={TABS}
				activeId="general"
				onChange={vi.fn()}
				renderContent={renderContent}
				testIdPrefix="custom-"
			/>
		);

		expect(screen.getByTestId("custom-tab-general")).toBeInTheDocument();
		expect(screen.getByTestId("custom-tab-content-general")).toBeInTheDocument();
	});

	it("renders close button for closable tabs when onClose is provided", async () => {
		const onClose = vi.fn();
		const closableTabs: ReactTabDefinition[] = [
			{ id: "tab1", label: "Tab 1", closable: true },
			{ id: "tab2", label: "Tab 2" },
		];

		const { user } = renderReact(
			<TabbedContainer
				tabs={closableTabs}
				activeId="tab1"
				onChange={vi.fn()}
				onClose={onClose}
				renderContent={renderContent}
			/>
		);

		const closeBtn = screen.getByTestId("tab-close-tab1");
		expect(closeBtn).toBeInTheDocument();

		await user.click(closeBtn);
		expect(onClose).toHaveBeenCalledWith("tab1");

		expect(screen.queryByTestId("tab-close-tab2")).not.toBeInTheDocument();
	});

	it("supports drag and drop reordering", async () => {
		const onReorder = vi.fn();
		const reorderTabs: ReactTabDefinition[] = [
			{ id: "a", label: "A", reorderable: true },
			{ id: "b", label: "B", reorderable: true },
		];

		renderReact(
			<TabbedContainer
				tabs={reorderTabs}
				activeId="a"
				onChange={vi.fn()}
				onReorder={onReorder}
				renderContent={renderContent}
			/>
		);

		const tabA = screen.getByTestId("tab-a");
		expect(tabA).toHaveAttribute("draggable", "true");
	});
});
