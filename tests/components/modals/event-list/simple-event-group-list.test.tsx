import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
	SimpleEventGroupList,
	type SimpleEventGroupItem,
} from "../../../../src/react/modals/event-list/simple-event-group-list";

function makeItems(specs: Array<Pick<SimpleEventGroupItem, "title" | "count">>): SimpleEventGroupItem[] {
	return specs.map((spec, i) => ({
		key: `key-${i}`,
		title: spec.title,
		count: spec.count,
		onClick: vi.fn(),
	}));
}

function renderList(overrides: Partial<React.ComponentProps<typeof SimpleEventGroupList>> = {}) {
	const items =
		overrides.items ??
		makeItems([
			{ title: "Alice", count: 2 },
			{ title: "Bob", count: 1 },
		]);
	return render(
		<SimpleEventGroupList
			items={items}
			totalCount={overrides.totalCount ?? items.length}
			countLabel={overrides.countLabel ?? "groups"}
			emptyMessage={overrides.emptyMessage ?? "Nothing here"}
		/>
	);
}

describe("SimpleEventGroupList", () => {
	it("renders one row per item with title and pluralized count", () => {
		renderList({
			items: makeItems([
				{ title: "Alice", count: 1 },
				{ title: "Bob", count: 5 },
			]),
		});
		expect(screen.getByText("Alice")).toBeTruthy();
		expect(screen.getByText("Bob")).toBeTruthy();
		expect(screen.getByText("1 event")).toBeTruthy();
		expect(screen.getByText("5 events")).toBeTruthy();
	});

	it("shows full count when items.length === totalCount", () => {
		renderList({
			items: makeItems([
				{ title: "Alice", count: 1 },
				{ title: "Bob", count: 1 },
			]),
			totalCount: 2,
			countLabel: "groups",
		});
		expect(screen.getByText("2 groups")).toBeTruthy();
	});

	it("shows 'X of Y' count when items are filtered down", () => {
		renderList({
			items: makeItems([{ title: "Alice", count: 1 }]),
			totalCount: 7,
			countLabel: "groups",
		});
		expect(screen.getByText("1 of 7 groups")).toBeTruthy();
	});

	it("renders empty message when items list is empty", () => {
		renderList({ items: [], totalCount: 0, emptyMessage: "Nothing matches" });
		expect(screen.getByText("Nothing matches")).toBeTruthy();
		expect(screen.queryByText(/event/)).toBeNull();
	});

	it("invokes the row's onClick handler when the row is clicked", async () => {
		const items = makeItems([
			{ title: "Alice", count: 2 },
			{ title: "Bob", count: 1 },
		]);
		const user = userEvent.setup();
		render(<SimpleEventGroupList items={items} totalCount={items.length} countLabel="groups" emptyMessage="empty" />);

		await user.click(screen.getByTestId("prisma-event-list-item-Alice"));
		expect(items[0].onClick).toHaveBeenCalledTimes(1);
		expect(items[1].onClick).not.toHaveBeenCalled();
	});

	it("exposes the title via data-event-title for E2E assertions", () => {
		renderList({ items: makeItems([{ title: "Alice", count: 2 }]) });
		const row = screen.getByTestId("prisma-event-list-item-Alice");
		expect(row.getAttribute("data-event-title")).toBe("Alice");
	});
});
