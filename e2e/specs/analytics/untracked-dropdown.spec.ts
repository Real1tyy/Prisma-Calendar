import { expect, test } from "../../fixtures/electron";
import { sel } from "../../fixtures/testids";

// The FullCalendar toolbar hosts an "⋮" untracked-events dropdown. Users
// click it to see events that have no start/end date, or to create a new
// untracked event via the inline "+ Create untracked event" button.

test.describe("analytics: untracked events dropdown", () => {
	test("toggle button opens the dropdown with a search input and create button", async ({ calendar }) => {
		await calendar.openUntrackedDropdown();

		// Search input and create button should appear inside the dropdown.
		await expect(calendar.page.locator(sel("prisma-untracked-search")).first()).toBeVisible();
		await expect(calendar.page.locator(sel("prisma-untracked-create")).first()).toBeVisible();
	});

	test("clicking Create opens the untracked-event create modal", async ({ calendar }) => {
		await calendar.openUntrackedDropdown();

		await calendar.page.locator(sel("prisma-untracked-create")).first().click();

		// `openCreateUntrackedEventModal` opens a schema form modal with a dedicated
		// container class — confirm it surfaces on top.
		await expect(calendar.page.locator(".modal.prisma-untracked-event-modal").first()).toBeVisible();

		await calendar.page.keyboard.press("Escape");
	});
});
