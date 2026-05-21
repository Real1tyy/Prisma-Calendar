import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// E2E value: prove the indicator label round-trips through the real RxJS
// pipeline — on-disk events → metadataCache → eventStore.changes$ → the
// debounced subscription → label format. Capacity math itself is covered by
// tests/utils/stats/capacity*.test.ts; the indicator's render behaviour with
// mocked observables is covered by tests/components/views/capacity-indicator.
// What only E2E can catch: the wiring between those three layers in the
// shipped bundle.

test.describe("analytics: capacity indicator (live)", () => {
	test("indicator label reflects used / inferred-capacity / percent from on-disk events", async ({ calendar }) => {
		// Seed two timed events: 09:00–10:00 and 11:00–12:00.
		// inferBoundaries → start=9, end=12 → capacity = 3h.
		// Used = 1h + 1h = 2h. Percent = (2/3)*100 = 66.67 → toFixed(0) = "67".
		// Day view ensures the indicator's range is exactly today.
		await calendar.switchMode("day");
		await calendar.seedOnDiskMany([
			{ title: "Capacity One", start: todayStamp(9, 0), end: todayStamp(10, 0) },
			{ title: "Capacity Two", start: todayStamp(11, 0), end: todayStamp(12, 0) },
		]);

		const indicator = calendar.page.locator(sel("prisma-capacity-indicator")).first();
		await expect(indicator).toHaveText("⏱ 2h / 3h (67%)");
	});
});
