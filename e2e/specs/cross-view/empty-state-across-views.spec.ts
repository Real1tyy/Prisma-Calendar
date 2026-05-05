import { anchorISO } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// A vault with zero events must render every view cleanly — no crash, no
// stale data, and a recognisable "nothing here" surface where the renderer
// supports one. The default seed vault is empty (`fixtures/vault-seed/Events`
// has no .md files), so we just open each tab in turn. List-view's
// `.fc-list-empty` path is already covered by `calendar/list-view.spec.ts`.

test.describe("cross-view: empty-state rendering", () => {
	test("daily-stats shows the empty placeholder when no events exist", async ({ calendar }) => {
		await calendar.switchView("daily-stats");
		await expect(calendar.page.locator(sel("prisma-stats-empty")).first()).toBeVisible();
	});

	test("timeline container renders with zero items when vault is empty", async ({ calendar }) => {
		await calendar.switchView("timeline");
		const container = calendar.page.locator(sel("prisma-timeline-container")).first();
		await expect(container).toBeVisible();
		await expect(container.locator(".prisma-timeline-item")).toHaveCount(0);
	});

	test("heatmap renders cells, every cell carries data-count='0'", async ({ calendar }) => {
		await calendar.unlockPro();
		await calendar.switchView("heatmap");
		const container = calendar.page.locator(sel("prisma-heatmap-container")).first();
		await expect(container).toBeVisible();

		// Sample the anchor cell (always inside the rendered range) and assert
		// it reports zero. A wholly-empty heatmap that mistakenly stamped a
		// count anywhere would fail this — see heatmap-renderer.ts:118.
		const anchorCell = container.locator(`${sel("prisma-heatmap-cell")}[data-date="${anchorISO()}"]`).first();
		await expect(anchorCell).toHaveAttribute("data-count", "0");

		// And no cell anywhere on the grid claims a non-zero count.
		const nonZeroCells = container.locator(`${sel("prisma-heatmap-cell")}:not([data-count="0"])`);
		await expect(nonZeroCells).toHaveCount(0);
	});

	test("gantt renders the toolbar but zero bars when no events exist", async ({ calendar }) => {
		await calendar.unlockPro();
		await calendar.switchView("gantt");
		// Pro-gated chrome is the proof we're past the upgrade banner.
		await expect(calendar.page.locator(sel("prisma-gantt-create")).first()).toBeVisible();
		await expect(calendar.page.locator(".prisma-gantt-bar")).toHaveCount(0);
	});

	test("dashboard by-name renders an empty ranking when no events exist", async ({ calendar }) => {
		await calendar.unlockPro();
		await calendar.switchToGroupChild("dashboard", "dashboard-by-name");

		const ranking = calendar.page.locator(`${sel("prisma-dashboard-cell-ranking")}:visible`).first();
		await expect(ranking).toBeVisible();
		// `dashboard-section.ts` stamps each ranking row with
		// `prisma-dashboard-ranking-row-<title>`. With no events, none exist.
		await expect(calendar.page.locator('[data-testid^="prisma-dashboard-ranking-row-"]')).toHaveCount(0);
	});

	test("dashboard by-category renders an empty ranking when no events exist", async ({ calendar }) => {
		await calendar.unlockPro();
		await calendar.switchToGroupChild("dashboard", "dashboard-by-category");

		const ranking = calendar.page.locator(`${sel("prisma-dashboard-cell-ranking")}:visible`).first();
		await expect(ranking).toBeVisible();
		await expect(calendar.page.locator('[data-testid^="prisma-dashboard-ranking-row-"]')).toHaveCount(0);
	});
});
