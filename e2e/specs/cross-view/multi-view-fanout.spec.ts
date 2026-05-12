import { expectBackgroundColor } from "../../fixtures/color-assertions";
import { todayISO, todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { eventTileByTitle, TIMELINE_ITEM_CLASS } from "../../fixtures/testids";

// One settings mutation must ripple to every mounted view. `settings-to-view-
// reactivity.spec.ts` already asserts calendar + timeline for color rules;
// this spec extends the same fan-out to **five** view surfaces simultaneously,
// proving the RxJS subscriber chain wakes every consumer:
//
//   calendar (week tiles) → timeline (items) → heatmap (cell count)
//                        → dashboard-by-name (rankings)
//                        → dashboard-by-category (rankings)
//
// Calendar + timeline pick up the new color; heatmap + dashboard rows don't
// (their renderers don't consume the rule color) but they MUST stay alive —
// a regression in subscriber disposal would leave them empty or stale after
// the unrelated rule update. Gantt is excluded because its filter requires
// prerequisite-connected events; see `cross-view-gantt.spec.ts` for that path.

const CATEGORY = "Fanout";
const BASELINE_DEFAULT = "#cccccc";
const RULE_COLOR = "#ff00ff";
const RULE_ID = "rule-fanout";

test.describe("cross-view: single settings mutation fans out to 5 mounted views", () => {
	test("toggling a color rule recolors calendar/timeline and keeps heatmap+dashboard consistent", async ({
		calendar,
	}) => {
		const page = calendar.page;
		await calendar.unlockPro();

		await updateCalendarSettings(page, {
			defaultNodeColor: BASELINE_DEFAULT,
			colorRules: [
				{ id: RULE_ID, expression: `Category.includes('${CATEGORY}')`, color: BASELINE_DEFAULT, enabled: false },
			],
		});

		// `seedAndStabilize` writes via `vault.create` so the category tracker
		// receives the metadata-cache event — required for the dashboard
		// ranking to surface the category row. `seedOnDiskMany` bypasses the
		// cache and would leave the tracker empty.
		const eventsInput = [
			{ title: "Fanout One", startDate: todayStamp(9, 0), endDate: todayStamp(10, 0), category: CATEGORY },
			{ title: "Fanout Two", startDate: todayStamp(11, 0), endDate: todayStamp(12, 0), category: CATEGORY },
			{ title: "Fanout Three", startDate: todayStamp(14, 0), endDate: todayStamp(15, 0), category: CATEGORY },
		];
		await calendar.seedAndStabilize(eventsInput);
		const titles = eventsInput.map((e) => e.title);

		await calendar.switchMode("week");

		// ── Phase 1: baseline color on calendar + timeline ────────────
		for (const title of titles) {
			const tile = page.locator(eventTileByTitle(title)).first();
			await expectBackgroundColor(tile, BASELINE_DEFAULT);
		}

		await calendar.switchView("timeline");
		for (const title of titles) {
			const item = page.locator(TIMELINE_ITEM_CLASS).filter({ hasText: title }).first();
			await expectBackgroundColor(item, BASELINE_DEFAULT);
		}

		// Heatmap baseline — events exist with the right count.
		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 3);

		// Dashboard-by-category baseline — fifth view in the fan-out.
		// (`dashboard-by-name` filters to series with 2+ events sharing a
		// title, so unique-titled rows wouldn't rank.)
		await calendar.expectDashboardItem("dashboard-by-category", CATEGORY);

		// ── Phase 2: enable the color rule — one settings mutation ──
		await updateCalendarSettings(page, {
			defaultNodeColor: BASELINE_DEFAULT,
			colorRules: [{ id: RULE_ID, expression: `Category.includes('${CATEGORY}')`, color: RULE_COLOR, enabled: true }],
		});

		// Heatmap stays consistent — same date, same 3-event count.
		await calendar.switchView("heatmap");
		await calendar.expectHeatmapCount(todayISO(), 3);

		// Dashboard category ranking — still ranks after the unrelated change.
		await calendar.expectDashboardItem("dashboard-by-category", CATEGORY);

		// Timeline repaints to the rule color.
		await calendar.switchView("timeline");
		for (const title of titles) {
			const item = page.locator(TIMELINE_ITEM_CLASS).filter({ hasText: title }).first();
			await expectBackgroundColor(item, RULE_COLOR);
		}

		// Calendar week tiles repaint to the rule color.
		await calendar.switchView("calendar");
		await calendar.switchMode("week");
		for (const title of titles) {
			const tile = page.locator(eventTileByTitle(title)).first();
			await expectBackgroundColor(tile, RULE_COLOR);
		}
	});
});
