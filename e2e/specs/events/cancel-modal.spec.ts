import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	CANCEL_BUTTON_SELECTOR,
	EVENT_MODAL_SELECTOR,
	formatLocalDate,
	listEventFiles,
	openCalendarReady,
	openCreateModal,
	rightClickEventMenu,
	seedEventFile,
	snapshotEventFiles,
	waitForModalClosed,
} from "./events-helpers";
import { fillEventModal } from "./fill-event-modal";

const QUIESCE_MS = 1_000;

// Cancel/Esc paths must be no-ops on disk. A user who second-guesses mid-edit
// expects the vault to be exactly what it was before — no stray files, no
// partial frontmatter writes, no indexer drift.
test.describe("cancel / escape", () => {
	test("Cancel on create modal writes no new file", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		const baseline = snapshotEventFiles(obsidian.vaultDir);

		await openCreateModal(obsidian.page);
		await fillEventModal(obsidian.page, {
			title: "Abandoned Draft",
			start: "2026-05-10T09:00",
			end: "2026-05-10T10:00",
		});
		await obsidian.page.locator(CANCEL_BUTTON_SELECTOR).click();
		await waitForModalClosed(obsidian.page);

		await obsidian.page.waitForTimeout(QUIESCE_MS);
		const current = new Set(listEventFiles(obsidian.vaultDir, "Events"));
		const added = [...current].filter((p) => !baseline.has(p));
		expect(added, "cancel path must not produce any new event files").toEqual([]);
	});

	test("Escape on create modal writes no new file", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		const baseline = snapshotEventFiles(obsidian.vaultDir);

		await openCreateModal(obsidian.page);
		await fillEventModal(obsidian.page, { title: "Escaped Draft", start: "2026-05-10T09:00", end: "2026-05-10T10:00" });
		await obsidian.page.keyboard.press("Escape");
		await waitForModalClosed(obsidian.page);

		await obsidian.page.waitForTimeout(QUIESCE_MS);
		const current = new Set(listEventFiles(obsidian.vaultDir, "Events"));
		const added = [...current].filter((p) => !baseline.has(p));
		expect(added, "escape must not persist any event file").toEqual([]);
	});

	test("Cancel on edit modal leaves frontmatter unchanged", async ({ obsidian }) => {
		const today = formatLocalDate(new Date());
		const seedPath = seedEventFile(obsidian.vaultDir, "Original Event", {
			"Start Date": `${today}T09:00`,
			"End Date": `${today}T10:00`,
			Location: "Room A",
		});

		await openCalendarReady(obsidian.page);
		await obsidian.page
			.locator(".fc-event", { hasText: "Original Event" })
			.first()
			.waitFor({ state: "visible", timeout: 15_000 });

		const originalFm = readEventFrontmatter(obsidian.vaultDir, seedPath);

		await rightClickEventMenu(obsidian.page, "Original Event", "editEvent");
		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 15_000 });

		await fillEventModal(obsidian.page, { location: "Room Z — canceled change" });
		await obsidian.page.locator(CANCEL_BUTTON_SELECTOR).click();
		await waitForModalClosed(obsidian.page);

		await obsidian.page.waitForTimeout(QUIESCE_MS);
		expectFrontmatter(obsidian.vaultDir, seedPath, {
			Location: String(originalFm["Location"] ?? ""),
		});
	});
});
