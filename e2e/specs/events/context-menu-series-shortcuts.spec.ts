import { waitForEvent } from "../../fixtures/calendar-helpers";
import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, type SeedEventInput } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";
import { formatLocalDate, listEventFiles } from "./events-helpers";

const MODAL_SEL = ".prisma-recurring-events-list-modal";
const ROW_SEL = ".prisma-recurring-event-row";
const TITLE_SEL = ".prisma-recurring-event-title";
const STATS_SEL = ".prisma-recurring-events-stats-text";
const TAB_SEL = (tab: string): string => `[data-testid="prisma-event-series-tab-${tab}"]`;
const INSTANCE_FILE_TIMEOUT_MS = 10_000;
const DEFAULT_FUTURE_INSTANCES = 2;

function zettelSuffix(i: number): string {
	return String(20260502090000 + i).padStart(14, "0");
}

function instanceFileRegex(title: string): RegExp {
	const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`/${escaped} (\\d{4})-(\\d{2})-(\\d{2})-\\d+\\.md$`);
}

function collectInstanceFiles(vaultDir: string, title: string): string[] {
	return listEventFiles(vaultDir).filter((p) => instanceFileRegex(title).test(p));
}

test.describe("context menu — series shortcut items", () => {
	test("viewNameSeries lists all events sharing the same name and selects name tab", async ({ calendar }) => {
		const { page } = calendar;
		const count = 3;
		const events: SeedEventInput[] = Array.from({ length: count }, (_, i) => ({
			title: `Team Meeting-${zettelSuffix(i)}`,
			startDate: fromAnchor(i, 9),
			endDate: fromAnchor(i, 10),
			category: "Work",
		}));

		await calendar.switchMode("week");
		await calendar.goToAnchor();
		await calendar.seedAndStabilize(events);
		await waitForEvent(page, "Team Meeting");

		const evt = await calendar.eventByTitle("Team Meeting");
		await evt.rightClick("viewNameSeries");

		const modal = page.locator(MODAL_SEL);
		await expect(modal).toBeVisible();

		const nameTab = modal.locator(TAB_SEL("name"));
		await expect(nameTab).toBeVisible();
		await expect(nameTab).toHaveClass(/is-active/);

		const catTab = modal.locator(TAB_SEL("category"));
		await expect(catTab).toBeVisible();
		await expect(catTab).not.toHaveClass(/is-active/);

		await expect(modal.locator(ROW_SEL)).toHaveCount(count);
		await expect(modal.locator(STATS_SEL).first()).toContainText(`Total: ${count}`);

		const titles = await modal.locator(TITLE_SEL).allTextContents();
		expect(titles.every((t) => t === "Team Meeting")).toBe(true);
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

		const modal = page.locator(MODAL_SEL);
		await expect(modal).toBeVisible();

		const catTab = modal.locator(TAB_SEL("category"));
		await expect(catTab).toBeVisible();
		await expect(catTab).toHaveClass(/is-active/);

		await expect(modal.locator(ROW_SEL)).toHaveCount(3);
		await expect(modal.locator(STATS_SEL).first()).toContainText("Total: 3");
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
		const { page, vaultDir } = calendar;
		const todayStr = formatLocalDate(new Date());

		await calendar.createEvent({
			title: "Daily Standup",
			start: `${todayStr}T09:00`,
			end: `${todayStr}T09:30`,
			recurring: { rruleType: "daily" },
		});

		await expect
			.poll(() => collectInstanceFiles(vaultDir, "Daily Standup").length, {
				timeout: INSTANCE_FILE_TIMEOUT_MS,
			})
			.toBeGreaterThanOrEqual(DEFAULT_FUTURE_INSTANCES);

		await refreshCalendar(page);
		await waitForEvent(page, "Daily Standup");

		const evt = await calendar.eventByTitle("Daily Standup");
		await evt.rightClick("viewRecurringSeries");

		const modal = page.locator(MODAL_SEL);
		await expect(modal).toBeVisible();

		const recurTab = modal.locator(TAB_SEL("recurring"));
		if (await recurTab.isVisible()) {
			await expect(recurTab).toHaveClass(/is-active/);
		}

		await expect(modal.locator(ROW_SEL)).toHaveCount(DEFAULT_FUTURE_INSTANCES);
		await expect(modal.locator(STATS_SEL).first()).toContainText(`Total: ${DEFAULT_FUTURE_INSTANCES}`);
	});
});
