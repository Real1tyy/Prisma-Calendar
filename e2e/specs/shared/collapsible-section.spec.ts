import type { Locator } from "@playwright/test";

import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar, openCalendar } from "../../fixtures/helpers";

// Exercises `renderCollapsibleSection` from shared/src/components/primitives/
// collapsible-section.ts. Prisma consumes it through the stopwatch (rendered
// inside the create-event modal with `startCollapsed: true`), so the testids
// stamped by the shared component — `prisma-collapsible-{section,header,body,
// toggle}-time-tracker` — surface here. Asserts the three user-visible
// behaviours the shared component guarantees: initial collapsed state, click
// on header expands, click again collapses.
//
// Uses the plain "Create event" toolbar button, not
// `Create new event with stopwatch` — the latter auto-calls
// `collapsibleHandle.expand()` on open (see EventCreateModal.onOpen), which
// would invalidate the "starts collapsed" assertion.

const HEADER = '[data-testid="prisma-collapsible-header-time-tracker"]';
const BODY = '[data-testid="prisma-collapsible-body-time-tracker"]';
const TOGGLE = '[data-testid="prisma-collapsible-toggle-time-tracker"]';

async function isHidden(body: Locator): Promise<boolean> {
	const cls = (await body.getAttribute("class")) ?? "";
	return cls.includes("prisma-collapsible-hidden");
}

test.describe("shared: collapsible-section", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendar(obsidian.page);
	});

	test("starts collapsed, expands on header click, collapses on second click", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page);

		const header = obsidian.page.locator(HEADER).first();
		const body = obsidian.page.locator(BODY).first();
		const toggle = obsidian.page.locator(TOGGLE).first();

		await header.waitFor({ state: "visible" });
		expect(await isHidden(body)).toBe(true);
		await expect(toggle).toHaveText("▶");

		await header.click();
		expect(await isHidden(body)).toBe(false);
		await expect(toggle).toHaveText("▼");

		await header.click();
		expect(await isHidden(body)).toBe(true);
		await expect(toggle).toHaveText("▶");
	});
});
