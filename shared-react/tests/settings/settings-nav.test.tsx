import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { SettingsNav } from "../../src/settings/settings-nav";
import { renderReact, type RenderReactResult } from "../helpers/render-react";

const TABS = [
	{ id: "general", label: "General" },
	{ id: "advanced", label: "Advanced" },
	{ id: "about", label: "About" },
];

const PREFIX = "prisma-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

describe("SettingsNav", () => {
	it("renders all visible tabs", () => {
		renderInTheme(<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} />);

		expect(screen.getByTestId("prisma-settings-nav-general")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-settings-nav-advanced")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-settings-nav-about")).toBeInTheDocument();
	});

	it("marks active tab with aria-selected", () => {
		renderInTheme(<SettingsNav tabs={TABS} activeId="advanced" onChange={vi.fn()} />);

		expect(screen.getByTestId("prisma-settings-nav-advanced")).toHaveAttribute("aria-selected", "true");
		expect(screen.getByTestId("prisma-settings-nav-general")).toHaveAttribute("aria-selected", "false");
	});

	it("fires onChange when tab clicked", async () => {
		const onChange = vi.fn();
		const { user } = renderInTheme(<SettingsNav tabs={TABS} activeId="general" onChange={onChange} />);

		await user.click(screen.getByTestId("prisma-settings-nav-advanced"));
		expect(onChange).toHaveBeenCalledWith("advanced");
	});

	it("clears search on tab click when onSearchChange provided", async () => {
		const onSearchChange = vi.fn();
		const onChange = vi.fn();
		const { user } = renderInTheme(
			<SettingsNav
				tabs={TABS}
				activeId="general"
				onChange={onChange}
				onSearchChange={onSearchChange}
				searchValue="test"
			/>
		);

		await user.click(screen.getByTestId("prisma-settings-nav-advanced"));
		expect(onSearchChange).toHaveBeenCalledWith("");
	});

	it("renders search input when onSearchChange provided", () => {
		renderInTheme(<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} onSearchChange={vi.fn()} />);

		expect(screen.getByTestId("prisma-settings-search")).toBeInTheDocument();
	});

	it("does not render search input without onSearchChange", () => {
		renderInTheme(<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} />);

		expect(screen.queryByTestId("prisma-settings-search")).not.toBeInTheDocument();
	});

	it("filters out tabs with visible: false", () => {
		const tabsWithHidden = [...TABS, { id: "hidden", label: "Hidden", visible: false }];
		renderInTheme(<SettingsNav tabs={tabsWithHidden} activeId="general" onChange={vi.fn()} />);

		expect(screen.queryByTestId("prisma-settings-nav-hidden")).not.toBeInTheDocument();
	});

	it("renders footer links when provided", () => {
		renderInTheme(
			<SettingsNav
				tabs={TABS}
				activeId="general"
				onChange={vi.fn()}
				footerLinks={[{ text: "Support", href: "https://example.com" }]}
			/>
		);

		expect(screen.getByText("Support")).toBeInTheDocument();
	});

	it("has tablist role", () => {
		renderInTheme(<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} />);

		expect(screen.getByRole("tablist")).toBeInTheDocument();
	});

	it("renders children", () => {
		renderInTheme(
			<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()}>
				<div data-testid="child-content">Content area</div>
			</SettingsNav>
		);

		expect(screen.getByTestId("child-content")).toBeInTheDocument();
	});

	it("supports keyboard navigation", async () => {
		const onChange = vi.fn();
		const { user } = renderInTheme(<SettingsNav tabs={TABS} activeId="general" onChange={onChange} />);

		const firstTab = screen.getByTestId("prisma-settings-nav-general");
		firstTab.focus();

		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(screen.getByTestId("prisma-settings-nav-advanced"));
	});
});
