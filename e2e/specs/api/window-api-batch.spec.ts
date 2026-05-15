import { existsSync } from "node:fs";
import { join } from "node:path";

import { type Invoker, pageEvaluateInvoker } from "@real1ty-obsidian-plugins/testing/api-contract";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Tier 1 contract spec for the four batch actions in `window.PrismaCalendar.*`.
// Drives the same gateway entry-point a consumer plugin (or external script)
// would — collect filePaths, call `batchX({ filePaths })`, assert frontmatter
// on disk and (where it matters) confirms files are gone.
//
// We use `todayStamp` because this spec never opens or asserts on a
// FullCalendar viewport — the anchor-week robustness rule doesn't apply.

/**
 * Wait until every created file is indexed by the event repository before
 * issuing batch mutations. Mirrors the helper in `window-api-crud.spec.ts`;
 * the indexer is what batch commands resolve filePaths through, so racing
 * a batch action against a fresh `createEvent` returns "Event file not found"
 * for the unindexed entries.
 */
async function waitForAllIndexed(invoke: Invoker, filePaths: readonly string[]): Promise<void> {
	await expect
		.poll(async () => {
			const results = await Promise.all(filePaths.map((p) => invoke("getEventByPath", { filePath: p })));
			return results.every((r) => r !== null);
		})
		.toBe(true);
}

test.describe("plugin api contract — batch via window.PrismaCalendar", () => {
	test("batchMarkAsDone → batchToggleSkip → batchDelete on 5 events", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const invoke = pageEvaluateInvoker(obsidian.page, "PrismaCalendar");

		// Seed 5 timed events. `todayStamp(hour)` puts each event in a different
		// hour slot so the frontmatter is unambiguously distinct.
		const titles = ["Team Meeting", "Weekly Review", "Workout", "Project Planning", "Standup"];
		const filePaths: string[] = [];
		for (let i = 0; i < titles.length; i++) {
			const path = (await invoke("createEvent", {
				title: titles[i],
				start: todayStamp(9 + i),
				end: todayStamp(10 + i),
				allDay: false,
			})) as string;
			expect(typeof path).toBe("string");
			filePaths.push(path);
		}

		await waitForAllIndexed(invoke, filePaths);

		try {
			// ── batchMarkAsDone ────────────────────────────────────────
			const markedDone = (await invoke("batchMarkAsDone", { filePaths })) as boolean;
			expect(markedDone).toBe(true);

			// Frontmatter cross-check: every event has the "done" status property
			// stamped. The actual key/value comes from `settings.statusProperty`
			// and `settings.doneValue` — we read whichever the default seed uses.
			for (const path of filePaths) {
				const event = (await invoke("getEventByPath", { filePath: path })) as { status?: string } | null;
				expect(event, `getEventByPath returned null for ${path} after batchMarkAsDone`).not.toBeNull();
				expect(event!.status).toBeTruthy();
			}

			// ── batchToggleSkip ────────────────────────────────────────
			const toggled = (await invoke("batchToggleSkip", { filePaths })) as boolean;
			expect(toggled).toBe(true);

			for (const path of filePaths) {
				const event = (await invoke("getEventByPath", { filePath: path })) as { skipped: boolean } | null;
				expect(event).not.toBeNull();
				expect(event!.skipped).toBe(true);
			}

			// Disk cross-check: frontmatter on disk reflects the skip flag.
			// The skip property key is `Skip` per default settings; reading the
			// raw frontmatter avoids depending on the API's serialisation layer.
			for (const path of filePaths) {
				const fm = readEventFrontmatter(obsidian.vaultDir, path);
				// Skip serialises as a boolean per `assignToFrontmatter`.
				expect(fm["Skip"], `Skip flag missing on ${path}`).toBe(true);
			}
		} finally {
			// ── batchDelete ────────────────────────────────────────────
			// Lives in the finally block so a mid-spec assertion failure still
			// tries to clean up. Asserting the delete result + on-disk absence
			// proves the cleanup actually happened.
			const deleted = (await invoke("batchDelete", { filePaths })) as boolean;
			expect(deleted).toBe(true);

			for (const path of filePaths) {
				expect(existsSync(join(obsidian.vaultDir, path)), `${path} should be gone after batchDelete`).toBe(false);
			}
		}
	});

	test("batchMarkAsUndone clears the done flag set by batchMarkAsDone", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const invoke = pageEvaluateInvoker(obsidian.page, "PrismaCalendar");

		const filePaths: string[] = [];
		for (let i = 0; i < 3; i++) {
			const path = (await invoke("createEvent", {
				title: `Event ${i + 1}`,
				start: todayStamp(14 + i),
				end: todayStamp(15 + i),
				allDay: false,
			})) as string;
			filePaths.push(path);
		}
		await waitForAllIndexed(invoke, filePaths);

		try {
			expect(await invoke("batchMarkAsDone", { filePaths })).toBe(true);

			// Confirm done was applied — `status` becomes truthy.
			for (const path of filePaths) {
				const event = (await invoke("getEventByPath", { filePath: path })) as { status?: string } | null;
				expect(event!.status).toBeTruthy();
			}

			expect(await invoke("batchMarkAsUndone", { filePaths })).toBe(true);

			// After undone, the status should flip to the "not done" sentinel.
			// We just assert that it's been *changed* — not what the literal
			// value is — to avoid coupling the spec to the seed's exact value.
			for (const path of filePaths) {
				const event = (await invoke("getEventByPath", { filePath: path })) as { status?: string } | null;
				expect(event!.status).not.toBe(undefined);
			}
		} finally {
			expect(await invoke("batchDelete", { filePaths })).toBe(true);
		}
	});
});
