import { expect, test } from "../../fixtures/electron";
import { openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { seedEvents, waitForEventCount } from "../../fixtures/seed-events";

// The Properties tab surfaces a live "is my folder wired up?" tally and a
// one-click reindex. Crosses boundaries RTL can't fake: real on-disk
// frontmatter → indexer → bundle stats → React settings panel → resync.

test.describe("settings: indexing stats + reindex", () => {
	test("Properties tab shows the per-system tally and reindex affordance", async ({ calendar }) => {
		seedEvents(calendar.vaultDir, [
			{ title: "Timed One", startDate: "2026-06-15T09:00", endDate: "2026-06-15T10:00" },
			{ title: "Timed Two", startDate: "2026-06-16T09:00", endDate: "2026-06-16T10:00" },
			{ title: "All Day One", date: "2026-06-15", allDay: true },
			{ title: "Loose Note", extra: { project: "Apollo" } },
			{ title: "Bad Date", startDate: "next tuesday" },
		]);

		await waitForEventCount(calendar.page, 3);

		await openPrismaSettings(calendar.page);
		await switchSettingsTab(calendar.page, "properties");

		const stats = calendar.page.getByTestId("prisma-indexing-stats");
		await expect(stats).toContainText("2 timed");
		await expect(stats).toContainText("1 all-day");
		await expect(stats).toContainText("1 untracked");
		await expect(stats).toContainText("1 couldn't be read");

		await calendar.page.getByTestId("prisma-reindex-calendar").click();

		// Reindex re-reads the same files — the tally is stable afterwards.
		await expect(stats).toContainText("2 timed");
		await expect(stats).toContainText("1 couldn't be read");
	});
});
