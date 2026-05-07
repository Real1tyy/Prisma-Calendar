import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EventListItemData } from "../../../../src/react/modals/event-list/event-list-item";
import { EventListModal, type EventListModalProps } from "../../../../src/react/modals/event-list/event-list-modal";

function makeItems(count: number): EventListItemData[] {
	return Array.from({ length: count }, (_, i) => ({
		id: `evt-${i}`,
		filePath: `tasks/Event ${i}.md`,
		title: `Event ${i}`,
		subtitle: `Subtitle ${i}`,
	}));
}

function setup(overrides: Partial<EventListModalProps> = {}) {
	const onClose = vi.fn();
	const onItemClick = vi.fn();
	const props: EventListModalProps = {
		items: makeItems(5),
		title: "Test Modal",
		actions: [],
		onClose,
		onItemClick,
		...overrides,
	};
	const user = userEvent.setup();
	const result = render(<EventListModal {...props} />);
	return { onClose, onItemClick, user, ...result };
}

describe("EventListModal", () => {
	it("renders title and items", () => {
		setup();
		expect(screen.getByText("Test Modal")).toBeTruthy();
		expect(screen.getByTestId("prisma-list-search")).toBeTruthy();
		expect(screen.getByText("5 events")).toBeTruthy();
	});

	it("shows empty hint when no items", () => {
		setup({ items: [], emptyHint: "Nothing here" });
		expect(screen.getByTestId("prisma-list-empty")).toBeTruthy();
		expect(screen.getByText("Nothing here")).toBeTruthy();
	});

	it("filters items by search query", async () => {
		const { user } = setup({ items: makeItems(10) });
		const search = screen.getByTestId("prisma-list-search") as HTMLInputElement;
		await user.type(search, "Event 3");

		expect(screen.getByText("1 of 10 events")).toBeTruthy();
	});

	it("shows 'no match' when search returns empty", async () => {
		const { user } = setup({ items: makeItems(3) });
		const search = screen.getByTestId("prisma-list-search") as HTMLInputElement;
		await user.type(search, "nonexistent");

		expect(screen.getByText("No events match your search.")).toBeTruthy();
	});

	it("displays count suffix when provided", () => {
		setup({ items: makeItems(3), countSuffix: "selected" });
		expect(screen.getByText("3 events selected")).toBeTruthy();
	});

	it("renders with subtitle", () => {
		setup({ subtitle: "Some description" });
		expect(screen.getByText("Some description")).toBeTruthy();
	});

	it("renders header content when provided", () => {
		setup({ headerContent: <div data-testid="custom-header">Custom</div> });
		expect(screen.getByTestId("custom-header")).toBeTruthy();
	});

	it("renders many items without crashing (virtual list)", () => {
		setup({ items: makeItems(500) });
		expect(screen.getByText("500 events")).toBeTruthy();
		const container = screen.getByTestId("prisma-event-list-container");
		expect(container).toBeTruthy();
	});

	it("handles singular event count", () => {
		setup({ items: makeItems(1) });
		expect(screen.getByText("1 event")).toBeTruthy();
	});

	it("strips ZettelID before matching the search query", async () => {
		const items: EventListItemData[] = [
			{ id: "a", filePath: "a.md", title: "Team Meeting-20260101000000" },
			{ id: "b", filePath: "b.md", title: "Code Review-20260102000000" },
		];
		const { user } = setup({ items });
		const search = screen.getByTestId("prisma-list-search") as HTMLInputElement;
		await user.type(search, "team meeting");
		expect(screen.getByText("1 of 2 events")).toBeTruthy();
	});

	it("Escape clears a non-empty query before closing the modal", async () => {
		const onClose = vi.fn();
		const { user } = setup({ onClose });
		const search = screen.getByTestId("prisma-list-search") as HTMLInputElement;
		await user.type(search, "no-match");
		expect(search.value).toBe("no-match");

		await user.keyboard("{Escape}");
		expect(search.value).toBe("");
		expect(onClose).not.toHaveBeenCalled();
	});

	it("custom searchFields lets the search target the subtitle as well", async () => {
		const items: EventListItemData[] = [
			{ id: "a", filePath: "a.md", title: "Alpha", subtitle: "tagged work" },
			{ id: "b", filePath: "b.md", title: "Bravo", subtitle: "tagged personal" },
		];
		render(
			<EventListModal items={items} title="m" searchFields={["title", "subtitle"]} actions={[]} onClose={vi.fn()} />
		);
		const user = userEvent.setup();
		const search = screen.getByTestId("prisma-list-search") as HTMLInputElement;
		await user.type(search, "personal");
		expect(screen.getByText("1 of 2 events")).toBeTruthy();
		expect(screen.queryByText("Alpha")).toBeNull();
	});
});
