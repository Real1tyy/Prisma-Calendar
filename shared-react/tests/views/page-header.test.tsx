import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { ActionBar, BackButton, PageHeader } from "../../src/views/page-header";
import { renderReact, type RenderReactResult } from "../helpers/render-react";

const PREFIX = "test-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

describe("BackButton", () => {
	it("renders and fires onClick", async () => {
		const onClick = vi.fn();
		const { user } = renderInTheme(<BackButton onClick={onClick} />);

		const btn = screen.getByTestId(`${PREFIX}page-header-back`);
		expect(btn).toBeInTheDocument();
		expect(btn).toHaveAttribute("aria-label", "Go back");

		await user.click(btn);
		expect(onClick).toHaveBeenCalledOnce();
	});
});

describe("ActionBar", () => {
	const actions = [
		{ id: "edit", icon: "pencil", label: "Edit", onClick: vi.fn() },
		{ id: "delete", icon: "trash", label: "Delete", onClick: vi.fn(), disabled: true },
	];

	it("renders all actions with aria labels", () => {
		renderInTheme(<ActionBar actions={actions} />);

		expect(screen.getByTestId(`${PREFIX}page-header-action-edit`)).toHaveAttribute("aria-label", "Edit");
		expect(screen.getByTestId(`${PREFIX}page-header-action-delete`)).toBeDisabled();
	});

	it("fires onClick for enabled action", async () => {
		const { user } = renderInTheme(<ActionBar actions={actions} />);

		await user.click(screen.getByTestId(`${PREFIX}page-header-action-edit`));
		expect(actions[0].onClick).toHaveBeenCalledOnce();
	});

	it("renders with toolbar role", () => {
		renderInTheme(<ActionBar actions={actions} />);

		expect(screen.getByRole("toolbar")).toBeInTheDocument();
	});
});

describe("PageHeader", () => {
	it("renders title", () => {
		renderInTheme(<PageHeader title="Dashboard" />);

		expect(screen.getByTestId(`${PREFIX}page-header-title`)).toHaveTextContent("Dashboard");
	});

	it("renders subtitle when provided", () => {
		renderInTheme(<PageHeader title="Dashboard" subtitle="Overview" />);

		expect(screen.getByText("Overview")).toBeInTheDocument();
	});

	it("renders back button when onBack provided", async () => {
		const onBack = vi.fn();
		const { user } = renderInTheme(<PageHeader title="Detail" onBack={onBack} />);

		await user.click(screen.getByTestId(`${PREFIX}page-header-back`));
		expect(onBack).toHaveBeenCalledOnce();
	});

	it("does not render back button without onBack", () => {
		renderInTheme(<PageHeader title="Dashboard" />);

		expect(screen.queryByTestId(`${PREFIX}page-header-back`)).not.toBeInTheDocument();
	});

	it("renders breadcrumbs", async () => {
		const onClick = vi.fn();
		const { user } = renderInTheme(
			<PageHeader title="Detail" breadcrumbs={[{ label: "Home", onClick }, { label: "Events" }]} />
		);

		expect(screen.getByText("Home")).toBeInTheDocument();
		expect(screen.getByText("Events")).toBeInTheDocument();
		expect(screen.getByRole("navigation", { name: "Breadcrumbs" })).toBeInTheDocument();

		await user.click(screen.getByText("Home"));
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("renders actions", () => {
		const actions = [{ id: "refresh", icon: "refresh-cw", label: "Refresh", onClick: vi.fn() }];
		renderInTheme(<PageHeader title="Dashboard" actions={actions} />);

		expect(screen.getByTestId(`${PREFIX}page-header-action-refresh`)).toBeInTheDocument();
	});

	it("renders right slot", () => {
		renderInTheme(<PageHeader title="Dashboard" right={<span>Custom</span>} />);

		expect(screen.getByText("Custom")).toBeInTheDocument();
	});

	it("has banner role", () => {
		renderInTheme(<PageHeader title="Dashboard" />);

		expect(screen.getByRole("banner")).toBeInTheDocument();
	});
});
