import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EventSeriesBasesFooterActions } from "../../../../src/react/modals/event-list/event-series-bases-actions";
import { EventSeriesBasesFooter } from "../../../../src/react/modals/event-list/event-series-bases-footer";

function setup() {
	const actions: EventSeriesBasesFooterActions = {
		openTimeline: vi.fn(),
		openHeatmap: vi.fn(),
		openBasesView: vi.fn(),
	};
	const user = userEvent.setup();
	const result = render(<EventSeriesBasesFooter actions={actions} />);
	return { actions, user, ...result };
}

describe("EventSeriesBasesFooter", () => {
	it("renders one button per view type with capitalized labels", () => {
		setup();
		expect(screen.getByText("Table")).toBeTruthy();
		expect(screen.getByText("List")).toBeTruthy();
		expect(screen.getByText("Cards")).toBeTruthy();
		expect(screen.getByText("Timeline")).toBeTruthy();
		expect(screen.getByText("Heatmap")).toBeTruthy();
	});

	it("exposes a stable data-testid per view type", () => {
		setup();
		for (const vt of ["table", "list", "cards", "timeline", "heatmap"]) {
			expect(screen.getByTestId(`prisma-event-series-bases-${vt}`)).toBeTruthy();
		}
	});

	it("routes Timeline click to openTimeline and nothing else", async () => {
		const { actions, user } = setup();
		await user.click(screen.getByTestId("prisma-event-series-bases-timeline"));
		expect(actions.openTimeline).toHaveBeenCalledTimes(1);
		expect(actions.openHeatmap).not.toHaveBeenCalled();
		expect(actions.openBasesView).not.toHaveBeenCalled();
	});

	it("routes Heatmap click to openHeatmap and nothing else", async () => {
		const { actions, user } = setup();
		await user.click(screen.getByTestId("prisma-event-series-bases-heatmap"));
		expect(actions.openHeatmap).toHaveBeenCalledTimes(1);
		expect(actions.openTimeline).not.toHaveBeenCalled();
		expect(actions.openBasesView).not.toHaveBeenCalled();
	});

	it.each(["table", "list", "cards"] as const)("routes %s click to openBasesView with that view type", async (vt) => {
		const { actions, user } = setup();
		await user.click(screen.getByTestId(`prisma-event-series-bases-${vt}`));
		expect(actions.openBasesView).toHaveBeenCalledTimes(1);
		expect(actions.openBasesView).toHaveBeenCalledWith(vt);
		expect(actions.openTimeline).not.toHaveBeenCalled();
		expect(actions.openHeatmap).not.toHaveBeenCalled();
	});
});
