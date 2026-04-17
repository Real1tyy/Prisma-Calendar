import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	createEventViaToolbar,
	eventByTitle,
	expectEventsNotVisibleByTitle,
	expectEventsVisibleByTitle,
	isoLocal,
	redoViaPalette,
	undoViaPalette,
	waitForEventFileCount,
	waitForFileExists,
	waitForFrontmatter,
} from "../../fixtures/history-helpers";
import { listEventFiles, openCalendarReady, rightClickEventMenu } from "../events/events-helpers";
import { fillEventModal, saveEventModal } from "../events/fill-event-modal";

// Every action is driven through the real UI: toolbar Create, right-click →
// context-menu item, edit modal fill/save, command palette for undo/redo.
// Every assertion pairs file-on-disk (source of truth) with a DOM check so
// regressions that write frontmatter correctly but fail to refresh the
// calendar (or vice versa) get caught.

test.describe("undo/redo: single event (UI-driven)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
	});

	test("create via toolbar → undo removes → redo restores (count)", async ({ obsidian }) => {
		const before = listEventFiles(obsidian.vaultDir).length;
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Alice Sync",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await waitForEventFileCount(obsidian.vaultDir, before + 1);
		await expectEventsVisibleByTitle(obsidian.page, ["Alice Sync"]);

		await undoViaPalette(obsidian.page);
		await waitForFileExists(obsidian.vaultDir, path, false);
		await expectEventsNotVisibleByTitle(obsidian.page, ["Alice Sync"]);

		// Redo of "create" regenerates the zettel-ID-derived filename, so the
		// restored file may live at a new path. Assert on count rather than
		// exact path (documenting the current plugin behaviour).
		await redoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before + 1);
		await expectEventsVisibleByTitle(obsidian.page, ["Alice Sync"]);
	});

	test("edit via context menu: bump end time → undo reverts → redo re-applies", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Workout",
			start: isoLocal(1, 7),
			end: isoLocal(1, 8),
		});
		const endBefore = readEventFrontmatter(obsidian.vaultDir, path)["End Date"];

		await rightClickEventMenu(obsidian.page, "Workout", "editEvent");
		await fillEventModal(obsidian.page, { end: isoLocal(1, 9) });
		await saveEventModal(obsidian.page);

		await waitForFrontmatter(obsidian.vaultDir, path, "End Date", (v) => v !== endBefore);
		const endAfter = readEventFrontmatter(obsidian.vaultDir, path)["End Date"];
		await expectEventsVisibleByTitle(obsidian.page, ["Workout"]);

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "End Date", (v) => v === endBefore);
		await expectEventsVisibleByTitle(obsidian.page, ["Workout"]);

		await redoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "End Date", (v) => v === endAfter);
		await expectEventsVisibleByTitle(obsidian.page, ["Workout"]);
	});

	test("context menu: duplicate event → undo removes → redo restores (count)", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Team Sync",
			start: isoLocal(1, 10),
			end: isoLocal(1, 11),
		});
		const before = listEventFiles(obsidian.vaultDir).length;
		const titleLocator = obsidian.page.locator('[data-testid="prisma-cal-event"][data-event-title="Team Sync"]');

		await rightClickEventMenu(obsidian.page, "Team Sync", "duplicateEvent");
		await waitForEventFileCount(obsidian.vaultDir, before + 1);
		// Duplicate emits a second "Team Sync" event — the DOM should gain one.
		// Per-title is stable; aggregate `[data-testid="prisma-cal-event"]` counts
		// drift because FC month-view renders overflow/popup clones.
		await expect.poll(() => titleLocator.count()).toBe(2);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);
		await expect.poll(() => titleLocator.count()).toBe(1);

		await redoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before + 1);
		await expect.poll(() => titleLocator.count()).toBe(2);
	});

	test("context menu: skip toggle writes/removes Skip frontmatter symmetrically", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Standup",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await expectEventsVisibleByTitle(obsidian.page, ["Standup"]);

		await rightClickEventMenu(obsidian.page, "Standup", "skipEvent");
		await waitForFrontmatter(obsidian.vaultDir, path, "Skip", (v) => v === true);
		// Skipped events disappear from the main calendar view.
		await expectEventsNotVisibleByTitle(obsidian.page, ["Standup"]);

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Skip", (v) => v === undefined || v === false);
		await expectEventsVisibleByTitle(obsidian.page, ["Standup"]);

		await redoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Skip", (v) => v === true);
		await expectEventsNotVisibleByTitle(obsidian.page, ["Standup"]);
	});

	test("context menu: mark done → undo clears → redo re-sets", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Task Item",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await rightClickEventMenu(obsidian.page, "Task Item", "markDone");
		await waitForFrontmatter(obsidian.vaultDir, path, "Status", (v) => v === "Done");
		// Done events keep rendering — the class changes, visibility doesn't.
		await expect(eventByTitle(obsidian.page, "Task Item")).toBeVisible();

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Status", (v) => v !== "Done");
		await expect(eventByTitle(obsidian.page, "Task Item")).toBeVisible();

		await redoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Status", (v) => v === "Done");
		await expect(eventByTitle(obsidian.page, "Task Item")).toBeVisible();
	});

	test("context menu: delete event → undo restores → redo removes", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Alice One-on-One",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await expectEventsVisibleByTitle(obsidian.page, ["Alice One-on-One"]);

		await rightClickEventMenu(obsidian.page, "Alice One-on-One", "deleteEvent");
		await waitForFileExists(obsidian.vaultDir, path, false);
		await expectEventsNotVisibleByTitle(obsidian.page, ["Alice One-on-One"]);

		await undoViaPalette(obsidian.page);
		await waitForFileExists(obsidian.vaultDir, path, true);
		await expectEventsVisibleByTitle(obsidian.page, ["Alice One-on-One"]);

		await redoViaPalette(obsidian.page);
		await waitForFileExists(obsidian.vaultDir, path, false);
		await expectEventsNotVisibleByTitle(obsidian.page, ["Alice One-on-One"]);
	});

	test("right-click exposes every expected context-menu item", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Menu Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		await obsidian.page.locator(".fc-event", { hasText: "Menu Probe" }).first().click({ button: "right" });
		for (const id of ["editEvent", "duplicateEvent", "deleteEvent", "skipEvent", "markDone"]) {
			await expect(obsidian.page.locator(`[data-testid="prisma-context-menu-item-${id}"]`)).toBeVisible();
		}
	});
});
