import { expect, test } from "../../fixtures/electron";
import { openCalendarViewViaRibbon, openUntrackedDropdown } from "../../fixtures/helpers";

// The FullCalendar toolbar hosts an "⋮" untracked-events dropdown. Users
// click it to see events that have no start/end date, or to create a new
// untracked event via the inline "+ Create untracked event" button.

test.describe("analytics: untracked events dropdown", () => {
	test("toggle button opens the dropdown with a search input and create button", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await openUntrackedDropdown(obsidian.page);

		// Search input and create button should appear inside the dropdown.
		await expect(obsidian.page.locator('[data-testid="prisma-untracked-search"]').first()).toBeVisible({
			timeout: 5_000,
		});
		await expect(obsidian.page.locator('[data-testid="prisma-untracked-create"]').first()).toBeVisible();
	});

	test("clicking Create opens the untracked-event create modal", async ({ obsidian }) => {
		await openCalendarViewViaRibbon(obsidian.page);
		await openUntrackedDropdown(obsidian.page);

		await obsidian.page.locator('[data-testid="prisma-untracked-create"]').first().click();

		// `openCreateUntrackedEventModal` opens a schema form modal with a dedicated
		// container class — confirm it surfaces on top.
		await expect(obsidian.page.locator(".modal.prisma-untracked-event-modal").first()).toBeVisible({
			timeout: 5_000,
		});

		await obsidian.page.keyboard.press("Escape");
	});
});
