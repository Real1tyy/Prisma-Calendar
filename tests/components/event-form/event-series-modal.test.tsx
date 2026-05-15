import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

describe("EventSeriesModal content", () => {
	it("renders all three scope buttons", () => {
		render(
			<div className="prisma-series-scope-content">
				<p>This is a recurring event. Which instances do you want to modify?</p>
				<div>
					<button data-testid="prisma-series-scope-this">This event</button>
					<button data-testid="prisma-series-scope-following">This and following events</button>
					<button data-testid="prisma-series-scope-all">All events</button>
					<button data-testid="prisma-series-scope-cancel">Cancel</button>
				</div>
			</div>
		);

		expect(screen.getByTestId("prisma-series-scope-this")).toBeTruthy();
		expect(screen.getByTestId("prisma-series-scope-following")).toBeTruthy();
		expect(screen.getByTestId("prisma-series-scope-all")).toBeTruthy();
		expect(screen.getByTestId("prisma-series-scope-cancel")).toBeTruthy();
	});

	it("calls correct callback when scope button is clicked", async () => {
		const user = userEvent.setup();
		const onScope = vi.fn();

		render(
			<div>
				<button data-testid="prisma-series-scope-this" onClick={() => onScope("this")}>
					This event
				</button>
				<button data-testid="prisma-series-scope-all" onClick={() => onScope("all")}>
					All events
				</button>
			</div>
		);

		await user.click(screen.getByTestId("prisma-series-scope-this"));
		expect(onScope).toHaveBeenCalledWith("this");

		await user.click(screen.getByTestId("prisma-series-scope-all"));
		expect(onScope).toHaveBeenCalledWith("all");
	});
});
