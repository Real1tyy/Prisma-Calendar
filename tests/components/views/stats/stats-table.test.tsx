import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatsTable } from "../../../../src/react/views/stats/stats-table";
import type { WeeklyStatEntry } from "../../../../src/utils/stats";

function createEntries(count: number): WeeklyStatEntry[] {
	return Array.from({ length: count }, (_, i) => ({
		name: `Event ${i + 1}`,
		duration: (i + 1) * 3_600_000,
		count: i + 1,
		isRecurring: i % 3 === 0,
	}));
}

describe("StatsTable", () => {
	it("renders all entries when under page limit", () => {
		const entries = createEntries(5);
		const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);

		render(<StatsTable entries={entries} totalDuration={totalDuration} showDecimalHours={false} />);

		expect(screen.getByTestId("prisma-stats-table")).toBeTruthy();
		for (const entry of entries) {
			expect(screen.getByTestId(`prisma-stats-entry-${entry.name}`)).toBeTruthy();
		}
	});

	it("marks recurring entries with the recurring class", () => {
		const entries = createEntries(3);
		const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);

		const { container } = render(
			<StatsTable entries={entries} totalDuration={totalDuration} showDecimalHours={false} />
		);

		const recurringCells = container.querySelectorAll(".prisma-stats-recurring");
		expect(recurringCells.length).toBeGreaterThan(0);
	});

	it("renders pagination when entries exceed page limit", () => {
		const entries = createEntries(25);
		const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);

		const { container } = render(
			<StatsTable entries={entries} totalDuration={totalDuration} showDecimalHours={false} />
		);

		expect(container.querySelector(".prisma-stats-pagination")).toBeTruthy();
	});

	it("does not render pagination when entries are within page limit", () => {
		const entries = createEntries(15);
		const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);

		const { container } = render(
			<StatsTable entries={entries} totalDuration={totalDuration} showDecimalHours={false} />
		);

		expect(container.querySelector(".prisma-stats-pagination")).toBeFalsy();
	});

	it("formats durations as decimal hours when showDecimalHours is true", () => {
		const entries: WeeklyStatEntry[] = [{ name: "Task", duration: 5_400_000, count: 1, isRecurring: false }];

		render(<StatsTable entries={entries} totalDuration={5_400_000} showDecimalHours={true} />);

		const durationCell = screen.getByTestId("prisma-stats-entry-duration-Task");
		expect(durationCell.textContent).toContain("1.5");
	});
});
