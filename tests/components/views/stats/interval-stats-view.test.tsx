import "@testing-library/jest-dom/vitest";

import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IntervalStatsView, type IntervalStatsConfig } from "../../../../src/react/views/stats/interval-stats-view";
import { createMockReactBundle, renderWithContexts } from "../../../fixtures/react-view-fixtures";

const visibilityHandlers: Array<(label: string, visible: boolean) => void> = [];

vi.mock("../../../../src/react/views/stats/stats-chart", () => ({
	StatsChart: ({
		entries,
		onVisibilityChange,
	}: {
		entries: Array<{ name: string }>;
		onVisibilityChange?: (label: string, visible: boolean) => void;
	}) => {
		if (onVisibilityChange) visibilityHandlers.push(onVisibilityChange);
		return (
			<div data-testid="prisma-mock-stats-chart">
				{entries.map((e) => (
					<span key={e.name}>{e.name}</span>
				))}
			</div>
		);
	},
}));

vi.mock("../../../../src/utils/stats", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	const mockStats = {
		totalDuration: 10_800_000,
		entries: [
			{ name: "Work", duration: 7_200_000, count: 2, isRecurring: false },
			{ name: "Workout", duration: 3_600_000, count: 1, isRecurring: false },
		],
	};
	return {
		...actual,
		buildStatsSnapshot: vi.fn().mockResolvedValue({
			bounds: { start: new Date(2026, 4, 18), end: new Date(2026, 4, 19) },
			events: [],
			skippedEvents: [],
			filteredEvents: [],
			stats: mockStats,
		}),
	};
});

const config: IntervalStatsConfig = {
	interval: "day",
	formatDate: (d) => d.toISOString().slice(0, 10),
	emptyMessage: "No data",
};

beforeEach(() => {
	visibilityHandlers.length = 0;
});

afterEach(() => {
	vi.clearAllMocks();
});

function getLastVisibilityHandler(): (label: string, visible: boolean) => void {
	const handler = visibilityHandlers[visibilityHandlers.length - 1];
	if (!handler) throw new Error("StatsChart mock never received an onVisibilityChange callback");
	return handler;
}

async function renderAndWait(): Promise<void> {
	const bundle = createMockReactBundle();
	renderWithContexts(<IntervalStatsView bundle={bundle} config={config} date={new Date(2026, 4, 18)} />, { bundle });
	await waitFor(() => expect(screen.getByTestId("prisma-stats-table")).toBeInTheDocument());
}

describe("IntervalStatsView — pie chart filter", () => {
	it("shows all entries and full totals before any filter", async () => {
		await renderAndWait();
		expect(screen.getByTestId("prisma-stats-entry-Work")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-stats-entry-Workout")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-stats-total-count").textContent).toContain("3 events");
	});

	it("removes the hidden entry from the table when the chart legend hides it", async () => {
		await renderAndWait();
		act(() => getLastVisibilityHandler()("Workout", false));

		expect(screen.queryByTestId("prisma-stats-entry-Workout")).not.toBeInTheDocument();
		expect(screen.getByTestId("prisma-stats-entry-Work")).toBeInTheDocument();
	});

	it("recomputes the header event count over the visible entries only", async () => {
		await renderAndWait();
		act(() => getLastVisibilityHandler()("Workout", false));

		expect(screen.getByTestId("prisma-stats-total-count").textContent).toContain("2 events");
	});

	it("rescales the remaining row to 100% when one entry is hidden", async () => {
		await renderAndWait();
		act(() => getLastVisibilityHandler()("Workout", false));

		const workRow = screen.getByTestId("prisma-stats-entry-Work");
		expect(workRow.textContent).toContain("100");
	});

	it("restores the entry and full totals when the legend item is shown again", async () => {
		await renderAndWait();
		act(() => getLastVisibilityHandler()("Workout", false));
		act(() => getLastVisibilityHandler()("Workout", true));

		expect(screen.getByTestId("prisma-stats-entry-Workout")).toBeInTheDocument();
		expect(screen.getByTestId("prisma-stats-total-count").textContent).toContain("3 events");
		expect(screen.queryByTestId("prisma-stats-clear-filter")).not.toBeInTheDocument();
	});

	it("exposes a clear-filter button while any entry is hidden", async () => {
		await renderAndWait();
		expect(screen.queryByTestId("prisma-stats-clear-filter")).not.toBeInTheDocument();

		act(() => getLastVisibilityHandler()("Workout", false));

		const clearButton = screen.getByTestId("prisma-stats-clear-filter");
		expect(clearButton).toBeInTheDocument();
		act(() => clearButton.click());

		expect(screen.queryByTestId("prisma-stats-clear-filter")).not.toBeInTheDocument();
		expect(screen.getByTestId("prisma-stats-entry-Workout")).toBeInTheDocument();
	});
});
