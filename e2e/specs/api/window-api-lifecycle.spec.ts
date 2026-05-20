import { existsSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter, seedMarkdownNote } from "@real1ty-obsidian-plugins/testing/e2e";

import { createPrismaApi, waitForApiIndex } from "../../fixtures/api-helpers";
import { PLUGIN_ID } from "../../fixtures/constants";
import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import type { PrismaPlugin, PrismaWindow } from "../../fixtures/window-types";

// Tier 1 contract spec for the event-lifecycle actions that no other window-API
// spec exercises end-to-end. Covers timestamp arithmetic (cloneEvent /
// moveEvent), the file→event bridge (convertFileToEvent), and the virtual
// round-trip (makeEventVirtual ↔ makeEventReal).
//
// We use `todayStamp` because no FullCalendar viewport is asserted on — the
// proof is filesystem + API readback.

test.describe("plugin api contract — event lifecycle via window.PrismaCalendar", () => {
	test("cloneEvent offsets the clone's start by offsetMs and returns the new path", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const originalPath = (await api.createEvent({
			title: "Team Meeting",
			start: todayStamp(9),
			end: todayStamp(10),
			allDay: false,
		}))!;
		await waitForApiIndex(api, originalPath);

		try {
			const offsetMs = 60 * 60 * 1000; // +1h
			const clonedPath = await api.cloneEvent({ filePath: originalPath, offsetMs });
			expect(typeof clonedPath).toBe("string");
			expect(clonedPath).not.toBe(originalPath);

			// Disk cross-check: both files exist, clone's Start Date is +1h.
			expect(existsSync(join(obsidian.vaultDir, originalPath))).toBe(true);
			expect(existsSync(join(obsidian.vaultDir, clonedPath!))).toBe(true);

			const originalFm = readEventFrontmatter(obsidian.vaultDir, originalPath);
			const clonedFm = readEventFrontmatter(obsidian.vaultDir, clonedPath!);

			const originalStartMs = new Date(String(originalFm["Start Date"])).getTime();
			const clonedStartMs = new Date(String(clonedFm["Start Date"])).getTime();
			// Exact ms-level equality — the offset arithmetic is integer math, no
			// rounding involved. Anything else is a regression.
			expect(clonedStartMs - originalStartMs).toBe(offsetMs);

			// Indexer cross-check: clone is reachable via the read API.
			await waitForApiIndex(api, clonedPath!);
			const clonedEvent = await api.getEventByPath({ filePath: clonedPath! });
			expect(clonedEvent).not.toBeNull();
			expect(clonedEvent!.title).toBe("Team Meeting");
		} finally {
			await api.batchDelete({ filePaths: [originalPath] });
		}
	});

	test("cloneEvent against a nonexistent path returns null", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		expect(await api.cloneEvent({ filePath: "Events/Does Not Exist.md", offsetMs: 0 })).toBeNull();
	});

	test("moveEvent shifts Start Date (and End Date for timed) by offsetMs", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const originalPath = (await api.createEvent({
			title: "Workout",
			start: todayStamp(14),
			end: todayStamp(15),
			allDay: false,
		}))!;
		await waitForApiIndex(api, originalPath);

		try {
			const beforeFm = readEventFrontmatter(obsidian.vaultDir, originalPath);
			const beforeStartMs = new Date(String(beforeFm["Start Date"])).getTime();
			const beforeEndMs = new Date(String(beforeFm["End Date"])).getTime();

			const offsetMs = 30 * 60 * 1000; // +30m
			expect(await api.moveEvent({ filePath: originalPath, offsetMs })).toBe(true);

			// Poll the on-disk frontmatter rather than reading once: the move
			// resolves as soon as the command's write returns, but a follow-up
			// writeback can still be rewriting the file, and Obsidian's
			// truncate-then-write adapter is non-atomic — a single immediate read
			// can catch a partial file and parse NaN. Re-read until both
			// timestamps settle on the +30m shift.
			await expect
				.poll(() => {
					const afterFm = readEventFrontmatter(obsidian.vaultDir, originalPath);
					const afterStartMs = new Date(String(afterFm["Start Date"])).getTime();
					const afterEndMs = new Date(String(afterFm["End Date"])).getTime();
					return { start: afterStartMs - beforeStartMs, end: afterEndMs - beforeEndMs };
				})
				.toEqual({ start: offsetMs, end: offsetMs });
		} finally {
			await api.batchDelete({ filePaths: [originalPath] });
		}
	});

	test("convertFileToEvent stamps an existing note with event frontmatter and indexes it", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const seedPath = "Events/Plain Note.md";
		await seedMarkdownNote(obsidian.page, seedPath, "# Plain Note\n\nNo frontmatter yet.\n");

		// `convertFileToEvent` internally calls `ensureFileHasZettelId` which
		// renames a note without a zettel id to `<title>-<YYYYMMDDhhmmss>.md`.
		// The handler returns a bare boolean and does NOT report the renamed
		// path, so we discover it via `getAllEvents` afterwards. Capturing this
		// in the spec also pins the renaming behaviour as part of the contract.
		let convertedPath: string | undefined;

		try {
			const start = todayStamp(11);
			const end = todayStamp(12);
			expect(
				await api.convertFileToEvent({
					filePath: seedPath,
					start,
					end,
					allDay: false,
					categories: ["Work"],
				})
			).toBe(true);

			// Discover the (possibly-renamed) path by basename prefix. The original
			// stem "Plain Note" remains in the basename regardless of the zettel
			// suffix Prisma appends.
			await expect
				.poll(async () => {
					const all = await api.getAllEvents({});
					return all.some((e) => e.filePath.startsWith("Events/Plain Note"));
				})
				.toBe(true);

			const all = await api.getAllEvents({});
			convertedPath = all.find((e) => e.filePath.startsWith("Events/Plain Note"))!.filePath;

			// Disk cross-check: frontmatter was stamped.
			const fm = readEventFrontmatter(obsidian.vaultDir, convertedPath);
			expect(String(fm["Start Date"])).toMatch(new RegExp(`^${start}`));
			expect(String(fm["End Date"])).toMatch(new RegExp(`^${end}`));
			expect(fm["Category"]).toBe("Work");

			// Indexer cross-check: the converted note is now a tracked event.
			const event = await api.getEventByPath({ filePath: convertedPath });
			expect(event).not.toBeNull();
			expect(event!.type).toBe("timed");
		} finally {
			if (convertedPath) {
				await api.deleteEvent({ filePath: convertedPath });
			}
		}
	});

	test("convertFileToEvent against a nonexistent file returns false (no exception)", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		expect(
			await api.convertFileToEvent({
				filePath: "Events/Does Not Exist.md",
				start: todayStamp(9),
				end: todayStamp(10),
				allDay: false,
			})
		).toBe(false);
	});

	test("makeEventVirtual → makeEventReal round-trip via virtualEventStore", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const originalPath = (await api.createEvent({
			title: "Project Planning",
			start: todayStamp(16),
			end: todayStamp(17),
			allDay: false,
		}))!;
		await waitForApiIndex(api, originalPath);

		// `createEvent` auto-appends a zettel-id suffix to the basename, so the
		// virtual event's title (sourced from `file.basename` in
		// ConvertToVirtualCommand) is "Project Planning-<YYYYMMDDhhmmss>", not
		// the bare "Project Planning". Derive the expected basename from the
		// path so the assertion stays correct regardless of clock skew.
		const expectedVirtualTitle = originalPath.replace(/^Events\//, "").replace(/\.md$/, "");

		let realPath: string | undefined;

		try {
			// ── makeEventVirtual ───────────────────────────────────────
			expect(await api.makeEventVirtual({ filePath: originalPath })).toBe(true);

			// The real file is gone from disk (virtual events live in the store,
			// not the vault). The convert command trashes the source file.
			await expect.poll(() => existsSync(join(obsidian.vaultDir, originalPath))).toBe(false);

			// Out-of-band ground truth: poll the virtualEventStore directly for the
			// new entry. This is a legitimate assert-side bypass — we're proving the
			// store reflects the API mutation, not driving the action under test.
			const virtualEventId = await obsidian.page.evaluate(
				async ({ pid, title }) => {
					const w = window as unknown as PrismaWindow;
					const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
					const bundle = plugin?.calendarBundles?.[0];
					if (!bundle) throw new Error("bundle missing");
					const entry = bundle.virtualEventStore.getAll().find((e) => e.title === title);
					return entry?.id ?? null;
				},
				{ pid: PLUGIN_ID, title: expectedVirtualTitle }
			);
			expect(virtualEventId, "virtual event must be discoverable in the store after makeEventVirtual").not.toBeNull();

			// ── makeEventReal ──────────────────────────────────────────
			expect(await api.makeEventReal({ virtualEventId: virtualEventId! })).toBe(true);

			// Polling: the promoted note reappears as a real file under Events/.
			// `convertToReal` calls `createEventFile` which derives the new
			// filename from the stored title. The basename (and the parsed
			// event title) therefore CONTAINS the original stem "Project
			// Planning", regardless of any zettel-id suffix the create command
			// appends. Substring match on title is the most resilient probe.
			await expect
				.poll(async () => {
					const all = await api.getAllEvents({});
					return all.some((e) => e.title.includes("Project Planning"));
				})
				.toBe(true);

			const all = await api.getAllEvents({});
			const promoted = all.find((e) => e.title.includes("Project Planning"));
			expect(promoted, "promoted event must be reachable via getAllEvents").toBeDefined();
			realPath = promoted!.filePath;
			expect(existsSync(join(obsidian.vaultDir, realPath))).toBe(true);
		} finally {
			if (realPath) {
				await api.deleteEvent({ filePath: realPath });
			}
		}
	});

	test("makeEventReal against an unknown virtualEventId returns false (no exception)", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		expect(await api.makeEventReal({ virtualEventId: "does-not-exist" })).toBe(false);
	});
});
