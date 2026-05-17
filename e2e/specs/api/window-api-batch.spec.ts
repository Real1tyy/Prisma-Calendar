import { existsSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { createPrismaApi, waitForAllIndexed } from "../../fixtures/api-helpers";
import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Tier 1 contract spec for the four batch actions in `window.PrismaCalendar.*`.
// Drives the same gateway entry-point a consumer plugin (or external script)
// would — collect filePaths, call `batchX({ filePaths })`, assert frontmatter
// on disk and (where it matters) confirms files are gone.
//
// We use `todayStamp` because this spec never opens or asserts on a
// FullCalendar viewport — the anchor-week robustness rule doesn't apply.

test.describe("plugin api contract — batch via window.PrismaCalendar", () => {
	test("batchMarkAsDone → batchToggleSkip → batchDelete on 5 events", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		// Seed 5 timed events. `todayStamp(hour)` puts each event in a different
		// hour slot so the frontmatter is unambiguously distinct.
		const titles = ["Team Meeting", "Weekly Review", "Workout", "Project Planning", "Standup"];
		const filePaths = await Promise.all(
			titles.map(async (title, i) => {
				const path = await api.createEvent({
					title,
					start: todayStamp(9 + i),
					end: todayStamp(10 + i),
					allDay: false,
				});
				expect(typeof path).toBe("string");
				return path!;
			})
		);

		await waitForAllIndexed(api, filePaths);

		try {
			// ── batchMarkAsDone ────────────────────────────────────────
			expect(await api.batchMarkAsDone({ filePaths })).toBe(true);

			// Frontmatter cross-check: every event has the "done" status property
			// stamped. The actual key/value comes from `settings.statusProperty`
			// and `settings.doneValue` — we read whichever the default seed uses.
			for (const path of filePaths) {
				const event = await api.getEventByPath({ filePath: path });
				expect(event, `getEventByPath returned null for ${path} after batchMarkAsDone`).not.toBeNull();
				expect(event!.status).toBeTruthy();
			}

			// ── batchToggleSkip ────────────────────────────────────────
			expect(await api.batchToggleSkip({ filePaths })).toBe(true);

			for (const path of filePaths) {
				const event = await api.getEventByPath({ filePath: path });
				expect(event).not.toBeNull();
				expect(event!.skipped).toBe(true);
			}

			// Disk cross-check: frontmatter on disk reflects the skip flag.
			// The skip property key is `Skip` per default settings; reading the
			// raw frontmatter avoids depending on the API's serialisation layer.
			// Poll because the frontmatter write is debounced relative to the
			// API return — the in-memory `event.skipped` flips first, the
			// on-disk `Skip:` field flushes a tick later.
			for (const path of filePaths) {
				await expect.poll(() => readEventFrontmatter(obsidian.vaultDir, path)["Skip"]).toBe(true);
			}
		} finally {
			// ── batchDelete ────────────────────────────────────────────
			// Lives in the finally block so a mid-spec assertion failure still
			// tries to clean up. Asserting the delete result + on-disk absence
			// proves the cleanup actually happened.
			expect(await api.batchDelete({ filePaths })).toBe(true);

			for (const path of filePaths) {
				expect(existsSync(join(obsidian.vaultDir, path)), `${path} should be gone after batchDelete`).toBe(false);
			}
		}
	});

	test("batchMarkAsUndone clears the done flag set by batchMarkAsDone", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const filePaths = await Promise.all(
			[1, 2, 3].map(async (n) => {
				const path = await api.createEvent({
					title: `Event ${n}`,
					start: todayStamp(13 + n),
					end: todayStamp(14 + n),
					allDay: false,
				});
				return path!;
			})
		);
		await waitForAllIndexed(api, filePaths);

		try {
			expect(await api.batchMarkAsDone({ filePaths })).toBe(true);

			// Capture the post-done frontmatter Status — this is the sentinel we
			// expect `batchMarkAsUndone` to flip away from. The frontmatter write
			// is debounced, so poll each path until Status appears before snapshotting.
			const doneStatusByPath = new Map<string, unknown>();
			for (const path of filePaths) {
				await expect.poll(() => readEventFrontmatter(obsidian.vaultDir, path)["Status"]).toBeTruthy();
				doneStatusByPath.set(path, readEventFrontmatter(obsidian.vaultDir, path)["Status"]);
			}

			expect(await api.batchMarkAsUndone({ filePaths })).toBe(true);

			// After undone, frontmatter Status must differ from the done sentinel.
			// A regression where `batchMarkAsUndone` no-ops would leave the value
			// unchanged — `.not.toBe(undefined)` couldn't catch that, but a strict
			// inequality against the captured done value can. Poll-until-flipped
			// covers the debounced write.
			for (const path of filePaths) {
				await expect
					.poll(() => readEventFrontmatter(obsidian.vaultDir, path)["Status"])
					.not.toBe(doneStatusByPath.get(path));
			}
		} finally {
			expect(await api.batchDelete({ filePaths })).toBe(true);
		}
	});
});
