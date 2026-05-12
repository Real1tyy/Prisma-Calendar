import { expect } from "@playwright/test";

import { todayISO, todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";

// Every reactive consumer (calendar view, timeline tab, heatmap, dashboard,
// gantt) holds an RxJS subscription on the event store + ancillary trackers
// (category, name-series, prerequisite, holiday). When a leaf closes, its
// subscriptions must be released — a leaked subscription would surface as
// a stale handler firing against a detached DOM node, which Obsidian's
// renderer logs as a `console.error` or `pageerror`. The harness in
// `electron.ts` collects both and fails the spec automatically.
//
// This spec walks an open → close cycle across multiple calendar leaves
// while mutating the underlying data, then asserts:
//   1. No console errors / page errors fired (subscription-leak signal,
//      enforced by the test harness).
//   2. Per-bundle event store reflects the mutation — so the live
//      subscribers are still wired correctly after the closes.

test.describe("cross-view: subscription cleanup across leaf lifecycles", () => {
	test("open/close cycles do not leak subscribers — event store stays consistent", async ({ calendar }) => {
		const page = calendar.page;

		await calendar.seedAndStabilize([
			{ title: "Lifecycle Keep", startDate: todayStamp(8, 0), endDate: todayStamp(9, 0) },
			{ title: "Lifecycle Drop", startDate: todayStamp(10, 0), endDate: todayStamp(11, 0) },
			{ title: "Lifecycle Other", startDate: todayStamp(13, 0), endDate: todayStamp(14, 0) },
		]);

		await calendar.unlockPro();
		expect(await calendar.leafCount()).toBe(1);
		expect(await calendar.eventStoreCount()).toBe(3);

		// Open 2 additional leaves, each pinned to a different non-calendar tab.
		await calendar.openInNewLeaf();
		await calendar.switchView("timeline");
		await calendar.openInNewLeaf();
		await calendar.switchView("heatmap");
		expect(await calendar.leafCount()).toBe(3);

		// Close all but the original leaf. Subscribers on closed leaves should
		// be released; the test harness fails on any console.error / pageerror
		// emitted by stale handlers (electron.ts:345-360).
		await calendar.detachExtraLeaves(1);
		expect(await calendar.leafCount()).toBe(1);

		// Open a fresh calendar leaf so the rest of the spec has a fully-mounted
		// FC instance to drive. The surviving leaf from `detach` may have been
		// stripped of its view state by Obsidian's workspace shuffling.
		await calendar.openInNewLeaf();
		await page.locator(".fc-header-toolbar.fc-toolbar").first().waitFor({ state: "visible" });
		await calendar.switchView("calendar");
		await calendar.switchMode("week");

		// Mutate after the close + re-mount. Surviving event store still
		// observes the deletion.
		const drop = await calendar.eventByTitle("Lifecycle Drop");
		await drop.rightClick("deleteEvent");
		await drop.expectExists(false);
		await expect.poll(() => calendar.eventStoreCount()).toBe(2);

		// Heatmap view (just re-opened) reflects the new count without a stale
		// cell — proves the freshly-mounted subscriber is wired.
		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 2);

		// One more mutation cycle to confirm subsequent mutations also propagate.
		await calendar.switchView("calendar");
		const other = await calendar.eventByTitle("Lifecycle Other");
		await other.rightClick("deleteEvent");
		await other.expectExists(false);
		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 1);
		expect(await calendar.eventStoreCount()).toBe(1);
	});
});
