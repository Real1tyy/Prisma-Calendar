import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { BehaviorSubject } from "rxjs";
import { describe, expect, it, vi } from "vitest";

import type { CalendarBundle } from "../../../src/core/calendar-bundle";
import type { IndexingTally } from "../../../src/core/indexing-stats";
import { IndexingStatsInfo } from "../../../src/react/settings/indexing-stats-info";

function makeTally(overrides: Partial<IndexingTally> = {}): IndexingTally {
	return {
		total: 4,
		timed: 1,
		allDay: 1,
		untracked: 1,
		dropped: 1,
		dropReasons: { "unparseable-date": 1, "unmapped-date-prop": 0, "trailing-space-key": 0 },
		...overrides,
	};
}

function setup(initial: IndexingTally | null) {
	const stats$ = new BehaviorSubject<IndexingTally | null>(initial);
	const refreshCalendar = vi.fn();
	const bundle = { indexingStats$: stats$, refreshCalendar } as unknown as CalendarBundle;
	const user = userEvent.setup();
	const result = render(<IndexingStatsInfo bundle={bundle} />);
	return { stats$, refreshCalendar, user, ...result };
}

describe("IndexingStatsInfo", () => {
	it("renders the per-system tally line", () => {
		setup(makeTally());
		expect(screen.getByTestId("prisma-indexing-stats").textContent).toBe(
			"Indexed: 1 timed · 1 all-day · 1 untracked · 1 couldn't be read"
		);
	});

	it("shows a placeholder before the first index settles", () => {
		setup(null);
		expect(screen.getByTestId("prisma-indexing-stats").textContent).toBe("Indexing…");
	});

	it("reindexes when the Reindex button is clicked", async () => {
		const { refreshCalendar, user } = setup(makeTally());
		await user.click(screen.getByTestId("prisma-reindex-calendar"));
		expect(refreshCalendar).toHaveBeenCalledTimes(1);
	});
});
