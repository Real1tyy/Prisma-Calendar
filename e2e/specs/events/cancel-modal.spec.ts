import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import {
	EVENT_MODAL_SELECTOR,
	formatLocalDate,
	listEventFiles,
	openCreateModal,
	snapshotEventFiles,
	waitForModalClosed,
} from "./events-helpers";
import { fillEventModal } from "./fill-event-modal";

const QUIESCE_MS = 1_000;

// Cancel/Esc paths must be no-ops on disk. A user who second-guesses mid-edit
// expects the vault to be exactly what it was before — no stray files, no
// partial frontmatter writes, no indexer drift.
test.describe("cancel / escape", () => {
	test("Cancel on create modal writes no new file", async ({ calendar }) => {
		const baseline = snapshotEventFiles(calendar.vaultDir);

		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Abandoned Draft",
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 10, 0),
		});
		await calendar.page.locator(sel(TID.event.btn("cancel"))).click();
		await waitForModalClosed(calendar.page);

		await calendar.page.waitForTimeout(QUIESCE_MS);
		const current = new Set(listEventFiles(calendar.vaultDir, "Events"));
		const added = [...current].filter((p) => !baseline.has(p));
		expect(added, "cancel path must not produce any new event files").toEqual([]);
	});

	test("Escape on create modal writes no new file", async ({ calendar }) => {
		const baseline = snapshotEventFiles(calendar.vaultDir);

		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Escaped Draft",
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 10, 0),
		});
		await calendar.page.keyboard.press("Escape");
		await waitForModalClosed(calendar.page);

		await calendar.page.waitForTimeout(QUIESCE_MS);
		const current = new Set(listEventFiles(calendar.vaultDir, "Events"));
		const added = [...current].filter((p) => !baseline.has(p));
		expect(added, "escape must not persist any event file").toEqual([]);
	});

	test("Cancel on edit modal leaves frontmatter unchanged", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const evt = await calendar.seedOnDisk("Original Event", {
			"Start Date": `${today}T09:00`,
			"End Date": `${today}T10:00`,
			Location: "Room A",
		});

		await evt.expectVisible();

		const originalFm = readEventFrontmatter(calendar.vaultDir, evt.path);

		await evt.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		await fillEventModal(calendar.page, { location: "Room Z — canceled change" });
		await calendar.page.locator(sel(TID.event.btn("cancel"))).click();
		await waitForModalClosed(calendar.page);

		await calendar.page.waitForTimeout(QUIESCE_MS);
		expectFrontmatter(calendar.vaultDir, evt.path, {
			Location: String(originalFm["Location"] ?? ""),
		});
	});
});
