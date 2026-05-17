import { existsSync } from "node:fs";
import { join } from "node:path";

import { openNote, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { createPrismaApi, waitForActiveFile, waitForApiIndex } from "../../fixtures/api-helpers";
import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";

// Tier 1 contract spec for the active-note modal-action surface plus the
// singular `markAsUndone` action. These paths share a precondition (an
// "active note" of some sort) and were each missing direct window-API
// coverage:
//
//   - openCreateEventModal (no active note required — fire-and-forget)
//   - openEditActiveNoteModal (returns boolean post-Phase-1 fix)
//   - addZettelIdToActiveNote
//   - duplicateCurrentEvent
//   - markAsUndone (singular — previously only covered transitively via batch)

test.describe("plugin api contract — active-note modal actions via window.PrismaCalendar", () => {
	test("openCreateEventModal opens the create modal even when no note is active", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		// Fire-and-forget: the action returns undefined regardless of outcome.
		// We assert the modal actually appeared as the load-bearing proof.
		expect(await api.openCreateEventModal({})).toBeUndefined();

		await expect(obsidian.page.locator(".modal").first()).toBeVisible();
	});

	test("active-note actions all return false when no markdown note is open", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		// The fixture opens the calendar view, not a markdown note, so
		// `workspace.getActiveFile()` returns null. Every active-note action
		// must surface that as `false`, not throw.
		expect(await api.openEditActiveNoteModal({})).toBe(false);
		expect(await api.addZettelIdToActiveNote({})).toBe(false);
		expect(await api.duplicateCurrentEvent({})).toBe(false);
	});

	test("openEditActiveNoteModal returns true when an event note is active and opens the edit modal", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const eventPath = (await api.createEvent({
			title: "Team Meeting",
			start: todayStamp(9),
			end: todayStamp(10),
			allDay: false,
		}))!;
		await waitForApiIndex(api, eventPath);

		try {
			// `openNote` uses workspace.openLinkText — same path the user takes
			// from a link click. Strip the `.md` suffix that openLinkText expects.
			await openNote(obsidian.page, eventPath.replace(/\.md$/, ""));
			await waitForActiveFile(obsidian.page, eventPath);

			expect(await api.openEditActiveNoteModal({})).toBe(true);
			await expect(obsidian.page.locator(".modal").first()).toBeVisible();
		} finally {
			await api.deleteEvent({ filePath: eventPath });
		}
	});

	test("duplicateCurrentEvent on an active event creates a sibling file", async ({ calendar, obsidian }) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const eventPath = (await api.createEvent({
			title: "Workout",
			start: todayStamp(11),
			end: todayStamp(12),
			allDay: false,
		}))!;
		await waitForApiIndex(api, eventPath);

		try {
			await openNote(obsidian.page, eventPath.replace(/\.md$/, ""));
			await waitForActiveFile(obsidian.page, eventPath);

			expect(await api.duplicateCurrentEvent({})).toBe(true);

			// Disk cross-check: a second event with the same title now exists.
			// CloneEventCommand adds a numeric suffix to the filename. Poll the
			// indexed event list until a second entry surfaces.
			await expect
				.poll(async () => {
					const all = await api.getAllEvents({});
					return all.filter((e) => e.title === "Workout").length;
				})
				.toBe(2);

			const all = await api.getAllEvents({});
			const duplicatePath = all.find((e) => e.filePath !== eventPath && e.title === "Workout")?.filePath;
			expect(duplicatePath, "duplicate file path must be discoverable").toBeDefined();
			expect(existsSync(join(obsidian.vaultDir, duplicatePath!))).toBe(true);

			await api.deleteEvent({ filePath: duplicatePath! });
		} finally {
			await api.deleteEvent({ filePath: eventPath });
		}
	});

	test("markAsUndone (singular) flips Status frontmatter back from the done sentinel", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.unlockPro();
		const api = createPrismaApi(obsidian.page);

		const eventPath = (await api.createEvent({
			title: "Project Planning",
			start: todayStamp(13),
			end: todayStamp(14),
			allDay: false,
		}))!;
		await waitForApiIndex(api, eventPath);

		try {
			// Mark done first so undone has something to flip away from. The
			// frontmatter write is debounced inside the command manager, so the
			// API return value can resolve before the file on disk has been
			// updated — poll the disk for the `Status` field to appear before
			// capturing the sentinel.
			expect(await api.markAsDone({ filePath: eventPath })).toBe(true);
			await expect.poll(() => readEventFrontmatter(obsidian.vaultDir, eventPath)["Status"]).toBeTruthy();
			const doneStatus = readEventFrontmatter(obsidian.vaultDir, eventPath)["Status"];

			expect(await api.markAsUndone({ filePath: eventPath })).toBe(true);

			// Status must differ from the done sentinel — proves markAsUndone
			// actually flipped the field. `.not.toBe(undefined)` alone (the
			// previous batch-spec antipattern) would have allowed a no-op
			// regression to pass silently. Same poll-for-disk-flush pattern as
			// above so the test isn't racing the debounced writer.
			await expect.poll(() => readEventFrontmatter(obsidian.vaultDir, eventPath)["Status"]).not.toBe(doneStatus);
		} finally {
			await api.deleteEvent({ filePath: eventPath });
		}
	});
});
