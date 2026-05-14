import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DashboardTable } from "../../../../src/react/views/dashboard/dashboard-table";
import type { ColumnDef, DashboardItem } from "../../../../src/react/views/dashboard/dashboard-types";

const COLUMNS: ColumnDef[] = [
	{ key: "title", label: "Name" },
	{ key: "count", label: "Events", align: "center" },
];

function createItems(count: number): DashboardItem[] {
	return Array.from({ length: count }, (_, i) => ({
		key: `item-${i}`,
		title: `Item ${i + 1}`,
		count: count - i,
		extraProps: {},
	}));
}

describe("DashboardTable", () => {
	it("renders all items when under page limit", () => {
		const items = createItems(5);

		render(<DashboardTable items={items} columns={COLUMNS} emptyMessage="No items" />);

		for (const item of items) {
			expect(screen.getByTestId(`prisma-dashboard-table-row-${item.title}`)).toBeTruthy();
		}
	});

	it("renders empty message when no items", () => {
		const { container } = render(<DashboardTable items={[]} columns={COLUMNS} emptyMessage="No items found." />);

		expect(container.textContent).toContain("No items found.");
	});

	it("filters items by search query", async () => {
		const items = createItems(5);
		const user = userEvent.setup();

		const { container } = render(<DashboardTable items={items} columns={COLUMNS} emptyMessage="No items" />);

		const input = container.querySelector<HTMLInputElement>(".prisma-dashboard-search-input")!;
		await user.type(input, "Item 3");

		expect(screen.getByTestId("prisma-dashboard-table-row-Item 3")).toBeTruthy();
		expect(screen.queryByTestId("prisma-dashboard-table-row-Item 1")).toBeFalsy();
	});

	it("calls onItemClick when row is clicked", async () => {
		const items = createItems(3);
		const onClick = vi.fn();
		const user = userEvent.setup();

		render(<DashboardTable items={items} columns={COLUMNS} onItemClick={onClick} emptyMessage="No items" />);

		await user.click(screen.getByTestId("prisma-dashboard-table-row-Item 2"));
		expect(onClick).toHaveBeenCalledWith(items[1]);
	});

	it("sorts by column when header is clicked", async () => {
		const items = createItems(3);
		const user = userEvent.setup();

		const { container } = render(<DashboardTable items={items} columns={COLUMNS} emptyMessage="No items" />);

		const nameHeader = container.querySelector("th")!;
		await user.click(nameHeader);

		const rows = container.querySelectorAll("tbody tr");
		expect(rows[0].getAttribute("data-item-title")).toBe("Item 3");
	});

	it("adds colored row class when item has color", () => {
		const items: DashboardItem[] = [{ key: "a", title: "Red Item", count: 5, color: "#ff0000", extraProps: {} }];

		render(<DashboardTable items={items} columns={COLUMNS} emptyMessage="No items" />);

		const row = screen.getByTestId("prisma-dashboard-table-row-Red Item");
		expect(row.classList.contains("prisma-dashboard-table-row-colored")).toBe(true);
	});
});
