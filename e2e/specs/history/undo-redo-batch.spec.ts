import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import {
	batchActionRoundTrip,
	expectAllExist,
	expectAllFrontmatter,
	expectAllHidden,
	expectAllTitleCount,
	expectAllVisible,
} from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { listEventFiles } from "../events/events-helpers";

// Every batch op is driven through: toolbar Create (per event) → toolbar
// Batch Select → click each event → click the batch action button. Partial
// undo — reverting only some files — is a prod-breaking bug, so every
// assertion loops over every affected file. Where the op changes what the
// calendar renders (skip hides, clone adds, delete removes) the DOM is
// asserted too: disk-only checks would miss a "wrote correct frontmatter
// but failed to refresh" regression.

test.describe("undo/redo: batch operations (UI-driven)", () => {
	test("batch duplicate: N → 2N → undo → N → redo → 2N", async ({ calendar }) => {
		const events = await calendar.seedEvents(3, { prefix: "Batch" });
		const before = listEventFiles(calendar.vaultDir).length;

		await batchActionRoundTrip(calendar, events, "duplicate", {
			mutated: async () => {
				await calendar.expectEventCount(before + events.length);
				await expectAllTitleCount(calendar.page, events, 2);
			},
			baseline: async () => {
				await calendar.expectEventCount(before);
				await expectAllTitleCount(calendar.page, events, 1);
			},
		});
	});

	test("batch delete: N removed → undo restores every file → redo removes", async ({ calendar }) => {
		const events = await calendar.seedEvents(3, { prefix: "Batch" });
		await expectAllVisible(calendar.page, events);

		await batchActionRoundTrip(calendar, events, "delete", {
			destructive: true,
			mutated: async () => {
				await expectAllExist(events, false);
				await expectAllHidden(calendar.page, events);
			},
			baseline: async () => {
				await expectAllExist(events, true);
				await expectAllVisible(calendar.page, events);
			},
		});
	});

	test("batch skip: every selected has Skip: true and disappears from the calendar", async ({ calendar }) => {
		const events = await calendar.seedEvents(3, { prefix: "Batch" });
		// Prisma hides skipped events from the calendar by default, so the DOM
		// should lose exactly N events after skip and regain them on undo.
		await expectAllVisible(calendar.page, events);

		await batchActionRoundTrip(calendar, events, "skip", {
			mutated: async () => {
				await expectAllFrontmatter(events, "Skip", (v) => v === true);
				await expectAllHidden(calendar.page, events);
			},
			baseline: async () => {
				await expectAllFrontmatter(events, "Skip", (v) => v === undefined || v === false);
				await expectAllVisible(calendar.page, events);
			},
		});
	});

	test("batch mark done / not done: symmetric Status transitions across every file", async ({ calendar }) => {
		const events = await calendar.seedEvents(3, { prefix: "Batch" });

		await batchActionRoundTrip(calendar, events, "mark-done", {
			mutated: async () => {
				await expectAllFrontmatter(events, "Status", (v) => v === "Done");
				// Done events stay on the calendar (styling changes, visibility doesn't).
				await expectAllVisible(calendar.page, events);
			},
			baseline: async () => {
				await expectAllFrontmatter(events, "Status", (v) => v !== "Done");
				await expectAllVisible(calendar.page, events);
			},
		});

		// Redo for mark-not-done is covered above (Done ↔ !Done are mirror ops);
		// skip the redo leg here so the test only asserts the undo path.
		await batchActionRoundTrip(calendar, events, "mark-not-done", {
			skipRedo: true,
			mutated: () => expectAllFrontmatter(events, "Status", (v) => v !== "Done"),
			baseline: () => expectAllFrontmatter(events, "Status", (v) => v === "Done"),
		});
	});

	test("batch clone next week: N clones appear → undo removes → redo restores", async ({ calendar }) => {
		const events = await calendar.seedEvents(2, { prefix: "Batch" });
		const before = listEventFiles(calendar.vaultDir).length;

		// Month view ensures both original and +7-day clone are visible
		// regardless of which day of the week the suite runs on.
		await calendar.switchMode("month");

		await batchActionRoundTrip(calendar, events, "clone-next", {
			mutated: async () => {
				await calendar.expectEventCount(before + events.length);
				await expectAllTitleCount(calendar.page, events, 2);
			},
			baseline: async () => {
				await calendar.expectEventCount(before);
				await expectAllTitleCount(calendar.page, events, 1);
			},
		});
	});

	test("batch move next week: every file's Start Date shifts → undo reverts all", async ({ calendar }) => {
		await calendar.switchMode("month");
		const events = await calendar.seedEvents(2, { prefix: "Batch" });
		const originalStarts = events.map((e) => readEventFrontmatter(calendar.vaultDir, e.path)["Start Date"]);

		const batch = await calendar.batch(events);
		await batch.do("move-next");
		for (let i = 0; i < events.length; i++) {
			await events[i]!.expectFrontmatter("Start Date", (v) => v !== originalStarts[i]);
		}
		await batch.exit();
		// Move keeps the files — they just slide into next week. Both before/after
		// week slots are within the default month view, so titles stay rendered.
		await expectAllVisible(calendar.page, events);

		await calendar.undo();
		for (let i = 0; i < events.length; i++) {
			await events[i]!.expectFrontmatter("Start Date", (v) => v === originalStarts[i]);
		}
		await expectAllVisible(calendar.page, events);
	});

	test("single undo reverses the whole batch, not just the last event in it", async ({ calendar }) => {
		await calendar.switchMode("month");
		const events = await calendar.seedEvents(3, { prefix: "Batch" });
		const before = listEventFiles(calendar.vaultDir).length;

		const batch = await calendar.batch(events);
		await batch.do("clone-next");
		await calendar.expectEventCount(before + events.length);
		await batch.exit();
		await expectAllTitleCount(calendar.page, events, 2);

		await calendar.undo();
		await expect.poll(() => listEventFiles(calendar.vaultDir).length).toBe(before);
		// Single undo must clean up every clone — not just the last one.
		await expectAllTitleCount(calendar.page, events, 1);
	});
});
