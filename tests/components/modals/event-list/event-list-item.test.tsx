import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EventListItem, type EventListItemData } from "../../../../src/react/modals/event-list/event-list-item";

function makeItem(overrides: Partial<EventListItemData> = {}): EventListItemData {
	return {
		id: "evt-1",
		filePath: "tasks/Team Meeting.md",
		title: "Team Meeting",
		subtitle: "Jan 1, 2026 - 10:00 AM (1h)",
		...overrides,
	};
}

describe("EventListItem", () => {
	it("renders title and subtitle", () => {
		render(<EventListItem item={makeItem()} actions={[]} />);
		expect(screen.getByText("Team Meeting")).toBeTruthy();
		expect(screen.getByText("Jan 1, 2026 - 10:00 AM (1h)")).toBeTruthy();
	});

	it("renders without subtitle when not provided", () => {
		const { subtitle: _, ...noSubtitle } = makeItem();
		render(<EventListItem item={noSubtitle} actions={[]} />);
		expect(screen.getByText("Team Meeting")).toBeTruthy();
		expect(screen.queryByText("Jan 1, 2026")).toBeNull();
	});

	it("applies category color as CSS variable", () => {
		const { container } = render(<EventListItem item={makeItem({ categoryColor: "#ff0000" })} actions={[]} />);
		const row = container.querySelector(".prisma-generic-event-list-item") as HTMLElement;
		expect(row.style.getPropertyValue("--category-color")).toBe("#ff0000");
		expect(row.classList.contains("prisma-recurring-event-categorized")).toBe(true);
	});

	it("sets data-testid from event id", () => {
		render(<EventListItem item={makeItem({ id: "abc-123" })} actions={[]} />);
		expect(screen.getByTestId("prisma-list-row-abc-123")).toBeTruthy();
	});

	it("falls back to filePath for data-testid when id is missing", () => {
		const { id: _, ...noId } = makeItem();
		render(<EventListItem item={noId} actions={[]} />);
		expect(screen.getByTestId("prisma-list-row-tasks/Team Meeting.md")).toBeTruthy();
	});

	it("calls onClick when row is clicked", async () => {
		const onClick = vi.fn();
		const user = userEvent.setup();
		render(<EventListItem item={makeItem()} actions={[]} onClick={onClick} />);

		await user.click(screen.getByText("Team Meeting"));
		expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: "evt-1" }));
	});

	it("renders action buttons and calls handler on click", async () => {
		const handler = vi.fn();
		const user = userEvent.setup();
		render(<EventListItem item={makeItem()} actions={[{ label: "Un-skip", isPrimary: true, handler }]} />);

		const btn = screen.getByText("Un-skip");
		expect(btn.classList.contains("mod-cta")).toBe(true);
		await user.click(btn);
		expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: "evt-1" }));
	});

	it("action button click does not trigger row onClick", async () => {
		const onClick = vi.fn();
		const handler = vi.fn();
		const user = userEvent.setup();
		render(<EventListItem item={makeItem()} actions={[{ label: "Open", handler }]} onClick={onClick} />);

		await user.click(screen.getByText("Open"));
		expect(handler).toHaveBeenCalled();
		expect(onClick).not.toHaveBeenCalled();
	});
});
