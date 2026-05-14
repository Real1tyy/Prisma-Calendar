import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardRanking } from "../../../../src/react/views/dashboard/dashboard-ranking";
import type { DashboardItem, StatEntry } from "../../../../src/react/views/dashboard/dashboard-types";

describe("DashboardRanking", () => {
	it("renders stat cards from stats array", () => {
		const stats: StatEntry[] = [
			{ label: "Total", value: 42 },
			{ label: "Active", value: 10 },
		];

		render(<DashboardRanking items={[]} stats={stats} />);

		expect(screen.getByTestId("prisma-dashboard-stat-Total")).toBeTruthy();
		expect(screen.getByTestId("prisma-dashboard-stat-value-Total").textContent).toBe("42");
		expect(screen.getByTestId("prisma-dashboard-stat-Active")).toBeTruthy();
	});

	it("renders ranking rows sorted by count descending", () => {
		const items: DashboardItem[] = [
			{ key: "a", title: "Alpha", count: 5, extraProps: {} },
			{ key: "b", title: "Beta", count: 10, extraProps: {} },
			{ key: "c", title: "Gamma", count: 3, extraProps: {} },
		];

		const { container } = render(<DashboardRanking items={items} stats={[]} />);

		const rows = container.querySelectorAll(".prisma-dashboard-ranking-row");
		expect(rows.length).toBe(3);
		expect(rows[0].getAttribute("data-item-title")).toBe("Beta");
		expect(rows[1].getAttribute("data-item-title")).toBe("Alpha");
		expect(rows[2].getAttribute("data-item-title")).toBe("Gamma");
	});

	it("limits ranking to top 10 items", () => {
		const items: DashboardItem[] = Array.from({ length: 15 }, (_, i) => ({
			key: `item-${i}`,
			title: `Item ${i}`,
			count: 15 - i,
			extraProps: {},
		}));

		const { container } = render(<DashboardRanking items={items} stats={[]} />);

		const rows = container.querySelectorAll(".prisma-dashboard-ranking-row");
		expect(rows.length).toBe(10);
	});

	it("renders empty state when no items", () => {
		const { container } = render(<DashboardRanking items={[]} stats={[]} />);

		expect(container.querySelector(".prisma-dashboard-chart-empty")).toBeTruthy();
	});

	it("applies item color to ranking bars", () => {
		const items: DashboardItem[] = [{ key: "a", title: "Colored", count: 5, color: "#ff0000", extraProps: {} }];

		const { container } = render(<DashboardRanking items={items} stats={[]} />);

		const bar = container.querySelector(".prisma-dashboard-ranking-bar") as HTMLElement;
		expect(bar.style.backgroundColor.toLowerCase()).toMatch(/^(?:#ff0000|rgb\(255,\s*0,\s*0\))$/);
	});
});
