import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ContextMenuEntryDef } from "../../src/menus";
import { ContextMenu } from "../../src/menus";
import { renderReact } from "../helpers/render-react";

const ITEMS: ContextMenuEntryDef[] = [
	{ kind: "item", id: "edit", label: "Edit", icon: "pencil", onSelect: vi.fn() },
	{ kind: "separator" },
	{ kind: "item", id: "delete", label: "Delete", icon: "trash", onSelect: vi.fn(), disabled: true },
	{ kind: "checkbox", id: "done", label: "Done", checked: false, onChange: vi.fn() },
];

function renderMenu(
	items: ContextMenuEntryDef[] = ITEMS,
	overrides: Partial<React.ComponentProps<typeof ContextMenu>> = {}
) {
	return renderReact(
		<>
			<div data-testid="outside">Outside</div>
			<ContextMenu items={items} position={{ x: 100, y: 200 }} onDismiss={vi.fn()} {...overrides} />
		</>
	);
}

describe("ContextMenu (declarative)", () => {
	it("renders menu items with menuitem roles", () => {
		renderMenu();

		expect(screen.getByTestId("ctx-item-edit")).toHaveAttribute("role", "menuitem");
		expect(screen.getByTestId("ctx-item-delete")).toHaveAttribute("role", "menuitem");
	});

	it("fires onSelect when item clicked", async () => {
		const onSelect = vi.fn();
		const items: ContextMenuEntryDef[] = [{ kind: "item", id: "test", label: "Test", onSelect }];
		const { user } = renderMenu(items);

		await user.click(screen.getByTestId("ctx-item-test"));
		expect(onSelect).toHaveBeenCalledOnce();
	});

	it("does not fire onSelect for disabled items", async () => {
		const onSelect = vi.fn();
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "disabled", label: "Disabled", onSelect, disabled: true },
		];
		const { user } = renderMenu(items);

		await user.click(screen.getByTestId("ctx-item-disabled"));
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("marks disabled items with is-disabled class", () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "dis", label: "Disabled", onSelect: vi.fn(), disabled: true },
		];
		renderMenu(items);

		expect(screen.getByTestId("ctx-item-dis")).toHaveClass("is-disabled");
	});

	it("fires onChange for checkbox items (unchecked → checked)", async () => {
		const onChange = vi.fn();
		const items: ContextMenuEntryDef[] = [{ kind: "checkbox", id: "check", label: "Check", checked: false, onChange }];
		const { user } = renderMenu(items);

		await user.click(screen.getByTestId("ctx-item-check"));
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it("fires onChange for checkbox items (checked → unchecked)", async () => {
		const onChange = vi.fn();
		const items: ContextMenuEntryDef[] = [{ kind: "checkbox", id: "check", label: "Check", checked: true, onChange }];
		const { user } = renderMenu(items);

		await user.click(screen.getByTestId("ctx-item-check"));
		expect(onChange).toHaveBeenCalledWith(false);
	});

	it("renders separators with separator role", () => {
		renderMenu();

		expect(screen.getByRole("separator")).toBeInTheDocument();
	});

	it("fires onDismiss on Escape", async () => {
		const onDismiss = vi.fn();
		const { user } = renderMenu(ITEMS, { onDismiss });

		await user.keyboard("{Escape}");
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("fires onDismiss on click outside the menu", async () => {
		const onDismiss = vi.fn();
		const { user } = renderMenu(ITEMS, { onDismiss });

		await user.click(screen.getByTestId("outside"));
		expect(onDismiss).toHaveBeenCalledOnce();
	});

	it("uses menu role on the container", () => {
		renderMenu();

		expect(screen.getByRole("menu")).toBeInTheDocument();
	});

	it("uses custom testIdPrefix", () => {
		renderMenu(ITEMS, { testIdPrefix: "custom-" });

		expect(screen.getByTestId("custom-ctx-menu")).toBeInTheDocument();
		expect(screen.getByTestId("custom-ctx-item-edit")).toBeInTheDocument();
	});

	it("renders icon when item has one", () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "with-icon", label: "With Icon", icon: "pencil", onSelect: vi.fn() },
		];
		renderMenu(items);

		const item = screen.getByTestId("ctx-item-with-icon");
		expect(item.querySelector(".menu-item-icon")).toBeInTheDocument();
	});

	it("renders shortcut text when item has one", () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "shortcut", label: "Cut", shortcut: "Ctrl+X", onSelect: vi.fn() },
		];
		renderMenu(items);

		expect(screen.getByText("Ctrl+X")).toBeInTheDocument();
		expect(screen.getByText("Ctrl+X")).toHaveClass("menu-item-shortcut");
	});

	it("renders submenu items with aria-haspopup", () => {
		const items: ContextMenuEntryDef[] = [
			{
				kind: "submenu",
				id: "more",
				label: "More",
				items: [{ kind: "item", id: "sub1", label: "Sub Item", onSelect: vi.fn() }],
			},
		];
		renderMenu(items);

		const submenu = screen.getByTestId("ctx-submenu-more");
		expect(submenu).toHaveAttribute("aria-haspopup", "true");
		expect(submenu).toHaveAttribute("aria-expanded", "false");
	});

	it("checkbox items use menuitemcheckbox role with correct aria-checked", () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "checkbox", id: "toggle", label: "Toggle", checked: true, onChange: vi.fn() },
		];
		renderMenu(items);

		const checkbox = screen.getByRole("menuitemcheckbox");
		expect(checkbox).toHaveAttribute("aria-checked", "true");
	});

	// ─── Keyboard navigation ───

	it("ArrowDown moves focus to next item", async () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "first", label: "First", onSelect: vi.fn() },
			{ kind: "item", id: "second", label: "Second", onSelect: vi.fn() },
		];
		const { user } = renderMenu(items);

		await user.keyboard("{ArrowDown}");

		expect(screen.getByTestId("ctx-item-second")).toHaveAttribute("tabindex", "0");
	});

	it("ArrowUp moves focus to previous item", async () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "first", label: "First", onSelect: vi.fn() },
			{ kind: "item", id: "second", label: "Second", onSelect: vi.fn() },
		];
		const { user } = renderMenu(items);

		await user.keyboard("{ArrowDown}{ArrowUp}");

		expect(screen.getByTestId("ctx-item-first")).toHaveAttribute("tabindex", "0");
	});

	it("ArrowDown wraps from last item to first", async () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "first", label: "First", onSelect: vi.fn() },
			{ kind: "item", id: "second", label: "Second", onSelect: vi.fn() },
		];
		const { user } = renderMenu(items);

		await user.keyboard("{ArrowDown}{ArrowDown}");

		expect(screen.getByTestId("ctx-item-first")).toHaveAttribute("tabindex", "0");
	});

	it("ArrowUp wraps from first item to last", async () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "first", label: "First", onSelect: vi.fn() },
			{ kind: "item", id: "second", label: "Second", onSelect: vi.fn() },
		];
		const { user } = renderMenu(items);

		await user.keyboard("{ArrowUp}");

		expect(screen.getByTestId("ctx-item-second")).toHaveAttribute("tabindex", "0");
	});

	it("keyboard navigation skips separators", async () => {
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "first", label: "First", onSelect: vi.fn() },
			{ kind: "separator" },
			{ kind: "item", id: "second", label: "Second", onSelect: vi.fn() },
		];
		const { user } = renderMenu(items);

		await user.keyboard("{ArrowDown}");

		expect(screen.getByTestId("ctx-item-second")).toHaveAttribute("tabindex", "0");
	});

	it("Enter fires onSelect on focused item", async () => {
		const onSelect = vi.fn();
		const items: ContextMenuEntryDef[] = [
			{ kind: "item", id: "first", label: "First", onSelect: vi.fn() },
			{ kind: "item", id: "second", label: "Second", onSelect },
		];
		const { user } = renderMenu(items);

		await user.keyboard("{ArrowDown}{Enter}");

		expect(onSelect).toHaveBeenCalledOnce();
	});

	it("Enter does not fire on disabled focused item", async () => {
		const onSelect = vi.fn();
		const items: ContextMenuEntryDef[] = [{ kind: "item", id: "only", label: "Only", onSelect, disabled: true }];
		const { user } = renderMenu(items);

		await user.keyboard("{Enter}");

		expect(onSelect).not.toHaveBeenCalled();
	});

	it("Enter toggles focused checkbox", async () => {
		const onChange = vi.fn();
		const items: ContextMenuEntryDef[] = [{ kind: "checkbox", id: "cb", label: "Check", checked: false, onChange }];
		const { user } = renderMenu(items);

		await user.keyboard("{Enter}");

		expect(onChange).toHaveBeenCalledWith(true);
	});
});
