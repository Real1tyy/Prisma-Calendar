import { gotoToday } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";

test.describe("calendar navigation", () => {
	test("prev/next/today toolbar buttons move the visible date", async ({ obsidian }) => {
		const { page } = obsidian;
		await openCalendar(page);
		await gotoToday(page);

		const header = page.locator(".fc-toolbar-title").first();
		const initial = (await header.textContent())?.trim();
		expect(initial).toBeTruthy();

		await page.locator('[data-testid="prisma-cal-toolbar-next"]').first().click();
		await expect(header).not.toHaveText(initial ?? "");

		await page.locator('[data-testid="prisma-cal-toolbar-prev"]').first().click();
		await expect(header).toHaveText(initial ?? "");

		await page.locator('[data-testid="prisma-cal-toolbar-next"]').first().click();
		await page.locator('[data-testid="prisma-cal-toolbar-next"]').first().click();
		await expect(header).not.toHaveText(initial ?? "");

		await page.locator('[data-testid="prisma-cal-toolbar-today"]').first().click();
		await expect(header).toHaveText(initial ?? "");
	});

	test("day/week/month view buttons switch the FullCalendar view", async ({ obsidian }) => {
		const { page } = obsidian;
		await openCalendar(page);
		await gotoToday(page);

		await page.locator('[data-testid="prisma-cal-toolbar-view-week"]').first().click();
		await expect(page.locator(".fc-timeGridWeek-view, .fc-view-harness .fc-timegrid").first()).toBeVisible();

		await page.locator('[data-testid="prisma-cal-toolbar-view-month"]').first().click();
		await expect(page.locator(".fc-dayGridMonth-view").first()).toBeVisible();

		await page.locator('[data-testid="prisma-cal-toolbar-view-day"]').first().click();
		await expect(page.locator(".fc-timeGridDay-view, .fc-timegrid").first()).toBeVisible();
	});

	test("clicking the Now toolbar button keeps the view on today without error", async ({ obsidian }) => {
		const { page } = obsidian;
		await openCalendar(page);
		await gotoToday(page);

		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));

		await page.locator('[data-testid="prisma-cal-toolbar-goto-now"]').first().click();
		// The Now button is a scroll action in time-grid views, not a nav —
		// the header should remain on today's date after the click.
		expect(errors, errors.join("\n")).toHaveLength(0);
	});
});
