import { screen, waitFor } from "@testing-library/react";
import type { App } from "obsidian";
import { describe, expect, it, vi } from "vitest";

import { ItemManagerContent } from "../../../src/menus/customizable/item-manager-modal";
import { CustomizableMenuStore } from "../../../src/menus/customizable/store";
import type { CustomizableContextMenuItem } from "../../../src/menus/customizable/types";
import { renderWithTheme } from "../../helpers/render-react";

const PREFIX = "test-";
const FAKE_APP = {} as unknown as App;

function items(): CustomizableContextMenuItem[] {
	return [
		{ id: "edit", label: "Edit", icon: "pencil", section: "edit", onAction: vi.fn() },
		{ id: "duplicate", label: "Duplicate", icon: "copy", section: "edit", onAction: vi.fn() },
		{ id: "delete", label: "Delete", icon: "trash", section: "danger", onAction: vi.fn() },
	];
}

describe("ItemManagerContent", () => {
	it("stamps the modal testid and renders one row per item", () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		expect(screen.getByTestId(`${PREFIX}item-manager-modal`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}item-manager-row-edit`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}item-manager-row-duplicate`)).toBeInTheDocument();
		expect(screen.getByTestId(`${PREFIX}item-manager-row-delete`)).toBeInTheDocument();
	});

	it("toggle button hides a visible item", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		await user.click(screen.getByTestId(`${PREFIX}item-manager-toggle-edit`));

		expect(store.visibleCount).toBe(2);
		expect(store.getState().visibleItemIds).not.toContain("edit");
	});

	it("toggle button restores a hidden item", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		store.hideItem("edit");
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		await user.click(screen.getByTestId(`${PREFIX}item-manager-toggle-edit`));

		expect(store.visibleCount).toBe(3);
	});

	it("disables hide button when only one item is visible", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		store.hideItem("edit");
		store.hideItem("duplicate");

		renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		const lastVisibleToggle = screen.getByTestId(`${PREFIX}item-manager-toggle-delete`);
		expect(lastVisibleToggle).toBeDisabled();
	});

	it("expands the edit button to show the edit form", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		await user.click(screen.getByTestId(`${PREFIX}item-manager-edit-edit`));
		expect(screen.getByTestId(`${PREFIX}item-manager-edit-form-edit`)).toBeInTheDocument();

		await user.click(screen.getByTestId(`${PREFIX}item-manager-edit-edit`));
		expect(screen.queryByTestId(`${PREFIX}item-manager-edit-form-edit`)).not.toBeInTheDocument();
	});

	it("renames an item via the inline edit form and writes to the store", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		await user.click(screen.getByTestId(`${PREFIX}item-manager-edit-edit`));
		const input = screen.getByTestId(`${PREFIX}item-manager-name-input-edit`);
		await user.clear(input);
		await user.type(input, "Custom Edit");
		// TextInput debounce-commits — flush via blur.
		input.blur();

		await waitFor(() => {
			expect(store.getState().renames).toEqual({ edit: "Custom Edit" });
		});
	});

	it("renders a section header per resolved section", () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		// Title-cased section names live inside the section-header container.
		const headers = document.querySelectorAll(`.${PREFIX}item-manager-section-header`);
		const labels = Array.from(headers, (h) => h.textContent);
		expect(labels).toEqual(["Edit", "Danger"]);
	});

	it("settings button toggle updates the store", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		const toggle = screen.getByLabelText("Show settings button");
		await user.click(toggle);

		expect(store.getSnapshot().showSettingsButton).toBe(false);
		expect(store.getState().showSettingsButton).toBe(false);
	});

	it("filters rows when searching", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		await user.type(screen.getByPlaceholderText("Search items..."), "delete");

		// FilterInput debounces; wait for non-matches to disappear.
		await waitFor(() => {
			expect(screen.queryByTestId(`${PREFIX}item-manager-row-edit`)).not.toBeInTheDocument();
		});
		expect(screen.getByTestId(`${PREFIX}item-manager-row-delete`)).toBeInTheDocument();
	});

	it("shows no-match hint when search has no results", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		await user.type(screen.getByPlaceholderText("Search items..."), "zzz-no-match");

		await waitFor(() => {
			expect(screen.getByText("No matching items")).toBeInTheDocument();
		});
	});

	it("up arrow moves an item up within its section", async () => {
		const store = new CustomizableMenuStore({ allItems: items() });
		const { user } = renderWithTheme(<ItemManagerContent app={FAKE_APP} store={store} />, PREFIX);

		const duplicateRow = screen.getByTestId(`${PREFIX}item-manager-row-duplicate`);
		const upButton = duplicateRow.querySelector(`[aria-label="Move up"]`);
		expect(upButton).toBeInTheDocument();
		await user.click(upButton!);

		expect(store.getState().visibleItemIds).toEqual(["duplicate", "edit", "delete"]);
	});
});
