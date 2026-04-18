import { isoLocal } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { listEventFiles } from "../events/events-helpers";

// Companion to context-menu-every-item.spec.ts (asserts visibility) and
// undo-redo-single-event.spec.ts (drives edit/duplicate/markDone/skip/delete
// through the full undo+redo round-trip via the DSL). This file fills the
// remaining mutating items that the DSL-based spec doesn't cover — the
// move/clone-by-week family plus the moveBy custom-offset modal.
//
// Items not covered here:
//   - editEvent / duplicateEvent / markDone / skipEvent / deleteEvent —
//     exercised by undo-redo-single-event.spec.ts with undo+redo (superset).
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
