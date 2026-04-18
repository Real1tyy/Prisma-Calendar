import type { Page } from "@playwright/test";
import { listEventFiles } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { isoLocal } from "../../fixtures/dates";
import {
	expect,
	MULTI_CALENDAR_PRIMARY_DIR,
	MULTI_CALENDAR_PRIMARY_ID,
	MULTI_CALENDAR_SECONDARY_DIR,
	MULTI_CALENDAR_SECONDARY_ID,
	testMultiCalendar as test,
} from "../../fixtures/electron";
import { openCalendarView, waitForWorkspaceReady } from "../events/events-helpers";

// Every calendar directory contains a `Virtual Events.md` sentinel created on
// bundle init by `VirtualEventStore` (`createIfMissing: true`). That file is
// not an "event" for these tests — filter it out so counts reflect the real,
// user-authored events only.
const VIRTUAL_EVENTS_SUFFIX = "/Virtual Events.md";

function countRealEvents(vaultDir: string, subdir: string): number {
	return listEventFiles(vaultDir, subdir).filter((p) => !p.endsWith(VIRTUAL_EVENTS_SUFFIX)).length;
}

// `activateCalendarView` fires `void rememberLastUsedCalendar(id)` — its
// in-memory update is synchronous, but async `saveData()` schedules a
// disk write. `resolveBundle` (used by the palette Undo command) reads
// `syncStore.data.lastUsedCalendarId`, so we poll the in-memory value to
// make sure the activation actually took effect before exercising undo.
async function ensureLastUsedCalendar(page: Page, calendarId: string): Promise<void> {
	await page.waitForFunction(
		({ id, pid }) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<string, { syncStore?: { data?: { lastUsedCalendarId?: string } } }>;
					};
				};
			};
			return w.app.plugins.plugins[pid]?.syncStore?.data?.lastUsedCalendarId === id;
		},
		{ id: calendarId, pid: PLUGIN_ID }
	);
}

// Two calendars seeded side-by-side → one CommandManager each, one undo stack
// each. These specs guard three product-level promises:
//
//   1. Each bundle owns its own stack (a create in primary does not land on
//      secondary's redo stack, and vice versa).
//   2. The palette "Undo" / "Redo" commands route to the *last-used* bundle —
//      the bundle whose view was most recently activated (see
//      `bundle-resolver.ts`). Switching calendars by activating the other
//      view is how a real user changes the route.
//   3. Activating a different calendar never clears the previous bundle's
//      stack — switching back and undoing must still reverse the earlier op.
//
// If any of these break, the symptom in prod is "my undo didn't undo the
// right thing" — the worst class of history bug.

async function switchToCalendar(page: Page, calendarId: string): Promise<void> {
	await openCalendarView(page, calendarId);
	await ensureLastUsedCalendar(page, calendarId);
}

test.describe("cross-calendar undo boundary (UI-driven)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await waitForWorkspaceReady(obsidian.page);
	});

	test("undo routes to last-used bundle; each stack stays isolated", async ({ calendar }) => {
		await switchToCalendar(calendar.page, MULTI_CALENDAR_PRIMARY_ID);
		const primary = await calendar.createEvent(
			{ title: "Primary Probe", start: isoLocal(1, 9), end: isoLocal(1, 10) },
			{ subdir: MULTI_CALENDAR_PRIMARY_DIR }
		);
		expect(primary.path.startsWith(MULTI_CALENDAR_PRIMARY_DIR)).toBe(true);

		await switchToCalendar(calendar.page, MULTI_CALENDAR_SECONDARY_ID);
		const secondary = await calendar.createEvent(
			{ title: "Secondary Probe", start: isoLocal(1, 11), end: isoLocal(1, 12) },
			{ subdir: MULTI_CALENDAR_SECONDARY_DIR }
		);
		expect(secondary.path.startsWith(MULTI_CALENDAR_SECONDARY_DIR)).toBe(true);

		// Secondary was most recently activated, so Undo must pop *its* stack.
		// Primary's file must stay on disk.
		await calendar.undo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(0);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);

		// A second Undo with secondary still "active" is a no-op — its stack is
		// empty, and primary's stack must not be touched.
		await calendar.undo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);

		// Switching to primary re-routes Undo to its stack.
		await switchToCalendar(calendar.page, MULTI_CALENDAR_PRIMARY_ID);
		await calendar.undo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(0);
	});

	test("redo targets the activated bundle's stack, not the other calendar's", async ({ calendar }) => {
		await switchToCalendar(calendar.page, MULTI_CALENDAR_PRIMARY_ID);
		await calendar.createEvent(
			{ title: "Primary Redo Probe", start: isoLocal(1, 9), end: isoLocal(1, 10) },
			{ subdir: MULTI_CALENDAR_PRIMARY_DIR }
		);
		await switchToCalendar(calendar.page, MULTI_CALENDAR_SECONDARY_ID);
		await calendar.createEvent(
			{ title: "Secondary Redo Probe", start: isoLocal(1, 11), end: isoLocal(1, 12) },
			{ subdir: MULTI_CALENDAR_SECONDARY_DIR }
		);

		// Undo on secondary (last-used) → secondary's create is now on its redo
		// stack. Switch to primary *without* undoing, then redo — primary's redo
		// stack is empty, so the secondary file must NOT reappear.
		await calendar.undo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(0);

		await switchToCalendar(calendar.page, MULTI_CALENDAR_PRIMARY_ID);
		await calendar.redo();
		// Primary's redo stack was never built → secondary's undone create must
		// still be absent on disk.
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(0);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);

		// Switch back to secondary and redo — now the secondary create should
		// be reinstated because the stack was preserved across the switch.
		await switchToCalendar(calendar.page, MULTI_CALENDAR_SECONDARY_ID);
		await calendar.redo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(1);
	});
});
