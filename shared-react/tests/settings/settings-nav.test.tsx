import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SettingsNav } from "../../src/settings/settings-nav";
import { renderReact } from "../helpers/render-react";

const TABS = [
	{ id: "general", label: "General" },
	{ id: "advanced", label: "Advanced" },
	{ id: "about", label: "About" },
];

const PREFIX = "prisma-";

describe("SettingsNav", () => {
	it("renders all visible tabs", () => {
		renderReact(<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} cssPrefix={PREFIX} />);

		expect(screen.getByTestId("prisma-settings-nav-general")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-settings-nav-advanced")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-settings-nav-about")).toBeInTheDocument();
	});

	it("marks active tab with aria-selected", () => {
		renderReact(<SettingsNav tabs={TABS} activeId="advanced" onChange={vi.fn()} cssPrefix={PREFIX} />);

		expect(screen.getByTestId("prisma-settings-nav-advanced")).toHaveAttribute("aria-selected", "true");
		expect(screen.getByTestId("prisma-settings-nav-general")).toHaveAttribute("aria-selected", "false");
	});

	it("fires onChange when tab clicked", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<SettingsNav tabs={TABS} activeId="general" onChange={onChange} cssPrefix={PREFIX} />);

		await user.click(screen.getByTestId("prisma-settings-nav-advanced"));
		expect(onChange).toHaveBeenCalledWith("advanced");
	});

	it("clears search on tab click when onSearchChange provided", async () => {
		const onSearchChange = vi.fn();
		const onChange = vi.fn();
		const { user } = renderReact(
			<SettingsNav
				tabs={TABS}
				activeId="general"
				onChange={onChange}
				onSearchChange={onSearchChange}
				searchValue="test"
				cssPrefix={PREFIX}
			/>
		);

		await user.click(screen.getByTestId("prisma-settings-nav-advanced"));
		expect(onSearchChange).toHaveBeenCalledWith("");
	});

	it("renders search input when onSearchChange provided", () => {
		renderReact(
			<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} onSearchChange={vi.fn()} cssPrefix={PREFIX} />
		);

		expect(screen.getByTestId("prisma-settings-search")).toBeInTheDocument();
	});

	it("does not render search input without onSearchChange", () => {
		renderReact(<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} cssPrefix={PREFIX} />);

		expect(screen.queryByTestId("prisma-settings-search")).not.toBeInTheDocument();
	});

	it("filters out tabs with visible: false", () => {
		const tabsWithHidden = [...TABS, { id: "hidden", label: "Hidden", visible: false }];
		renderReact(<SettingsNav tabs={tabsWithHidden} activeId="general" onChange={vi.fn()} cssPrefix={PREFIX} />);

		expect(screen.queryByTestId("prisma-settings-nav-hidden")).not.toBeInTheDocument();
	});

	it("renders footer links when provided", () => {
		renderReact(
			<SettingsNav
				tabs={TABS}
				activeId="general"
				onChange={vi.fn()}
				cssPrefix={PREFIX}
				footerLinks={[{ text: "Support", href: "https://example.com" }]}
			/>
		);

		expect(screen.getByText("Support")).toBeInTheDocument();
	});

	it("has tablist role", () => {
		renderReact(<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} cssPrefix={PREFIX} />);

		expect(screen.getByRole("tablist")).toBeInTheDocument();
	});

	it("renders children", () => {
		renderReact(
			<SettingsNav tabs={TABS} activeId="general" onChange={vi.fn()} cssPrefix={PREFIX}>
				<div data-testid="child-content">Content area</div>
			</SettingsNav>
		);

		expect(screen.getByTestId("child-content")).toBeInTheDocument();
	});

	it("supports keyboard navigation", async () => {
		const onChange = vi.fn();
		const { user } = renderReact(<SettingsNav tabs={TABS} activeId="general" onChange={onChange} cssPrefix={PREFIX} />);

		const firstTab = screen.getByTestId("prisma-settings-nav-general");
		firstTab.focus();

		await user.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(screen.getByTestId("prisma-settings-nav-advanced"));
	});
});
