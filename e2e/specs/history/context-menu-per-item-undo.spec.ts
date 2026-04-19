import { fromAnchor } from "../../fixtures/dates";
import { undoRedoRoundTrip } from "../../fixtures/dsl";
import { test } from "../../fixtures/electron";
import { listEventFiles } from "../events/events-helpers";

// Companion to context-menu-every-item.spec.ts (asserts visibility) and
// undo-redo-single-event.spec.ts (drives edit/duplicate/markDone/skip/delete
// through the full undo+redo round-trip via the DSL). This file fills the
// remaining mutating items that the DSL-based spec doesn't cover — the
// move/clone-by-week family plus the moveBy custom-offset modal.
//
// Every test runs through `undoRedoRoundTrip` so undo AND redo symmetry are
// verified in one pass (the original shape only undid).
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
	// Per-spec boilerplate differs only in:
	//   - the context-menu item to invoke
	//   - whether the action mutates an existing file (Start Date) or clones
	//     a new one (file count).
	// The move/clone table drives the first four tests — moveBy (modal-driven)
	// is a separate test body.

	for (const { title, item } of [
		{ title: "MoveNext Probe", item: "moveToNextWeek" as const },
		{ title: "MovePrev Probe", item: "moveToPreviousWeek" as const },
	]) {
		test(`${item} — undo/redo reverts Start Date`, async ({ calendar }) => {
			await calendar.goToAnchor();
			const event = await calendar.createEvent({ title, start: fromAnchor(1, 9), end: fromAnchor(1, 10) });
			const originalStart = event.readFrontmatter("Start Date");

			await undoRedoRoundTrip(calendar, {
				mutate: () => event.rightClick(item),
				mutated: () => event.expectFrontmatter("Start Date", (v) => v !== originalStart),
				baseline: () => event.expectFrontmatter("Start Date", (v) => v === originalStart),
			});
		});
	}

	for (const { title, item } of [
		{ title: "CloneNext Probe", item: "cloneToNextWeek" as const },
		{ title: "ClonePrev Probe", item: "cloneToPreviousWeek" as const },
	]) {
		test(`${item} — undo/redo toggles the clone`, async ({ calendar }) => {
			await calendar.goToAnchor();
			const event = await calendar.createEvent({ title, start: fromAnchor(1, 9), end: fromAnchor(1, 10) });
			const before = listEventFiles(calendar.vaultDir).length;

			await undoRedoRoundTrip(calendar, {
				mutate: () => event.rightClick(item),
				mutated: () => calendar.expectEventCount(before + 1),
				baseline: () => calendar.expectEventCount(before),
			});
		});
	}

	test("moveBy — undo/redo reverts the custom-offset move", async ({ calendar }) => {
		await calendar.goToAnchor();
		const event = await calendar.createEvent({
			title: "MoveBy Probe",
			start: fromAnchor(1, 9),
			end: fromAnchor(1, 10),
		});
		const originalStart = event.readFrontmatter("Start Date");

		await undoRedoRoundTrip(calendar, {
			mutate: async () => {
				await event.rightClick("moveBy");
				const modal = calendar.page.locator(".prisma-move-by-modal").first();
				await modal.waitFor({ state: "visible" });
				await modal.locator(".prisma-move-by-input").first().fill("30");
				// Unit is selected via text-labeled buttons; default is "minutes" — no
				// change needed. Submit via the "Move" button rendered by the shared
				// createModalButtons helper (no testid, text is stable).
				await modal.locator("button", { hasText: /^Move$/ }).click();
				await modal.waitFor({ state: "hidden" });
			},
			mutated: () => event.expectFrontmatter("Start Date", (v) => v !== originalStart),
			baseline: () => event.expectFrontmatter("Start Date", (v) => v === originalStart),
		});
	});
});
