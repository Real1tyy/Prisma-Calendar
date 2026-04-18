import { isoLocal } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { listEventFiles } from "../events/events-helpers";

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
	test("editEvent — undo reverts the edited end time", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Edit Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await event.edit({ end: isoLocal(1, 13) });
		await event.expectFrontmatter("End Date", (v) => typeof v === "string" && v.includes("13:00"));

		await calendar.undo();
		await event.expectFrontmatter("End Date", (v) => typeof v === "string" && v.includes("10:00"));
	});

	test("duplicateEvent — undo removes the duplicate file", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Dup Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const before = listEventFiles(calendar.vaultDir).length;

		await event.rightClick("duplicateEvent");
		await calendar.expectEventCount(before + 1);

		await calendar.undo();
		await calendar.expectEventCount(before);
	});

	test("markDone — undo clears the Done status", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Done Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await event.rightClick("markDone");
		await event.expectFrontmatter("Status", (v) => v === "Done");

		await calendar.undo();
		await event.expectFrontmatter("Status", (v) => v !== "Done");
	});

	test("skipEvent — undo clears the Skip flag", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Skip Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await event.rightClick("skipEvent");
		await event.expectFrontmatter("Skip", (v) => v === true);

		await calendar.undo();
		await event.expectFrontmatter("Skip", (v) => v === undefined || v === false);
	});

	test("deleteEvent — undo restores the deleted file", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "Delete Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await event.rightClick("deleteEvent");
		await event.expectExists(false);

		await calendar.undo();
		await event.expectExists(true);
	});

	test("moveToNextWeek — undo reverts the Start Date", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "MoveNext Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const originalStart = event.readFrontmatter("Start Date");

		await event.rightClick("moveToNextWeek");
		await event.expectFrontmatter("Start Date", (v) => v !== originalStart);

		await calendar.undo();
		await event.expectFrontmatter("Start Date", (v) => v === originalStart);
	});

	test("moveToPreviousWeek — undo reverts the Start Date", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "MovePrev Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const originalStart = event.readFrontmatter("Start Date");

		await event.rightClick("moveToPreviousWeek");
		await event.expectFrontmatter("Start Date", (v) => v !== originalStart);

		await calendar.undo();
		await event.expectFrontmatter("Start Date", (v) => v === originalStart);
	});

	test("cloneToNextWeek — undo removes the clone", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "CloneNext Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const before = listEventFiles(calendar.vaultDir).length;

		await event.rightClick("cloneToNextWeek");
		await calendar.expectEventCount(before + 1);

		await calendar.undo();
		await calendar.expectEventCount(before);
	});

	test("cloneToPreviousWeek — undo removes the clone", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "ClonePrev Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const before = listEventFiles(calendar.vaultDir).length;

		await event.rightClick("cloneToPreviousWeek");
		await calendar.expectEventCount(before + 1);

		await calendar.undo();
		await calendar.expectEventCount(before);
	});

	test("moveBy — undo reverts the custom-offset move", async ({ calendar }) => {
		const event = await calendar.createEvent({
			title: "MoveBy Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});
		const originalStart = event.readFrontmatter("Start Date");

		await event.rightClick("moveBy");
		const modal = calendar.page.locator(".prisma-move-by-modal").first();
		await modal.waitFor({ state: "visible" });
		await modal.locator(".prisma-move-by-input").first().fill("30");
		// Unit is selected via text-labeled buttons; default is "minutes" — no
		// change needed. Submit via the "Move" button rendered by the shared
		// createModalButtons helper (no testid, text is stable).
		await modal.locator("button", { hasText: /^Move$/ }).click();
		await modal.waitFor({ state: "hidden" });
		await event.expectFrontmatter("Start Date", (v) => v !== originalStart);

		await calendar.undo();
		await event.expectFrontmatter("Start Date", (v) => v === originalStart);
	});
});
