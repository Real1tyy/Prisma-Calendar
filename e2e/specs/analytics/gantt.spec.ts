import { isoLocal } from "../../fixtures/dates";
import { type CalendarHandle } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { assignPrerequisiteViaUI, ganttBarLocator, rightClickGanttBar } from "../../fixtures/helpers";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";

// Gantt filters events to only those connected in the prerequisite graph
// (`normalize-events.ts`: `tracker.isConnected(filePath)`), so standalone
// events never produce bars. This suite seeds two connected events via
// real-UI context-menu wiring whenever it needs visible bars. The rest of
// the cases drive the renderer's chrome directly (nav buttons, search,
// presets) against an unlocked-Pro, empty Gantt.
//
// Filter inputs (`prisma-filter-search`, `-preset`, `-expression`) are
// shared between the calendar view's input-managers and gantt's own
// view-filter-bar, so both render into the same leaf when tabs swap.
// Every filter locator is scoped under `.prisma-gantt-wrapper` to avoid
// `.first()` landing on the hidden calendar-view copy.
//
// Pro-locked gating for Gantt is covered in pro-gates.spec.ts — this file
// always unlocks Pro before switching to the tab.

const GANTT_SCOPE = ".prisma-gantt-wrapper";

async function openGantt(calendar: CalendarHandle): Promise<void> {
	await calendar.unlockPro();
	await calendar.switchView("gantt");
	await expect(calendar.page.locator(sel("prisma-gantt-create")).first()).toBeVisible();
}

async function setupTwoConnectedEvents(calendar: CalendarHandle): Promise<void> {
	await calendar.switchMode("month");

	await calendar.seedMany([
		{ title: "Upstream Task", start: isoLocal(0, 9, 0), end: isoLocal(0, 10, 0) },
		{ title: "Downstream Task", start: isoLocal(10, 14, 0), end: isoLocal(10, 15, 0) },
	]);

	await assignPrerequisiteViaUI(calendar.page, "Downstream Task", "Upstream Task");
	await calendar.waitForNoticesClear();

	await calendar.unlockPro();
	await calendar.switchView("gantt");
}

