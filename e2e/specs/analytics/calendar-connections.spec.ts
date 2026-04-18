import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { assignPrerequisiteViaUI } from "../../fixtures/helpers";
import { sel } from "../../fixtures/testids";

// Prerequisite connections are a Pro feature. The calendar view draws SVG
// arrows between dependent/prerequisite events via `ConnectionRenderer`:
// full cubic arrows when both sides are in-frame, dashed stubs when one
// side is off-screen. This spec proves both flows end-to-end: same-week
// (full arrow) and cross-week (stub arrow, because the prereq lives in a
// different week than the dependant).
//
// Seeds use `fromAnchor(...)` (past-Wednesday anchor) + `calendar.goToAnchor()`
// so the rendered week always contains the Upstream/Downstream pair regardless
// of what day-of-week the suite runs on — see
// `docs/specs/e2e-date-anchor-robustness.md`.

const ARROW = sel("prisma-connection-arrow");
const STUB = `${sel("prisma-connection-arrow")}[data-arrow-stub="true"]`;

test.describe("analytics: prerequisite connections on calendar view", () => {
	test("full arrow renders when both events sit in the same week", async ({ calendar }) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		await calendar.seedMany([
			{ title: "Upstream Task", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Downstream Task", start: fromAnchor(1, 14, 0), end: fromAnchor(1, 15, 0) },
		]);

		await assignPrerequisiteViaUI(calendar.page, "Downstream Task", "Upstream Task");

		await calendar.unlockPro();
		await calendar.clickToolbar("toggle-prerequisites");

		await expect(calendar.page.locator(ARROW)).toHaveCount(1);
		await expect(calendar.page.locator(STUB)).toHaveCount(0);
	});

	test("stub arrow renders when prerequisite lives in a different week", async ({ calendar }) => {
		// Month view first so both tiles are clickable while wiring the prereq.
		await calendar.switchMode("month");
		await calendar.goToAnchor();
		await calendar.seedMany([
			{ title: "Upstream Task", start: fromAnchor(0, 9, 0), end: fromAnchor(0, 10, 0) },
			{ title: "Downstream Task", start: fromAnchor(10, 14, 0), end: fromAnchor(10, 15, 0) },
		]);

		await assignPrerequisiteViaUI(calendar.page, "Downstream Task", "Upstream Task");

		// Back to week view anchored on the upstream — with 10 days between the
		// two events, at most one is visible at a time, so the renderer must
		// draw a dashed stub.
		await calendar.switchMode("week");
		await calendar.goToAnchor();
		await calendar.unlockPro();
		await calendar.clickToolbar("toggle-prerequisites");

		await expect(calendar.page.locator(STUB)).toHaveCount(1);
	});
});
