import { existsSync } from "node:fs";
import { join } from "node:path";

import type { PrismaCalendarMoveEventToCalendarOutput } from "@real1ty-obsidian-plugins/external-apis/prisma-calendar";
import { type Invoker, pageEvaluateInvoker } from "@real1ty-obsidian-plugins/testing/api-contract";

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

// The .d.ts is generated from `api-contract.json` and is type-only — no
// runtime/obsidian footprint. The drift test owns JSON-Schema conformance;
// this spec asserts the load-bearing envelope fields directly.
type MoveResult = PrismaCalendarMoveEventToCalendarOutput;

function assertMoveResultShape(value: unknown): asserts value is MoveResult {
	expect(value, "expected move result envelope").not.toBeNull();
	const r = value as Record<string, unknown>;
	expect(typeof r["success"]).toBe("boolean");
	if (r["movedFilePath"] !== undefined) expect(typeof r["movedFilePath"]).toBe("string");
	if (r["error"] !== undefined) expect(typeof r["error"]).toBe("string");
}

// Tier 1 cross-calendar contract spec. Exercises `moveEventToCalendar` —
// the highest-risk action because it crosses bundle boundaries and the
// concurrent-stores rewrite at `cross-calendar-undo.spec.ts` proved this
// path has historical flake.
//
// What this spec proves:
//   1. `moveEventToCalendar` returns a `PrismaMoveEventToCalendarResult`-shaped
//      envelope (schema-validated).
//   2. After a successful move, the file is physically gone from the source
//      bundle's directory and present in the target bundle's directory.
//   3. The post-move file is reachable via `getEventByPath` under its new
//      path, so the indexer caught up on both bundles.
//
// We use `todayStamp` because no FullCalendar viewport is asserted on —
// the proof is filesystem + API readback, not DOM.

async function waitForApiIndex(invoke: Invoker, filePath: string): Promise<void> {
	await expect.poll(async () => (await invoke("getEventByPath", { filePath })) !== null).toBe(true);
}

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

		const invoke = pageEvaluateInvoker(obsidian.page, "PrismaCalendar");

		// Seed a tracked event in the primary bundle.
		const originalPath = (await invoke("createEvent", {
			title: "Cross Calendar Subject",
			start: todayStamp(10),
			end: todayStamp(11),
			allDay: false,
			calendarId: MULTI_CALENDAR_PRIMARY_ID,
		})) as string;
		expect(typeof originalPath).toBe("string");
		// Sanity: lives under the primary calendar's directory.
		expect(originalPath.startsWith(MULTI_CALENDAR_PRIMARY_DIR)).toBe(true);
		await waitForApiIndex(invoke, originalPath);

		// ── moveEventToCalendar ────────────────────────────────────────
		const moveResultRaw = await invoke("moveEventToCalendar", {
			filePath: originalPath,
			targetCalendarId: MULTI_CALENDAR_SECONDARY_ID,
			calendarId: MULTI_CALENDAR_PRIMARY_ID,
		});

		// Wire-shape proof: the response envelope has the contract fields.
		assertMoveResultShape(moveResultRaw);

		expect(moveResultRaw.success).toBe(true);
		expect(moveResultRaw.error).toBeUndefined();
		expect(moveResultRaw.movedFilePath).toBeDefined();
		const newPath = moveResultRaw.movedFilePath!;

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
		await waitForApiIndex(invoke, newPath);

		try {
			const event = (await invoke("getEventByPath", { filePath: newPath })) as {
				title: string;
				type: string;
			} | null;
			expect(event).not.toBeNull();
			expect(event!.title).toBe("Cross Calendar Subject");
			expect(event!.type).toBe("timed");
		} finally {
			// Clean up the moved file — secondary bundle owns it now.
			const deleted = (await invoke("deleteEvent", {
				filePath: newPath,
				calendarId: MULTI_CALENDAR_SECONDARY_ID,
			})) as boolean;
			expect(deleted).toBe(true);
		}
	});

	test("moveEventToCalendar with unknown targetCalendarId returns success:false envelope, not throw", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		await openCalendarView(calendar.page, MULTI_CALENDAR_PRIMARY_ID);
		const invoke = pageEvaluateInvoker(obsidian.page, "PrismaCalendar");

		const originalPath = (await invoke("createEvent", {
			title: "Unmoved Event",
			start: todayStamp(13),
			end: todayStamp(14),
			allDay: false,
			calendarId: MULTI_CALENDAR_PRIMARY_ID,
		})) as string;
		await waitForApiIndex(invoke, originalPath);

		try {
			const resultRaw = await invoke("moveEventToCalendar", {
				filePath: originalPath,
				targetCalendarId: "does-not-exist",
				calendarId: MULTI_CALENDAR_PRIMARY_ID,
			});

			// Even the failure path must serialise as a valid envelope —
			// callers depend on `{ success, error }` rather than catching.
			assertMoveResultShape(resultRaw);
			expect(resultRaw.success).toBe(false);
			expect(resultRaw.error).toBeTruthy();
			// File should still be at its original path — failure is "no-op",
			// not "partial move."
			expect(existsSync(join(obsidian.vaultDir, originalPath))).toBe(true);
		} finally {
			await invoke("deleteEvent", { filePath: originalPath, calendarId: MULTI_CALENDAR_PRIMARY_ID });
		}
	});
});
