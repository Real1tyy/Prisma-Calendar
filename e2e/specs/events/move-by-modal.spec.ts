import { expect } from "@playwright/test";

import { anchorDayISO, fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { expectNoticeText, startsWithStamp } from "../../fixtures/helpers";
import {
	FORM_SUBMIT_TID,
	MOVE_BY_DECREMENT_TID,
	MOVE_BY_INCREMENT_TID,
	MOVE_BY_MODAL_TID,
	MOVE_BY_TOGGLE_SIGN_TID,
	MOVE_BY_VALUE_TID,
	moveByUnit,
	sel,
} from "../../fixtures/testids";

// The Move-by modal (`prisma-modal-move-by`) is reached via right-click →
// "Move by..." on timed events and via the batch toolbar for selections.
// Its DSL — sign toggle, +/− stepper, unit chips — has no spec, and the
// disallowed-unit Notice for all-day events is also untested.
//
// This spec verifies:
//   1. The modal opens via the calendar tile context menu and renders all
//      seven unit chips + the +/− toggle + the numeric input.
//   2. Picking a positive value + unit, submitting, shifts the event's
//      start AND end by the right offset on disk.
//   3. The sign toggle flips the value to negative, and the resulting
//      submit shifts the event backwards.
//   4. All-day events surface the disallowed-unit Notice rather than
//      mutating frontmatter when minutes/hours are picked.

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

		// All seven unit chips are stamped — `years` is the last one.
		await expect(modal.locator(sel(moveByUnit("minutes")))).toBeVisible();
		await expect(modal.locator(sel(moveByUnit("years")))).toBeVisible();

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

	test("toggle-sign flips the value and submitting shifts the event backwards", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const startInitial = fromAnchor(0, 14, 0);
		const endInitial = fromAnchor(0, 15, 0);
		const [evt] = await calendar.seedMany([{ title: "MoveBy Negative", start: startInitial, end: endInitial }]);

		await evt.rightClick("moveBy");
		const modal = page.locator(sel(MOVE_BY_MODAL_TID)).first();
		await expect(modal).toBeVisible();

		const input = modal.locator(sel(MOVE_BY_VALUE_TID));
		await input.fill("1");
		await modal.locator(sel(moveByUnit("hours"))).click();
		await modal.locator(sel(MOVE_BY_TOGGLE_SIGN_TID)).click();
		await expect(input).toHaveValue("-1");

		await modal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(modal).toBeHidden();

		await evt.expectFrontmatter("Start Date", startsWithStamp(addHours(startInitial, -1)));
		await evt.expectFrontmatter("End Date", startsWithStamp(addHours(endInitial, -1)));
	});

	test("picking hours for an all-day event fires a Notice and leaves frontmatter untouched", async ({ calendar }) => {
		const page = calendar.page;
		await calendar.switchMode("month");
		await calendar.goToAnchor();

		const dateInitial = anchorDayISO(0);
		const [evt] = await calendar.seedMany([{ title: "MoveBy AllDay", allDay: true, date: dateInitial }]);

		await evt.rightClick("moveBy");
		const modal = page.locator(sel(MOVE_BY_MODAL_TID)).first();
		await expect(modal).toBeVisible();
		await modal.locator(sel(MOVE_BY_VALUE_TID)).fill("3");
		await modal.locator(sel(moveByUnit("hours"))).click();
		await modal.locator(sel(FORM_SUBMIT_TID)).click();
		await expect(modal).toBeHidden();

		// Disk untouched — hours is rejected for all-day, error surfaced as
		// `new Notice("Cannot move all-day event by hours...")`. The Date
		// property is the all-day's primary date field — must remain unchanged.
		await evt.expectFrontmatter("Date", startsWithStamp(dateInitial));

		// Validation copy is the one production renders.
		await expectNoticeText(page, "Cannot move all-day event by hours");
	});
});
