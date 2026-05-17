import { screen } from "@testing-library/react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { ManagerRow } from "../../../src/widgets/manager-list/manager-row";
import { renderReact, type RenderReactResult } from "../../helpers/render-react";

const ITEM = { id: "refresh", label: "Refresh", icon: "refresh-cw" };
const PREFIX = "test-";

function renderInTheme(ui: ReactElement): RenderReactResult {
	return renderReact(ui, undefined, undefined, { cssPrefix: PREFIX, testIdPrefix: PREFIX });
}

describe("ManagerRow", () => {
	it("renders item label and icon", () => {
		renderInTheme(<ManagerRow item={ITEM} rowPrefix="action-manager" />);

		expect(screen.getByText("Refresh")).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-row-refresh`)).toBeInTheDocument();
	});

	it("shows original label when hasRename is true", () => {
		renderInTheme(<ManagerRow item={ITEM} rowPrefix="action-manager" displayLabel="Custom Label" hasRename />);

		expect(screen.getByText("Custom Label")).toBeInTheDocument();
		expect(screen.getByText("Refresh")).toBeInTheDocument();
		expect(screen.getByTitle("Original name")).toBeInTheDocument();
	});

	it("renders edit button when onEdit provided", async () => {
		const onEdit = vi.fn();
		const { user } = renderInTheme(<ManagerRow item={ITEM} rowPrefix="action-manager" onEdit={onEdit} />);

		const editBtn = screen.getByTestId(`${PREFIX}action-manager-edit-refresh`);
		await user.click(editBtn);
		expect(onEdit).toHaveBeenCalledOnce();
	});

	it("renders visibility toggle", async () => {
		const onToggle = vi.fn();
		const { user } = renderInTheme(
			<ManagerRow item={ITEM} rowPrefix="action-manager" onToggleVisibility={onToggle} isVisible visibleCount={3} />
		);

		const toggleBtn = screen.getByTestId(`${PREFIX}action-manager-toggle-refresh`);
		expect(toggleBtn).toHaveAttribute("title", "Hide");

		await user.click(toggleBtn);
		expect(onToggle).toHaveBeenCalledOnce();
	});

	it("disables hide when only one visible", () => {
		renderInTheme(
			<ManagerRow item={ITEM} rowPrefix="action-manager" onToggleVisibility={vi.fn()} isVisible visibleCount={1} />
		);

		const toggleBtn = screen.getByTestId(`${PREFIX}action-manager-toggle-refresh`);
		expect(toggleBtn).toBeDisabled();
	});

	it("shows 'Show' title when not visible", () => {
		renderInTheme(<ManagerRow item={ITEM} rowPrefix="action-manager" onToggleVisibility={vi.fn()} isVisible={false} />);

		const toggleBtn = screen.getByTestId(`${PREFIX}action-manager-toggle-refresh`);
		expect(toggleBtn).toHaveAttribute("title", "Show");
	});

	it("applies hidden class when not visible", () => {
		renderInTheme(<ManagerRow item={ITEM} rowPrefix="mgr" isVisible={false} />);

		expect(screen.getByTestId(`${PREFIX}mgr-row-refresh`)).toHaveClass(`${PREFIX}mgr-row-hidden`);
	});

	it("renders custom actions", async () => {
		const onClick = vi.fn();
		const { user } = renderInTheme(
			<ManagerRow item={ITEM} actions={[{ icon: "star", onClick, label: "Star", testId: "star-btn" }]} />
		);

		const starBtn = screen.getByTestId("star-btn");
		await user.click(starBtn);
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("renders children (expanded content)", () => {
		renderInTheme(
			<ManagerRow item={ITEM}>
				<div data-testid="child">Expanded content</div>
			</ManagerRow>
		);

		expect(screen.getByTestId("child")).toBeInTheDocument();
	});

	it("applies color to icon when provided", () => {
		const { container } = renderInTheme(<ManagerRow item={ITEM} displayColor="#ff0000" rowPrefix="mgr" />);

		const iconSpan = container.querySelector(`.${PREFIX}mgr-icon`);
		expect(iconSpan).toHaveStyle({ color: "#ff0000" });
	});
});
