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
import type { PrismaPlugin, PrismaWindow } from "../../fixtures/window-types";
import { openCalendarView, waitForWorkspaceReady } from "../events/events-helpers";

// Every calendar directory contains a `Virtual Events.md` sentinel created on
// bundle init by `VirtualEventStore` (`createIfMissing: true`). That file is
// not an "event" for these tests — filter it out so counts reflect the real,
// user-authored events only.
const VIRTUAL_EVENTS_SUFFIX = "/Virtual Events.md";

function countRealEvents(vaultDir: string, subdir: string): number {
	return listEventFiles(vaultDir, subdir).filter((p) => !p.endsWith(VIRTUAL_EVENTS_SUFFIX)).length;
}

// `activateCalendarView` fires `rememberLastUsedCalendar(id)` — a synchronous
// write through `LocalKV` to `window.localStorage`. Event creation routes to
// `plugin.lastUsedCalendarId`, so we poll the value to make sure the activation
// actually took effect before creating an event in the intended calendar.
async function ensureLastUsedCalendar(page: Page, calendarId: string): Promise<void> {
	await page.waitForFunction(
		({ id, pid }) => {
			const w = window as unknown as PrismaWindow;
			const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
			return plugin?.lastUsedCalendarId === id;
		},
		{ id: calendarId, pid: PLUGIN_ID }
	);
}

// Two calendars seeded side-by-side share one monotonic command sequencer, so
// each bundle's CommandManager stamps a globally-comparable `lastActivityOrder`
// on every history mutation (execute / undo / redo). `resolveHistoryBundle`
// (src/core/api/read-operations.ts) routes the palette Undo / Redo to the bundle
// whose stack was mutated most recently — NOT whichever calendar view is active.
// That design exists so moving an event between planning systems (which records
// the command on the SOURCE calendar but flips the active calendar to the
// destination) still undoes against the right stack.
//
// These specs guard three product-level promises of that contract:
//
//   1. Undo/redo follow the most-recently-mutated stack across calendars: the
//      newest activity wins, and when the active calendar's stack runs dry the
//      next-most-recent stack (on the other calendar) is drained — undo is never
//      a silent no-op while *some* calendar still has history.
//   2. Redo ignores which view is active and targets the bundle that actually
//      holds a redo entry.
//   3. Activating a different calendar never clears the other bundle's stack —
//      a redo entry survives a view switch.
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

	test("undo/redo follow the most-recently-mutated stack across calendars", async ({ calendar }) => {
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

		// Secondary's create is the newest activity, so the first Undo pops *its*
		// stack and leaves primary untouched.
		await calendar.undo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(0);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);

		// Secondary's stack is now empty. A second Undo is NOT a no-op — routing
		// falls through to the next-most-recent stack, which is primary's create.
		await calendar.undo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(0);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(0);

		// Both undos pushed onto their redo stacks; primary was undone last, so its
		// redo entry is the most recent — Redo reinstates primary first...
		await calendar.redo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(0);

		// ...and the next Redo reinstates secondary.
		await calendar.redo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(1);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);
	});

	test("redo targets the bundle holding the redo entry, regardless of active view", async ({ calendar }) => {
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

		// Undo on secondary (newest activity) → secondary's create moves onto its
		// redo stack; secondary's file is gone, primary's stays.
		await calendar.undo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(0);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);

		// Activate primary WITHOUT undoing anything — primary has no redo entry.
		// Redo routing follows the redo stack, not the active view, so secondary's
		// undone create is reinstated and the switch did not clear it.
		await switchToCalendar(calendar.page, MULTI_CALENDAR_PRIMARY_ID);
		await calendar.redo();
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_SECONDARY_DIR)).toBe(1);
		await expect.poll(() => countRealEvents(calendar.vaultDir, MULTI_CALENDAR_PRIMARY_DIR)).toBe(1);
	});
});
