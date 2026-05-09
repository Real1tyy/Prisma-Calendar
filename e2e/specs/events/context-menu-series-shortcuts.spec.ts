import { waitForEvent } from "../../fixtures/calendar-helpers";
import { fromAnchor, todayISO } from "../../fixtures/dates";
import { expectSeriesModalOpen } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { type SeedEventInput } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";

const DEFAULT_FUTURE_INSTANCES = 2;

function zettelSuffix(i: number): string {
	return String(20260502090000 + i).padStart(14, "0");
}

test.describe("context menu — series shortcut items", () => {
	test("viewNameSeries lists all events sharing the same name and selects name tab", async ({ calendar }) => {
		const { page } = calendar;
		const count = 3;
		const events: SeedEventInput[] = [
			...Array.from({ length: count }, (_, i) => ({
				title: `Team Meeting-${zettelSuffix(i)}`,
				startDate: fromAnchor(i, 9),
				endDate: fromAnchor(i, 10),
				category: "Work",
			})),
			// Noise: same category, different name — must NOT surface in the name-series view.
			{
				title: `Workout-${zettelSuffix(count)}`,
				startDate: fromAnchor(0, 14),
				endDate: fromAnchor(0, 15),
				category: "Work",
			},
		];

		await calendar.switchMode("week");
		await calendar.goToAnchor();
		await calendar.seedAndStabilize(events);
		await waitForEvent(page, "Team Meeting");

		const evt = await calendar.eventByTitle("Team Meeting");
		await evt.rightClick("viewNameSeries");

		const series = await expectSeriesModalOpen(page);
		await series.expectTabActive("name");
		await series.expectTabInactive("category");
		await series.expectRowCount(count);
		await series.expectTotal(count);
		await series.expectAllTitles("Team Meeting");
	});

	test("viewCategorySeries lists only events in the same category and selects category tab", async ({ calendar }) => {
		const { page } = calendar;
		const events: SeedEventInput[] = [
			...Array.from({ length: 3 }, (_, i) => ({
				title: `Workout ${i}`,
				startDate: fromAnchor(i, 11),
				endDate: fromAnchor(i, 12),
				category: "Fitness",
			})),
			...Array.from({ length: 2 }, (_, i) => ({
				title: `Review ${i}`,
				startDate: fromAnchor(i, 14),
				endDate: fromAnchor(i, 15),
				category: "Work",
			})),
		];

		await calendar.switchMode("week");
		await calendar.goToAnchor();
		await calendar.seedAndStabilize(events);
		await waitForEvent(page, "Workout 0");

		const evt = await calendar.eventByTitle("Workout 0");
		await evt.rightClick("viewCategorySeries");

		const series = await expectSeriesModalOpen(page);
		await series.expectTabActive("category");
		await series.expectRowCount(3);
		await series.expectTotal(3);

		// Workouts only — no Reviews bled in via the wrong category bucket.
		const titles = await series.titles();
		expect(titles.every((t) => t.startsWith("Workout"))).toBe(true);
		expect(titles.some((t) => t.startsWith("Review"))).toBe(false);
	});

	test("viewCategorySeries and viewRecurringSeries are hidden when not applicable", async ({ calendar }) => {
		const { page } = calendar;

		await calendar.switchMode("week");
		await calendar.goToAnchor();
		await calendar.seedAndStabilize([
			{ title: "Plain Event", startDate: fromAnchor(0, 13), endDate: fromAnchor(0, 14) },
		]);
		await waitForEvent(page, "Plain Event");

		const block = page.locator(`${sel(TID.block)}[data-event-title="Plain Event"]`).first();
		await block.click({ button: "right" });

		await expect(page.locator(sel(TID.ctxMenu("viewNameSeries"))).first()).toBeVisible();
		await expect(page.locator(sel(TID.ctxMenu("viewCategorySeries")))).toHaveCount(0);
		await expect(page.locator(sel(TID.ctxMenu("viewRecurringSeries")))).toHaveCount(0);

		await page.keyboard.press("Escape");
	});

	test("viewRecurringSeries shows physical instances for a daily recurring source", async ({ calendar }) => {
		const todayStr = todayISO();

		const evt = await calendar.createEvent({
			title: "Daily Standup",
			start: `${todayStr}T09:00`,
			end: `${todayStr}T09:30`,
			recurring: { rruleType: "daily" },
		});

		// Settings default for `futureInstancesCount` is 2 (settings.ts) and the
		// generator stops the moment that count is reached, so an exact poll is
		// safe and matches the `Total: N` stat the modal renders below.
		await evt.expectInstanceCount(DEFAULT_FUTURE_INSTANCES);

		await evt.rightClick("viewRecurringSeries");

		const series = await expectSeriesModalOpen(calendar.page);
		// `tabs.length >= 2` — recurring + name (both `rruleId` and `nameKey` are set).
		await series.expectTabActive("recurring");
		await series.expectRowCount(DEFAULT_FUTURE_INSTANCES);
		await series.expectTotal(DEFAULT_FUTURE_INSTANCES);
	});
});