test.describe("analytics: gantt", () => {
	test("renders toolbar chrome (create, nav, filter bar) when Pro is unlocked", async ({ calendar }) => {
		await openGantt(calendar);

		await expect(calendar.page.locator(sel("prisma-pro-gate-GANTT"))).toHaveCount(0);

		const nav = calendar.page.locator(".prisma-gantt-nav");
		await expect(nav.locator('button[aria-label="Back 1 month"]')).toBeVisible();
		await expect(nav.locator('button[aria-label="Back 1 week"]')).toBeVisible();
		await expect(nav.locator(".prisma-gantt-today-btn")).toBeVisible();
		await expect(nav.locator('button[aria-label="Forward 1 week"]')).toBeVisible();
		await expect(nav.locator('button[aria-label="Forward 1 month"]')).toBeVisible();

		await expect(calendar.page.locator(`${GANTT_SCOPE} ${sel("prisma-filter-search")}`)).toBeVisible();
		await expect(calendar.page.locator(`${GANTT_SCOPE} ${sel("prisma-filter-preset")}`)).toBeVisible();
		await expect(calendar.page.locator(`${GANTT_SCOPE} ${sel("prisma-filter-expression")}`)).toBeVisible();
	});

	test("Create button opens the event create modal", async ({ calendar }) => {
		await openGantt(calendar);

		await calendar.page.locator(sel("prisma-gantt-create")).first().click();

		const titleInput = calendar.page.locator(`.modal ${sel(TID.event.control("title"))}`).first();
		await expect(titleInput).toBeVisible();
		await expect(titleInput).toHaveValue("");

		await calendar.page
			.locator(`.modal ${sel(TID.event.btn("cancel"))}`)
			.first()
			.click();
	});

	test("nav buttons shift the viewport; Today returns to the current month", async ({ calendar }) => {
		await openGantt(calendar);

		const nav = calendar.page.locator(".prisma-gantt-nav");
		const firstMonth = calendar.page.locator(".prisma-gantt-month-label").first();

		const todayLabel = (await firstMonth.innerText()).trim();

		await nav.locator('button[aria-label="Forward 1 month"]').click();
		await expect(firstMonth).not.toHaveText(todayLabel);

		await nav.locator(".prisma-gantt-today-btn").click();
		await expect(firstMonth).toHaveText(todayLabel);

		await nav.locator('button[aria-label="Back 1 month"]').click();
		await expect(firstMonth).not.toHaveText(todayLabel);

		await nav.locator('button[aria-label="Forward 1 month"]').click();
		await expect(firstMonth).toHaveText(todayLabel);

		// Weekly nav is a no-op on the month label when today sits mid-month,
		// so we only assert the buttons click without throwing. A round trip
		// forward+back leaves the viewport exactly where it started.
		await nav.locator('button[aria-label="Forward 1 week"]').click();
		await nav.locator('button[aria-label="Back 1 week"]').click();
		await expect(firstMonth).toHaveText(todayLabel);
	});

	test("prerequisite arrow renders between two connected events", async ({ calendar }) => {
		await setupTwoConnectedEvents(calendar);

		await expect(ganttBarLocator(calendar.page, "Upstream Task")).toBeVisible();
		await expect(ganttBarLocator(calendar.page, "Downstream Task")).toBeVisible();

		await expect(calendar.page.locator(sel("prisma-gantt-bar"))).toHaveCount(2);
		await expect(calendar.page.locator(sel("prisma-gantt-arrow"))).toHaveCount(1);
	});

	test("right-clicking a bar opens the shared context menu; 'edit' opens the edit modal", async ({ calendar }) => {
		await setupTwoConnectedEvents(calendar);

		await rightClickGanttBar(calendar.page, "Upstream Task");
		await calendar.page.locator(".menu").first().waitFor({ state: "visible" });

		// Gantt bar menu uses bare `edit` — calendar-tile menu uses `editEvent`.
		// `edit` isn't in ContextMenuItemKey so click by raw testid.
		await calendar.page.locator(sel("prisma-context-menu-item-edit")).first().click();

		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Upstream Task");

		await calendar.page
			.locator(sel(TID.event.btn("cancel")))
			.first()
			.click();
	});

	test("search input filters bars; arrow disappears when one endpoint is hidden", async ({ calendar }) => {
		await setupTwoConnectedEvents(calendar);

		await expect(calendar.page.locator(sel("prisma-gantt-bar"))).toHaveCount(2);
		await expect(calendar.page.locator(sel("prisma-gantt-arrow"))).toHaveCount(1);

		const search = calendar.page.locator(`${GANTT_SCOPE} ${sel("prisma-filter-search")}`);
		await search.fill("Upstream");
		await search.press("Enter");

		// Only Upstream survives — Downstream is filtered out, so the arrow's
		// target endpoint is gone and the arrow isn't laid out at all.
		await expect(calendar.page.locator(sel("prisma-gantt-bar"))).toHaveCount(1);
		await expect(ganttBarLocator(calendar.page, "Upstream Task")).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-gantt-arrow"))).toHaveCount(0);

		await search.fill("");
		await search.press("Enter");
		await expect(calendar.page.locator(sel("prisma-gantt-bar"))).toHaveCount(2);
		await expect(calendar.page.locator(sel("prisma-gantt-arrow"))).toHaveCount(1);
	});

	test("filter preset dropdown populates and clears the expression input", async ({ calendar }) => {
		await updateCalendarSettings(calendar.page, {
			filterPresets: [
				{ name: "Work only", expression: "Category === 'Work'" },
				{ name: "Fitness", expression: "Category === 'Fitness'" },
			],
		});

		await openGantt(calendar);

		const presetSelect = calendar.page.locator(`${GANTT_SCOPE} ${sel("prisma-filter-preset")}`);
		const expressionInput = calendar.page.locator(`${GANTT_SCOPE} ${sel("prisma-filter-expression")}`);

		await expect(presetSelect.locator("option")).toContainText(["Clear", "Work only", "Fitness"]);
		await expect(expressionInput).toHaveValue("");

		await presetSelect.selectOption({ label: "Work only" });
		await expect(expressionInput).toHaveValue("Category === 'Work'");

		await presetSelect.selectOption({ label: "Fitness" });
		await expect(expressionInput).toHaveValue("Category === 'Fitness'");

		await presetSelect.selectOption({ label: "Clear" });
		await expect(expressionInput).toHaveValue("");
	});
});
