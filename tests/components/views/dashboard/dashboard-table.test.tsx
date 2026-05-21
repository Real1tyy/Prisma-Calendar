import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DashboardTable, ENTRIES_PER_PAGE } from "../../../../src/react/views/dashboard/dashboard-table";
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

	it("wraps the table in a scroll region while keeping filter and pagination outside it", () => {
		const items = createItems(ENTRIES_PER_PAGE + 5);

		const { container } = render(<DashboardTable items={items} columns={COLUMNS} emptyMessage="No items" />);

		const scroll = container.querySelector(".prisma-dashboard-table-scroll");
		expect(scroll).not.toBeNull();
		expect(scroll!.querySelector("table.prisma-dashboard-table")).not.toBeNull();

		// Filter input and pagination must sit OUTSIDE the scroll region so they
		// stay visible while the rows scroll — that is the whole point of the fix.
		expect(scroll!.querySelector(".prisma-dashboard-search-input")).toBeNull();
		expect(scroll!.querySelector(".prisma-dashboard-pagination")).toBeNull();
		expect(container.querySelector(".prisma-dashboard-table-wrapper > .prisma-dashboard-pagination")).not.toBeNull();
	});

	it("adds colored row class when item has color", () => {
		const items: DashboardItem[] = [{ key: "a", title: "Red Item", count: 5, color: "#ff0000", extraProps: {} }];

		render(<DashboardTable items={items} columns={COLUMNS} emptyMessage="No items" />);

		const row = screen.getByTestId("prisma-dashboard-table-row-Red Item");
		expect(row.classList.contains("prisma-dashboard-table-row-colored")).toBe(true);
	});
});
