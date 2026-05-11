import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ManagerEditController } from "../../src/components/manager-edit-form";
import { ManagerEditForm } from "../../src/components/manager-edit-form";
import { renderReact } from "../helpers/render-react";

const ITEM = { id: "edit", label: "Edit", icon: "pencil", color: "#ff0000" };
const PREFIX = "test-";

interface BuildOpts {
	values?: Partial<ManagerEditController["values"]>;
	overrides?: Partial<ManagerEditController["overrides"]>;
	actions?: Partial<ManagerEditController["actions"]>;
}

function buildController({ values, overrides, actions }: BuildOpts = {}): ManagerEditController {
	return {
		item: ITEM,
		values: { label: "Edit", icon: "pencil", color: "#ff0000", ...values },
		overrides: { label: false, icon: false, color: false, ...overrides },
		actions: {
			rename: vi.fn(),
			changeIcon: vi.fn(),
			changeColor: vi.fn(),
			...actions,
		},
	};
}

function renderForm(controller: ManagerEditController) {
	return renderReact(<ManagerEditForm controller={controller} cssPrefix={PREFIX} formPrefix="action-manager" />);
}

describe("ManagerEditForm", () => {
	it("renders name, icon, and color fields", () => {
		renderForm(buildController());

		expect(screen.getByTestId(`${PREFIX}action-manager-edit-form-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-name-input-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-icon-btn-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-color-input-edit`)).toBeInTheDocument();
	});

	it("fires rename when name changes and committed via blur", async () => {
		const rename = vi.fn();
		const { user } = renderForm(buildController({ actions: { rename } }));

		const input = screen.getByTestId(`${PREFIX}action-manager-name-input-edit`);
		await user.clear(input);
		await user.type(input, "Rename");
		await user.tab();

		expect(rename).toHaveBeenCalledWith("Rename");
	});

	it("fires rename with undefined when label matches original", async () => {
		const rename = vi.fn();
		const { user } = renderForm(buildController({ values: { label: "Custom" }, actions: { rename } }));

		const input = screen.getByTestId(`${PREFIX}action-manager-name-input-edit`);
		await user.clear(input);
		await user.type(input, "Edit");
		await user.tab();

		expect(rename).toHaveBeenLastCalledWith(undefined);
	});

	it("shows reset buttons when overrides exist", () => {
		renderForm(buildController({ overrides: { label: true, icon: true, color: true } }));

		expect(screen.getByTestId(`${PREFIX}action-manager-name-reset-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-icon-reset-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}action-manager-color-reset-edit`)).toBeInTheDocument();
	});

	it("does not show reset buttons without overrides", () => {
		renderForm(buildController());

		expect(screen.queryByTestId(`${PREFIX}action-manager-name-reset-edit`)).not.toBeInTheDocument();
		expect(screen.queryByTestId(`${PREFIX}action-manager-icon-reset-edit`)).not.toBeInTheDocument();
		expect(screen.queryByTestId(`${PREFIX}action-manager-color-reset-edit`)).not.toBeInTheDocument();
	});

	it("fires rename with undefined when reset clicked", async () => {
		const rename = vi.fn();
		const { user } = renderForm(buildController({ overrides: { label: true }, actions: { rename } }));

		await user.click(screen.getByTestId(`${PREFIX}action-manager-name-reset-edit`));
		expect(rename).toHaveBeenCalledWith(undefined);
	});

	it("fires changeIcon with undefined when icon reset clicked", async () => {
		const changeIcon = vi.fn();
		const { user } = renderForm(buildController({ overrides: { icon: true }, actions: { changeIcon } }));

		await user.click(screen.getByTestId(`${PREFIX}action-manager-icon-reset-edit`));
		expect(changeIcon).toHaveBeenCalledWith(undefined);
	});

	it("fires changeColor with undefined when color reset clicked", async () => {
		const changeColor = vi.fn();
		const { user } = renderForm(buildController({ overrides: { color: true }, actions: { changeColor } }));

		await user.click(screen.getByTestId(`${PREFIX}action-manager-color-reset-edit`));
		expect(changeColor).toHaveBeenCalledWith(undefined);
	});

	describe("icon picker integration", () => {
		it("clears the icon override when the picker returns null (user clicked 'No icon')", async () => {
			const changeIcon = vi.fn();
			// pickIcon emulates the picker — synchronously invokes the callback with null,
			// which is what `showReactIconPicker` does when the user clicks the "No icon" tile.
			const pickIcon = vi.fn((cb: (icon: string | null) => void) => cb(null));
			const { user } = renderForm(buildController({ actions: { changeIcon, pickIcon } }));

			await user.click(screen.getByTestId(`${PREFIX}action-manager-icon-btn-edit`));
			expect(changeIcon).toHaveBeenCalledWith(undefined);
		});

		it("forwards a non-null pick from the picker as the new icon override", async () => {
			const changeIcon = vi.fn();
			const pickIcon = vi.fn((cb: (icon: string | null) => void) => cb("star"));
			const { user } = renderForm(buildController({ actions: { changeIcon, pickIcon } }));

			await user.click(screen.getByTestId(`${PREFIX}action-manager-icon-btn-edit`));
			expect(changeIcon).toHaveBeenCalledWith("star");
		});

		it("clears the override when the user re-picks the item's default icon", async () => {
			const changeIcon = vi.fn();
			// Item's default icon is "pencil"; picking the same icon shouldn't store a redundant override.
			const pickIcon = vi.fn((cb: (icon: string | null) => void) => cb("pencil"));
			const { user } = renderForm(buildController({ actions: { changeIcon, pickIcon } }));

			await user.click(screen.getByTestId(`${PREFIX}action-manager-icon-btn-edit`));
			expect(changeIcon).toHaveBeenCalledWith(undefined);
		});
	});
});
