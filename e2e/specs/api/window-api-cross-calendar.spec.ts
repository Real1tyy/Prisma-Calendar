import { existsSync } from "node:fs";
import { join } from "node:path";

import { createPrismaApi, waitForApiIndex } from "../../fixtures/api-helpers";
import { todayStamp } from "../../fixtures/dates";
import {
	MULTI_CALENDAR_PRIMARY_DIR,
	MULTI_CALENDAR_PRIMARY_ID,
	MULTI_CALENDAR_SECONDARY_DIR,
	MULTI_CALENDAR_SECONDARY_ID,
	testMultiCalendar as test,
} from "../../fixtures/electron";
import { openCalendarView, waitForWorkspaceReady } from "../events/events-helpers";

const expect = test.expect;

// Tier 1 cross-calendar contract spec. Exercises `moveEventToCalendar` —
// the highest-risk action because it crosses bundle boundaries and the
// concurrent-stores rewrite at `cross-calendar-undo.spec.ts` proved this
// path has historical flake.
//
// What this spec proves:
//   1. `moveEventToCalendar` returns a `PrismaMoveEventToCalendarResult`-shaped
//      envelope (schema-validated via the generated `PrismaCalendarApi` type).
//   2. After a successful move, the file is physically gone from the source
//      bundle's directory and present in the target bundle's directory.
//   3. The post-move file is reachable via `getEventByPath` under its new
//      path, so the indexer caught up on both bundles.
//
// We use `todayStamp` because no FullCalendar viewport is asserted on —
// the proof is filesystem + API readback, not DOM.

test.describe("plugin api contract — cross-calendar via window.PrismaCalendar", () => {
	test.beforeEach(async ({ calendar }) => {
		await waitForWorkspaceReady(calendar.page);
	});

	test("moveEventToCalendar relocates a primary event to the secondary bundle", async ({ calendar, obsidian }) => {
		// Pro is required: the gateway only exposes the full API surface in Pro.
		await calendar.unlockPro();

		// Activate the primary bundle so subsequent createEvent calls without
		// an explicit `calendarId` fall through to it. We still pass
		// `calendarId: "primary"` explicitly below to keep the spec
		// independent of "last-used bundle" resolution.
		await openCalendarView(calendar.page, MULTI_CALENDAR_PRIMARY_ID);

		const api = createPrismaApi(obsidian.page);

		// Seed a tracked event in the primary bundle.
		const originalPath = (await api.createEvent({
			title: "Cross Calendar Subject",
			start: todayStamp(10),
			end: todayStamp(11),
			allDay: false,
			calendarId: MULTI_CALENDAR_PRIMARY_ID,
		}))!;
		// Sanity: lives under the primary calendar's directory.
		expect(originalPath.startsWith(MULTI_CALENDAR_PRIMARY_DIR)).toBe(true);
		await waitForApiIndex(api, originalPath);

		// ── moveEventToCalendar ────────────────────────────────────────
		const moveResult = await api.moveEventToCalendar({
			filePath: originalPath,
			targetCalendarId: MULTI_CALENDAR_SECONDARY_ID,
			calendarId: MULTI_CALENDAR_PRIMARY_ID,
		});

		// Envelope shape is type-checked by the generated PrismaCalendarApi.
		expect(moveResult.success).toBe(true);
		expect(moveResult.error).toBeUndefined();
		expect(moveResult.movedFilePath).toBeDefined();
		const newPath = moveResult.movedFilePath!;

		// New path must live under the secondary calendar's directory.
		expect(newPath.startsWith(MULTI_CALENDAR_SECONDARY_DIR)).toBe(true);

		// ── Disk cross-check ───────────────────────────────────────────
		// The old file is gone, the new file exists. Filesystem state is the
		// authoritative truth for "did the move happen" — the API claim is
		// only credible if disk matches.
		expect(existsSync(join(obsidian.vaultDir, originalPath))).toBe(false);
		expect(existsSync(join(obsidian.vaultDir, newPath))).toBe(true);

		// ── Indexer cross-check ────────────────────────────────────────
		// `getEventByPath(newPath)` must resolve through the secondary bundle's
		// indexer. Polling proves the post-move re-index actually fired.
		await waitForApiIndex(api, newPath);

		try {
			const event = await api.getEventByPath({ filePath: newPath });
			expect(event).not.toBeNull();
			expect(event!.title).toBe("Cross Calendar Subject");
			expect(event!.type).toBe("timed");
		} finally {
			// Clean up the moved file — secondary bundle owns it now.
			expect(
				await api.deleteEvent({
					filePath: newPath,
					calendarId: MULTI_CALENDAR_SECONDARY_ID,
				})
			).toBe(true);
		}
	});

	test("moveEventToCalendar with unknown targetCalendarId returns success:false envelope, not throw", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		await openCalendarView(calendar.page, MULTI_CALENDAR_PRIMARY_ID);
		const api = createPrismaApi(obsidian.page);

		const originalPath = (await api.createEvent({
			title: "Unmoved Event",
			start: todayStamp(13),
			end: todayStamp(14),
			allDay: false,
			calendarId: MULTI_CALENDAR_PRIMARY_ID,
		}))!;
		await waitForApiIndex(api, originalPath);

		try {
			const result = await api.moveEventToCalendar({
				filePath: originalPath,
				targetCalendarId: "does-not-exist",
				calendarId: MULTI_CALENDAR_PRIMARY_ID,
			});

			// Even the failure path must serialise as a valid envelope —
			// callers depend on `{ success, error }` rather than catching.
			expect(result.success).toBe(false);
			expect(result.error).toBeTruthy();
			// File should still be at its original path — failure is "no-op",
			// not "partial move."
			expect(existsSync(join(obsidian.vaultDir, originalPath))).toBe(true);
		} finally {
			await api.deleteEvent({ filePath: originalPath, calendarId: MULTI_CALENDAR_PRIMARY_ID });
		}
	});
});
