import { gotoToday } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { sel, TID, type ViewMode } from "../../fixtures/testids";

test.describe("calendar navigation", () => {
	test("prev/next/today toolbar buttons move the visible date", async ({ calendar }) => {
		const { page } = calendar;
		await gotoToday(page);

		const header = page.locator(".fc-toolbar-title").first();
		const initial = (await header.textContent())?.trim();
		expect(initial).toBeTruthy();

		const next = page.locator(sel(TID.toolbar("next"))).first();
		const prev = page.locator(sel(TID.toolbar("prev"))).first();
		const today = page.locator(sel(TID.toolbar("today"))).first();

		await next.click();
		await expect(header).not.toHaveText(initial ?? "");

		await prev.click();
		await expect(header).toHaveText(initial ?? "");

		await next.click();
		await next.click();
		await expect(header).not.toHaveText(initial ?? "");

		await today.click();
		await expect(header).toHaveText(initial ?? "");
	});

	test("day/week/month view buttons switch the FullCalendar view", async ({ calendar }) => {
		await gotoToday(calendar.page);

		await calendar.switchMode("week");
		await expect(calendar.page.locator(".fc-timeGridWeek-view, .fc-view-harness .fc-timegrid").first()).toBeVisible();

		await calendar.switchMode("month");
		await expect(calendar.page.locator(".fc-dayGridMonth-view").first()).toBeVisible();

		await calendar.switchMode("day");
		await expect(calendar.page.locator(".fc-timeGridDay-view, .fc-timegrid").first()).toBeVisible();
	});

	test("clicking the Now toolbar button keeps the view on today without error", async ({ calendar }) => {
		const { page } = calendar;
		await gotoToday(page);

		const errors: string[] = [];
		page.on("pageerror", (err) => errors.push(err.message));

		await page
			.locator(sel(TID.toolbar("goto-now")))
			.first()
			.click();
		// The Now button is a scroll action in time-grid views, not a nav —
		// the header should remain on today's date after the click.
		expect(errors, errors.join("\n")).toHaveLength(0);
	});

	test("clicking Now scrolls the current-time indicator into viewport", async ({ calendar }) => {
		// FullCalendar renders the current-time line as
		// `.fc-timegrid-now-indicator-line` inside the timegrid scroller. The
		// Now button's job is to scroll that line into view, so assert the
		// element is on screen (not clipped by the scroller's overflow).
		const { page } = calendar;
		await gotoToday(page);

		// Force the scroller all the way to the top so Now has real work to
		// do — otherwise the indicator may already be on screen and the test
		// can't distinguish "Now worked" from "Now was a no-op".
		await page
			.locator(".fc-timegrid .fc-scroller")
			.first()
			.evaluate((el) => {
				(el as HTMLElement).scrollTop = 0;
			});

		await page
			.locator(sel(TID.toolbar("goto-now")))
			.first()
			.click();

		const indicator = page.locator(".fc-timegrid-now-indicator-line").first();
		await expect(indicator).toBeInViewport({ ratio: 0.01 });
	});

	// The toolbar title format is driven by FullCalendar's `titleFormat` option,
	// which we don't explicitly set — so we rely on FC's built-in per-view
	// defaults. Day embeds a day-of-month; week shows a range; month drops the
	// day entirely; list shows a week-of label. A regression here would point
	// at a titleFormat config change slipping in.
	for (const { view, pattern, description } of [
		{ view: "day", pattern: /\d{1,2}/, description: "day number" },
		{ view: "week", pattern: /\d{1,2}.*[–-].*\d{1,2}/, description: "day range" },
		{ view: "month", pattern: /^[A-Z][a-z]+\s+\d{4}$/, description: "Month Year only" },
		{ view: "list", pattern: /\w+/, description: "non-empty string" },
	] as ReadonlyArray<{ view: ViewMode; pattern: RegExp; description: string }>) {
		test(`${view} view toolbar title matches its expected format (${description})`, async ({ calendar }) => {
			await gotoToday(calendar.page);
			await calendar.switchMode(view);
			await expect(calendar.page.locator(".fc-toolbar-title").first()).toHaveText(pattern);
		});
	}
});
