import { isoLocal } from "../../fixtures/dates";
import { expectAllHidden, expectAllVisible, undoRedoRoundTrip } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { eventByTitle } from "../../fixtures/history-helpers";
import { sel, TID } from "../../fixtures/testids";
import { listEventFiles } from "../events/events-helpers";

// Every action is driven through the real UI: toolbar Create, right-click →
// context-menu item, edit modal fill/save, command palette for undo/redo.
// Every assertion pairs file-on-disk (source of truth) with a DOM check so
// regressions that write frontmatter correctly but fail to refresh the
// calendar (or vice versa) get caught.

test.describe("undo/redo: single event (UI-driven)", () => {
	test("create via toolbar → undo removes → redo restores (count)", async ({ calendar }) => {
		const before = listEventFiles(calendar.vaultDir).length;

		const event = await calendar.createEvent({
			title: "Alice Sync",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const present = [event];
		await calendar.expectEventCount(before + 1);
		await expectAllVisible(calendar.page, present);

		await calendar.undo();
		await event.expectExists(false);
		await expectAllHidden(calendar.page, present);

		// Redo of "create" regenerates the zettel-ID-derived filename, so the
		// restored file may live at a new path. Assert on count rather than
		// exact path (documenting the current plugin behaviour).
		await calendar.redo();
		await calendar.expectEventCount(before + 1);
		await expectAllVisible(calendar.page, present);
	});

	test("edit via context menu: bump end time → undo reverts → redo re-applies", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Workout",
			start: isoLocal(1, 7),
			end: isoLocal(1, 8),
		});
		const endBefore = event.readFrontmatter<string>("End Date");

		await event.edit({ end: isoLocal(1, 9) });
		await event.expectFrontmatter("End Date", (v) => v !== endBefore);
		const endAfter = event.readFrontmatter<string>("End Date");
		await expectAllVisible(calendar.page, [event]);

		await calendar.undo();
		await event.expectFrontmatter("End Date", (v) => v === endBefore);
		await expectAllVisible(calendar.page, [event]);

		await calendar.redo();
		await event.expectFrontmatter("End Date", (v) => v === endAfter);
		await expectAllVisible(calendar.page, [event]);
	});

	test("context menu: duplicate event → undo removes → redo restores (count)", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Team Sync",
			start: isoLocal(1, 10),
			end: isoLocal(1, 11),
		});
		const before = listEventFiles(calendar.vaultDir).length;
		const titleLocator = calendar.page.locator(`${sel(TID.block)}[data-event-title="Team Sync"]`);

		await undoRedoRoundTrip(calendar, {
			mutate: () => event.rightClick("duplicateEvent"),
			mutated: async () => {
				await calendar.expectEventCount(before + 1);
				// Duplicate emits a second "Team Sync" event — per-title count is
				// stable; aggregate counts drift because FC month-view renders
				// overflow/popup clones.
				await expect.poll(() => titleLocator.count()).toBe(2);
			},
			baseline: async () => {
				await calendar.expectEventCount(before);
				await expect.poll(() => titleLocator.count()).toBe(1);
			},
		});
	});

	test("context menu: skip toggle writes/removes Skip frontmatter symmetrically", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Standup",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await expectAllVisible(calendar.page, [event]);

		await undoRedoRoundTrip(calendar, {
			mutate: () => event.rightClick("skipEvent"),
			mutated: async () => {
				await event.expectFrontmatter("Skip", (v) => v === true);
				// Skipped events disappear from the main calendar view.
				await expectAllHidden(calendar.page, [event]);
			},
			baseline: async () => {
				await event.expectFrontmatter("Skip", (v) => v === undefined || v === false);
				await expectAllVisible(calendar.page, [event]);
			},
		});
	});

	test("context menu: mark done → undo clears → redo re-sets", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Task Item",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await undoRedoRoundTrip(calendar, {
			mutate: () => event.rightClick("markDone"),
			// Done events keep rendering — styling changes, visibility doesn't —
			// so we only assert on frontmatter.
			mutated: () => event.expectFrontmatter("Status", (v) => v === "Done"),
			baseline: () => event.expectFrontmatter("Status", (v) => v !== "Done"),
		});
		await expect(eventByTitle(calendar.page, "Task Item")).toBeVisible();
	});

	test("context menu: delete event → undo restores → redo removes", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Alice One-on-One",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await expectAllVisible(calendar.page, [event]);

		await undoRedoRoundTrip(calendar, {
			mutate: () => event.rightClick("deleteEvent"),
			mutated: async () => {
				await event.expectExists(false);
				await expectAllHidden(calendar.page, [event]);
			},
			baseline: async () => {
				await event.expectExists(true);
				await expectAllVisible(calendar.page, [event]);
			},
		});
	});
});
