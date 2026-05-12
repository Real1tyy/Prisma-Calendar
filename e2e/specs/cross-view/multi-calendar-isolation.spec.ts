import { expect } from "@playwright/test";

import { todayStamp } from "../../fixtures/dates";
import {
	MULTI_CALENDAR_PRIMARY_DIR,
	MULTI_CALENDAR_PRIMARY_ID,
	MULTI_CALENDAR_SECONDARY_DIR,
	MULTI_CALENDAR_SECONDARY_ID,
	testMultiCalendar as test,
} from "../../fixtures/electron";
import { openCalendarView, waitForWorkspaceReady } from "../events/events-helpers";

// `cross-calendar-undo.spec.ts` proves the undo stack is isolated per
// bundle, and `multi-calendar-lifecycle.spec.ts` exercises CRUD on each
// bundle. Neither asserts that mutations issued against calendar A leave
// calendar B's event store untouched. A regression in the subscriber
// wiring (cross-bundle event-store fan-out) would surface as calendar B's
// store picking up A's events.
//
// This spec keeps the assertion on the runtime event-store contract
// rather than view-tab DOM scanning — view-tabs are stamped per-leaf so
// `page.locator(...).first()` is ambiguous in multi-leaf workspaces. The
// store-level probe directly proves the RxJS isolation contract.

test.describe("cross-view: multi-calendar isolation under reactive mutations", () => {
	test.beforeEach(async ({ calendar }) => {
		await waitForWorkspaceReady(calendar.page);
	});

	test("mutations in calendar A do not bleed into calendar B's event store", async ({ calendar }) => {
		const page = calendar.page;

		// Activate the primary leaf and seed events only into its directory.
		await openCalendarView(page, MULTI_CALENDAR_PRIMARY_ID);
		const [keep, drop] = await Promise.all([
			calendar.createEvent(
				{ title: "Primary Reactive Keep", start: todayStamp(9, 0), end: todayStamp(10, 0) },
				{ subdir: MULTI_CALENDAR_PRIMARY_DIR }
			),
			calendar.createEvent(
				{ title: "Primary Reactive Drop", start: todayStamp(11, 0), end: todayStamp(12, 0) },
				{ subdir: MULTI_CALENDAR_PRIMARY_DIR }
			),
		]);
		expect(keep.path.startsWith(MULTI_CALENDAR_PRIMARY_DIR)).toBe(true);
		expect(drop.path.startsWith(MULTI_CALENDAR_PRIMARY_DIR)).toBe(true);

		// Open the secondary leaf so its bundle is active and subscribers are
		// mounted. No view-switch is needed — the per-bundle event store is
		// what proves isolation.
		await openCalendarView(page, MULTI_CALENDAR_SECONDARY_ID);

		await expect
			.poll(() => calendar.readPerBundleEventStores())
			.toMatchObject({
				primary: { count: 2 },
				secondary: { count: 0 },
			});

		// Delete one of primary's events through its calendar tile context menu.
		await openCalendarView(page, MULTI_CALENDAR_PRIMARY_ID);
		await calendar.switchView("calendar");
		const dropHandle = await calendar.eventByTitle("Primary Reactive Drop");
		await dropHandle.rightClick("deleteEvent");
		await dropHandle.expectExists(false);

		await expect
			.poll(() => calendar.readPerBundleEventStores())
			.toMatchObject({
				primary: { count: 1 },
				secondary: { count: 0 },
			});

		// Symmetric proof: seed only into secondary now and verify primary's
		// store doesn't pick it up.
		await openCalendarView(page, MULTI_CALENDAR_SECONDARY_ID);
		const secondaryEvent = await calendar.createEvent(
			{ title: "Secondary Reactive Only", start: todayStamp(13, 0), end: todayStamp(14, 0) },
			{ subdir: MULTI_CALENDAR_SECONDARY_DIR }
		);
		expect(secondaryEvent.path.startsWith(MULTI_CALENDAR_SECONDARY_DIR)).toBe(true);

		await expect
			.poll(() => calendar.readPerBundleEventStores())
			.toMatchObject({
				primary: { count: 1 },
				secondary: { count: 1 },
			});

		const finalProbe = await calendar.readPerBundleEventStores();
		expect(finalProbe.primary?.titles).not.toContain("Secondary Reactive Only");
		expect(finalProbe.secondary?.titles).not.toContain("Primary Reactive Keep");
	});
});
