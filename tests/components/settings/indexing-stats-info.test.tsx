import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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

describe("IndexingStatsInfo", () => {
	it("renders the per-system tally line", () => {
		render(<IndexingStatsInfo tally={makeTally()} />);
		expect(screen.getByTestId("prisma-indexing-stats").textContent).toBe(
			"1 timed · 1 all-day · 1 untracked · 1 couldn't be read"
		);
	});

	it("omits the dropped clause when nothing couldn't be read", () => {
		render(
			<IndexingStatsInfo
				tally={makeTally({
					dropped: 0,
					dropReasons: { "unparseable-date": 0, "unmapped-date-prop": 0, "trailing-space-key": 0 },
				})}
			/>
		);
		expect(screen.getByTestId("prisma-indexing-stats").textContent).toBe("1 timed · 1 all-day · 1 untracked");
	});
});
