import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ManagerEditForm } from "../../src/components/manager-edit-form";
import { renderReact } from "../helpers/render-react";

const ITEM = { id: "edit", label: "Edit", icon: "pencil", color: "#ff0000" };
const PREFIX = "test-";

describe("ManagerEditForm", () => {
	const defaultProps = {
		item: ITEM,
		currentLabel: "Edit",
		currentIcon: "pencil",
		currentColor: "#ff0000",
		onRename: vi.fn(),
		onIconChange: vi.fn(),
		onColorChange: vi.fn(),
		cssPrefix: PREFIX,
		formPrefix: "action-manager",
	};

	it("renders name, icon, and color fields", () => {
		renderReact(<ManagerEditForm {...defaultProps} />);

		expect(screen.getByTestId(`${PREFIX}action-manager-edit-form-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-name-input-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-icon-btn-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-color-input-edit`)).toBeInTheDocument();
	});

	it("fires onRename when name changes and committed via blur", async () => {
		const onRename = vi.fn();
		const { user } = renderReact(<ManagerEditForm {...defaultProps} onRename={onRename} />);

		const input = screen.getByTestId(`${PREFIX}action-manager-name-input-edit`);
		await user.clear(input);
		await user.type(input, "Rename");
		await user.tab();

		expect(onRename).toHaveBeenCalledWith("edit", "Rename");
	});

	it("fires onRename with undefined when label matches original", async () => {
		const onRename = vi.fn();
		const { user } = renderReact(<ManagerEditForm {...defaultProps} currentLabel="Custom" onRename={onRename} />);

		const input = screen.getByTestId(`${PREFIX}action-manager-name-input-edit`);
		await user.clear(input);
		await user.type(input, "Edit");
		await user.tab();

		expect(onRename).toHaveBeenLastCalledWith("edit", undefined);
	});

	it("shows reset buttons when overrides exist", () => {
		renderReact(<ManagerEditForm {...defaultProps} hasRenameOverride hasIconOverride hasColorOverride />);

		expect(screen.getByTestId(`${PREFIX}action-manager-name-reset-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-icon-reset-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-color-reset-edit`)).toBeInTheDocument();
	});

	it("does not show reset buttons without overrides", () => {
		renderReact(<ManagerEditForm {...defaultProps} />);

		expect(screen.queryByTestId(`${PREFIX}action-manager-name-reset-edit`)).not.toBeInTheDocument();
		expect(screen.queryByTestId(`${PREFIX}action-manager-icon-reset-edit`)).not.toBeInTheDocument();
		expect(screen.queryByTestId(`${PREFIX}action-manager-color-reset-edit`)).not.toBeInTheDocument();
	});

	it("fires onRename with undefined when reset clicked", async () => {
		const onRename = vi.fn();
		const { user } = renderReact(<ManagerEditForm {...defaultProps} onRename={onRename} hasRenameOverride />);

		await user.click(screen.getByTestId(`${PREFIX}action-manager-name-reset-edit`));
		expect(onRename).toHaveBeenCalledWith("edit", undefined);
	});

	it("fires onIconChange with undefined when icon reset clicked", async () => {
		const onIconChange = vi.fn();
		const { user } = renderReact(<ManagerEditForm {...defaultProps} onIconChange={onIconChange} hasIconOverride />);

		await user.click(screen.getByTestId(`${PREFIX}action-manager-icon-reset-edit`));
		expect(onIconChange).toHaveBeenCalledWith("edit", undefined);
	});

	it("fires onColorChange with undefined when color reset clicked", async () => {
		const onColorChange = vi.fn();
		const { user } = renderReact(<ManagerEditForm {...defaultProps} onColorChange={onColorChange} hasColorOverride />);

		await user.click(screen.getByTestId(`${PREFIX}action-manager-color-reset-edit`));
		expect(onColorChange).toHaveBeenCalledWith("edit", undefined);
	});
});
