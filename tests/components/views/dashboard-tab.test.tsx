import "@testing-library/jest-dom/vitest";

import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { buildDashboardChildren } from "../../../src/react/views/dashboard-tab";
import { createMockApp, createMockReactBundle, renderWithContexts } from "../../fixtures/react-view-fixtures";

vi.mock("@real1ty-obsidian-plugins", async (importOriginal) => {
	const actual: Record<string, unknown> = await importOriginal();
	return {
		...actual,
		createGridLayout: vi.fn((el: HTMLElement, opts: any) => {
			for (const cell of opts.cells) {
				const cellEl = document.createElement("div");
				el.appendChild(cellEl);
				cell.render?.(cellEl);
			}
			return { destroy: vi.fn() };
		}),
	};
});

vi.mock("../../../src/components/views/dashboard-section", () => ({
	buildChartDataFromItems: vi.fn().mockReturnValue([]),
	renderDashboardChart: vi.fn(() => ({ destroy: vi.fn() })),
	renderDashboardRanking: vi.fn(),
	renderDashboardTable: vi.fn(() => ({ destroy: vi.fn() })),
}));

vi.mock("../../../src/react/modals/event-list", () => ({
	openEventSeriesModal: vi.fn(),
}));

vi.mock("../../../src/components/settings/pro-upgrade-banner", () => ({
	renderProUpgradeBanner: vi.fn(),
}));

vi.mock("../../../src/utils/obsidian", async (importOriginal) => {
	const actual = (await importOriginal()) as Record<string, unknown>;
	return { ...actual, getCategoriesFromFilePath: vi.fn().mockReturnValue([]) };
});

describe("buildDashboardChildren", () => {
	it("returns three child specs with stable ids and labels", () => {
		const bundle = createMockReactBundle();
		const children = buildDashboardChildren(createMockApp(), bundle);
		expect(children.map((c) => c.id)).toEqual(["dashboard-by-name", "dashboard-by-category", "dashboard-recurring"]);
		expect(children.map((c) => c.label)).toEqual(["By Name", "By Category", "Recurring"]);
	});

	it("renders the pro gate (no dashboard grid) when license is not Pro", () => {
		const bundle = createMockReactBundle({ isPro: false });
		const children = buildDashboardChildren(createMockApp(), bundle);
		const Section = children[0]!.component;

		renderWithContexts(<Section />, { bundle });
		expect(screen.getByTestId("prisma-pro-gated")).toBeInTheDocument();
		expect(screen.queryByTestId("prisma-dashboard-dashboard-by-name")).not.toBeInTheDocument();
	});
});
