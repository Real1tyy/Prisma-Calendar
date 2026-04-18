import { collapsibleSection } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { createEventViaToolbar } from "../../fixtures/helpers";

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

test.describe("shared: collapsible-section", () => {
	test("starts collapsed, expands on header click, collapses on second click", async ({ calendar }) => {
		await createEventViaToolbar(calendar.page);

		const section = collapsibleSection(calendar.page, "time-tracker");
		await section.header.waitFor({ state: "visible" });
		await section.expectExpanded(false);
		await expect(section.toggle).toHaveText("▶");

		await section.header.click();
		await section.expectExpanded(true);
		await expect(section.toggle).toHaveText("▼");

		await section.header.click();
		await section.expectExpanded(false);
		await expect(section.toggle).toHaveText("▶");
	});
});
