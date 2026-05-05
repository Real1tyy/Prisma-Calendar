import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CategorySelectForm } from "../../../src/react/modals/category/category-select-modal";

const DEFAULT_CATEGORIES = [
	{ name: "Work", color: "#ff0000" },
	{ name: "Personal", color: "#00ff00" },
	{ name: "Fitness", color: "#0000ff" },
];

function setup(categories = DEFAULT_CATEGORIES) {
	const onSelect = vi.fn();
	const onCancel = vi.fn();
	const user = userEvent.setup();
	const result = render(<CategorySelectForm allCategories={categories} onSelect={onSelect} onCancel={onCancel} />);
	return { onSelect, onCancel, user, ...result };
}

describe("CategorySelectForm", () => {
	it("renders search input and all categories immediately", () => {
		setup();
		expect(screen.getByTestId("prisma-category-search")).toBeDefined();
		expect(screen.getByTestId("prisma-category-item-Work")).toBeDefined();
		expect(screen.getByTestId("prisma-category-item-Personal")).toBeDefined();
		expect(screen.getByTestId("prisma-category-item-Fitness")).toBeDefined();
	});

	it("highlight button is disabled until selection", () => {
		setup();
		const btn = screen.getByTestId("prisma-form-submit") as HTMLButtonElement;
		expect(btn.disabled).toBe(true);
	});

	it("clicking a category enables highlight button", async () => {
		const { user, onSelect } = setup();
		await user.click(screen.getByTestId("prisma-category-item-Work"));

		const btn = screen.getByTestId("prisma-form-submit") as HTMLButtonElement;
		expect(btn.disabled).toBe(false);

		await user.click(btn);
		expect(onSelect).toHaveBeenCalledWith("Work");
	});

	it("enter submits first filtered category when none selected", async () => {
		const { user, onSelect } = setup();
		await user.type(screen.getByTestId("prisma-category-search"), "Fit{Enter}");
		expect(onSelect).toHaveBeenCalledWith("Fitness");
	});

	it("enter submits selected category over first filtered", async () => {
		const { user, onSelect } = setup();
		await user.click(screen.getByTestId("prisma-category-item-Personal"));
		await user.type(screen.getByTestId("prisma-category-search"), "{Enter}");
		expect(onSelect).toHaveBeenCalledWith("Personal");
	});

	it("cancel calls onCancel", async () => {
		const { user, onCancel } = setup();
		await user.click(screen.getByTestId("prisma-form-cancel"));
		expect(onCancel).toHaveBeenCalled();
	});

	it("search filters categories", async () => {
		const { user } = setup();
		await user.type(screen.getByTestId("prisma-category-search"), "Fit");

		expect(screen.queryByTestId("prisma-category-item-Work")).toBeNull();
		expect(screen.getByTestId("prisma-category-item-Fitness")).toBeDefined();
	});
});
