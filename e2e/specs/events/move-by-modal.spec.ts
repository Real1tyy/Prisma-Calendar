import { expect } from "@playwright/test";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { startsWithStamp } from "../../fixtures/helpers";
import {
	FORM_SUBMIT_TID,
	MOVE_BY_DECREMENT_TID,
	MOVE_BY_INCREMENT_TID,
	MOVE_BY_MODAL_TID,
	MOVE_BY_VALUE_TID,
	moveByUnit,
	sel,
} from "../../fixtures/testids";

// E2E-only assertion: positive Move-by → submit → on-disk Start/End shift.
// In-modal mechanics (unit chips, +/- stepper, toggle-sign, onSubmit payload
// shape) are covered by RTL at tests/components/modals/move-by-modal.test.tsx.
// All-day-disallowed-unit rejection is a pure-function concern covered by
// tests/types/calendar.test.ts (isTimeUnitAllowedForAllDay).

function addHours(stamp: string, hours: number): string {
	const [datePart, timePart] = stamp.split("T");
	if (!datePart || !timePart) throw new Error(`addHours: invalid stamp ${stamp}`);
	const [hStr, mStr] = timePart.split(":");
	const baseHour = Number.parseInt(hStr ?? "0", 10);
	const minute = Number.parseInt(mStr ?? "0", 10);
	const targetHour = baseHour + hours;
	if (targetHour < 0 || targetHour > 23) throw new Error(`addHours: out-of-range hour ${targetHour}`);
	return `${datePart}T${String(targetHour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

test.describe("events: Move-by modal end-to-end", () => {
	test("Move by +2 hours via the modal stepper shifts Start/End in frontmatter", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const startInitial = fromAnchor(0, 9, 0);
		const endInitial = fromAnchor(0, 10, 0);
		const [evt] = await calendar.seedMany([{ title: "MoveBy Subject", start: startInitial, end: endInitial }]);

		await evt.rightClick("moveBy");

		const modal = page.locator(sel(MOVE_BY_MODAL_TID)).first();
		await expect(modal).toBeVisible();

		const input = modal.locator(sel(MOVE_BY_VALUE_TID));
		// Default value is 15 — clear and type 2, then pick "hours".
		await input.fill("2");
		await modal.locator(sel(moveByUnit("hours"))).click();
		// Stepper assertion: pressing + raises to 3, pressing - returns to 2.
		await modal.locator(sel(MOVE_BY_INCREMENT_TID)).click();
		await expect(input).toHaveValue("3");
		await modal.locator(sel(MOVE_BY_DECREMENT_TID)).click();
		await expect(input).toHaveValue("2");

		await modal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(modal).toBeHidden();

		await evt.expectFrontmatter("Start Date", startsWithStamp(addHours(startInitial, 2)));
		await evt.expectFrontmatter("End Date", startsWithStamp(addHours(endInitial, 2)));
	});
});
