import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@real1ty-obsidian-plugins-react", async (importOriginal) => {
	const actual = await importOriginal<Record<string, unknown>>();
	return {
		...actual,
		VirtualList: function MockVirtualList<T>({
			items,
			renderItem,
			className,
		}: {
			items: readonly T[];
			renderItem: (item: T, index: number) => ReactNode;
			className?: string;
		}) {
			return (
				<div className={className}>
					{items.map((item, i) => (
						<div key={i}>{renderItem(item, i)}</div>
					))}
				</div>
			);
		},
	};
});

import {
	AssignmentForm,
	type AssignmentItem,
	type AssignmentModalConfig,
} from "../../../src/react/modals/category/assignment-modal";

const DEFAULT_ITEMS: AssignmentItem[] = [
	{ name: "Work", color: "#ff0000" },
	{ name: "Personal", color: "#00ff00" },
	{ name: "Fitness", color: "#0000ff" },
];

const DEFAULT_CONFIG: AssignmentModalConfig = {
	title: "Assign categories",
	description: "Select categories",
	searchPlaceholder: "Search...",
	createNewLabel: (n: string) => `Create: ${n}`,
	assignLabel: "Assign",
	removeLabel: "Remove",
	defaultColor: "#808080",
};

function setup(
	overrides: {
		items?: AssignmentItem[];
		preSelected?: string[];
		config?: Partial<AssignmentModalConfig>;
	} = {}
) {
	const onSubmit = vi.fn();
	const onCancel = vi.fn();
	const user = userEvent.setup();
	const result = render(
		<AssignmentForm
			items={overrides.items ?? DEFAULT_ITEMS}
			config={{ ...DEFAULT_CONFIG, ...overrides.config }}
			preSelected={overrides.preSelected ?? []}
			onSubmit={onSubmit}
			onCancel={onCancel}
		/>
	);
	return { onSubmit, onCancel, user, ...result };
}

describe("AssignmentForm", () => {
	it("renders title, description, search, and items", () => {
		setup();
		expect(screen.getByText("Assign categories")).toBeDefined();
		expect(screen.getByTestId("prisma-assign-search")).toBeDefined();
		expect(screen.getAllByTestId("prisma-assign-item")).toHaveLength(3);
	});

	it("pre-selected items start checked", () => {
		setup({ preSelected: ["Work"] });
		const workItem = screen.getByText("Work").closest("[data-testid='prisma-assign-item']");
		expect(workItem?.className).toContain("prisma-checked");
	});

	it("clicking item toggles selection", async () => {
		const { user } = setup();
		const items = screen.getAllByTestId("prisma-assign-item");
		await user.click(items[0]);
		expect(items[0].className).toContain("prisma-checked");
	});

	it("submit returns selected items", async () => {
		const { user, onSubmit } = setup({ preSelected: ["Work"] });
		await user.click(screen.getByTestId("prisma-assign-submit"));
		expect(onSubmit).toHaveBeenCalledWith(["Work"]);
	});

	it("cancel calls onCancel", async () => {
		const { user, onCancel } = setup();
		await user.click(screen.getByTestId("prisma-form-cancel"));
		expect(onCancel).toHaveBeenCalled();
	});

	it("search filters items", async () => {
		const { user } = setup();
		await user.type(screen.getByTestId("prisma-assign-search"), "Fit");
		expect(screen.getAllByTestId("prisma-assign-item")).toHaveLength(1);
	});

	it("create new button appears for unmatched search", async () => {
		const { user } = setup();
		await user.type(screen.getByTestId("prisma-assign-search"), "NewCat");
		expect(screen.getByTestId("prisma-assign-create-new")).toBeDefined();
		expect(screen.getByText("Create: NewCat")).toBeDefined();
	});

	it("button text changes based on selection count", async () => {
		const { user } = setup();
		expect(screen.getByTestId("prisma-assign-submit").textContent).toBe("Remove");
		await user.click(screen.getAllByTestId("prisma-assign-item")[0]);
		expect(screen.getByTestId("prisma-assign-submit").textContent).toBe("Assign");
	});
});
