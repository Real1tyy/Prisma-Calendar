import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActionBar, BackButton, PageHeader } from "../../src/views/page-header";
import { renderReact } from "../helpers/render-react";

const PREFIX = "test-";

describe("BackButton", () => {
	it("renders and fires onClick", async () => {
		const onClick = vi.fn();
		const { user } = renderReact(<BackButton onClick={onClick} testIdPrefix={PREFIX} />);

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
		renderReact(<ActionBar actions={actions} testIdPrefix={PREFIX} />);

		expect(screen.getByTestId(`${PREFIX}page-header-action-edit`)).toHaveAttribute("aria-label", "Edit");
		expect(screen.getByTestId(`${PREFIX}page-header-action-delete`)).toBeDisabled();
	});

	it("fires onClick for enabled action", async () => {
		const { user } = renderReact(<ActionBar actions={actions} testIdPrefix={PREFIX} />);

		await user.click(screen.getByTestId(`${PREFIX}page-header-action-edit`));
		expect(actions[0].onClick).toHaveBeenCalledOnce();
	});

	it("renders with toolbar role", () => {
		renderReact(<ActionBar actions={actions} />);

		expect(screen.getByRole("toolbar")).toBeInTheDocument();
	});
});

describe("PageHeader", () => {
	it("renders title", () => {
		renderReact(<PageHeader title="Dashboard" testIdPrefix={PREFIX} />);

		expect(screen.getByTestId(`${PREFIX}page-header-title`)).toHaveTextContent("Dashboard");
	});

	it("renders subtitle when provided", () => {
		renderReact(<PageHeader title="Dashboard" subtitle="Overview" />);

		expect(screen.getByText("Overview")).toBeInTheDocument();
	});

	it("renders back button when onBack provided", async () => {
		const onBack = vi.fn();
		const { user } = renderReact(<PageHeader title="Detail" onBack={onBack} testIdPrefix={PREFIX} />);

		await user.click(screen.getByTestId(`${PREFIX}page-header-back`));
		expect(onBack).toHaveBeenCalledOnce();
	});

	it("does not render back button without onBack", () => {
		renderReact(<PageHeader title="Dashboard" testIdPrefix={PREFIX} />);

		expect(screen.queryByTestId(`${PREFIX}page-header-back`)).not.toBeInTheDocument();
	});

	it("renders breadcrumbs", async () => {
		const onClick = vi.fn();
		const { user } = renderReact(
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
		renderReact(<PageHeader title="Dashboard" actions={actions} testIdPrefix={PREFIX} />);

		expect(screen.getByTestId(`${PREFIX}page-header-action-refresh`)).toBeInTheDocument();
	});

	it("renders right slot", () => {
		renderReact(<PageHeader title="Dashboard" right={<span>Custom</span>} />);

		expect(screen.getByText("Custom")).toBeInTheDocument();
	});

	it("has banner role", () => {
		renderReact(<PageHeader title="Dashboard" />);

		expect(screen.getByRole("banner")).toBeInTheDocument();
	});
});
