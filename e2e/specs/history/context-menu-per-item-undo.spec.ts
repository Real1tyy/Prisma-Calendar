import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	createEventViaToolbar,
	isoLocal,
	undoViaPalette,
	waitForEventFileCount,
	waitForFileExists,
	waitForFrontmatter,
} from "../../fixtures/history-helpers";
import { listEventFiles, openCalendarReady, rightClickEventMenu } from "../events/events-helpers";
import { fillEventModal, saveEventModal } from "../events/fill-event-modal";

// Companion to context-menu-every-item.spec.ts — that one only asserts the
// items are *visible*. This one drives each mutating item through the UI and
// asserts undo reverses the effect per-item. A regression that silently drops
// undo wiring for one item (e.g. markDone adds an op but skipEvent doesn't)
// needs a per-item assertion to catch; the multi-step chain spec would paper
// over it by still landing at baseline.
//
// Items not covered here:
//   - assignCategories / assignPrerequisites — need seeded categories/events
//     to pick from; the flows have their own specs in specs/categories/ and
//     specs/prerequisites/ that already exercise undo-safe paths.
//   - enlarge / preview / openFile / openFileNewWindow — non-mutating (open
//     overlays or markdown views); no undo entry to assert.
//   - goToSource / editSourceEvent / viewEventGroups / toggleRecurring /
//     fillStartTimeNow / fillEndTimeNow / fillStartTimePrevious /
//     fillEndTimeNext / triggerStopwatch / duplicateRemainingWeekDays /
//     makeVirtual / makeReal / makeUntracked — require special event kinds
//     (recurring source, virtual, untracked). Out of scope for a normal-
//     event regression spec; those items have dedicated coverage.

test.describe("context menu: per-item undo (UI-driven)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
	});

	test("editEvent — undo reverts the edited end time", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Edit Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await rightClickEventMenu(obsidian.page, "Edit Probe", "editEvent");
		await fillEventModal(obsidian.page, { end: isoLocal(1, 13) });
		await saveEventModal(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "End Date", (v) => typeof v === "string" && v.includes("13:00"));

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "End Date", (v) => typeof v === "string" && v.includes("10:00"));
	});

	test("duplicateEvent — undo removes the duplicate file", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Dup Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const before = listEventFiles(obsidian.vaultDir).length;

		await rightClickEventMenu(obsidian.page, "Dup Probe", "duplicateEvent");
		await waitForEventFileCount(obsidian.vaultDir, before + 1);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);
	});

	test("markDone — undo clears the Done status", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Done Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await rightClickEventMenu(obsidian.page, "Done Probe", "markDone");
		await waitForFrontmatter(obsidian.vaultDir, path, "Status", (v) => v === "Done");

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Status", (v) => v !== "Done");
	});

	test("skipEvent — undo clears the Skip flag", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Skip Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await rightClickEventMenu(obsidian.page, "Skip Probe", "skipEvent");
		await waitForFrontmatter(obsidian.vaultDir, path, "Skip", (v) => v === true);

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Skip", (v) => v === undefined || v === false);
	});

	test("deleteEvent — undo restores the deleted file", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Delete Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await rightClickEventMenu(obsidian.page, "Delete Probe", "deleteEvent");
		await waitForFileExists(obsidian.vaultDir, path, false);

		await undoViaPalette(obsidian.page);
		await waitForFileExists(obsidian.vaultDir, path, true);
	});

	test("moveToNextWeek — undo reverts the Start Date", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "MoveNext Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const originalStart = readStart(obsidian.vaultDir, path);

		await rightClickEventMenu(obsidian.page, "MoveNext Probe", "moveToNextWeek");
		await waitForFrontmatter(obsidian.vaultDir, path, "Start Date", (v) => v !== originalStart);

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Start Date", (v) => v === originalStart);
	});

	test("moveToPreviousWeek — undo reverts the Start Date", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "MovePrev Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const originalStart = readStart(obsidian.vaultDir, path);

		await rightClickEventMenu(obsidian.page, "MovePrev Probe", "moveToPreviousWeek");
		await waitForFrontmatter(obsidian.vaultDir, path, "Start Date", (v) => v !== originalStart);

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Start Date", (v) => v === originalStart);
	});

	test("cloneToNextWeek — undo removes the clone", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "CloneNext Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const before = listEventFiles(obsidian.vaultDir).length;

		await rightClickEventMenu(obsidian.page, "CloneNext Probe", "cloneToNextWeek");
		await waitForEventFileCount(obsidian.vaultDir, before + 1);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);
	});

	test("cloneToPreviousWeek — undo removes the clone", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "ClonePrev Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const before = listEventFiles(obsidian.vaultDir).length;

		await rightClickEventMenu(obsidian.page, "ClonePrev Probe", "cloneToPreviousWeek");
		await waitForEventFileCount(obsidian.vaultDir, before + 1);

		await undoViaPalette(obsidian.page);
		await waitForEventFileCount(obsidian.vaultDir, before);
	});

	test("moveBy — undo reverts the custom-offset move", async ({ obsidian }) => {
		const path = await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "MoveBy Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const originalStart = readStart(obsidian.vaultDir, path);

		await rightClickEventMenu(obsidian.page, "MoveBy Probe", "moveBy");
		const modal = obsidian.page.locator(".prisma-move-by-modal").first();
		await modal.waitFor({ state: "visible" });
		const amountInput = modal.locator(".prisma-move-by-input").first();
		await amountInput.fill("30");
		// Unit is selected via text-labeled buttons; default is "minutes" — no
		// change needed. Submit via the "Move" button rendered by the shared
		// createModalButtons helper (no testid, text is stable).
		await modal.locator("button", { hasText: /^Move$/ }).click();
		await modal.waitFor({ state: "hidden" });
		await waitForFrontmatter(obsidian.vaultDir, path, "Start Date", (v) => v !== originalStart);

		await undoViaPalette(obsidian.page);
		await waitForFrontmatter(obsidian.vaultDir, path, "Start Date", (v) => v === originalStart);
	});
});

function readStart(vaultDir: string, filePath: string): unknown {
	return readEventFrontmatter(vaultDir, filePath)["Start Date"];
}
