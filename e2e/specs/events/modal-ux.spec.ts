import { readFileSync } from "node:fs";
import { join } from "node:path";

import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";
import {
	createEventViaModal,
	EVENT_MODAL_SELECTOR,
	formatLocalDate,
	listEventFiles,
	openCalendarReady,
	openCreateModal,
	rightClickEventMenu,
	snapshotEventFiles,
} from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

const MINIMIZE_BUTTON = '[data-testid="prisma-event-btn-minimize"]';

test.describe("event modal UX", () => {
	test("minimize then Restore minimized event modal preserves title and start time", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const today = formatLocalDate(new Date());
		await openCreateModal(obsidian.page);
		await fillEventModal(obsidian.page, {
			title: "Minimize Roundtrip",
			start: `${today}T09:00`,
			end: `${today}T10:00`,
		});

		await obsidian.page.locator(MINIMIZE_BUTTON).first().click();
		// Modal hides — the Title input disappears from DOM because the modal
		// is unmounted on minimize (state is held in MinimizedModalManager).
		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "detached", timeout: 10_000 });

		await runCommand(obsidian.page, "Prisma Calendar: Restore minimized event modal");

		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 10_000 });
		await expect(obsidian.page.locator('[data-testid="prisma-event-control-title"]').first()).toHaveValue(
			"Minimize Roundtrip"
		);
		await expect(obsidian.page.locator('[data-testid="prisma-event-control-start"]').first()).toHaveValue(
			`${today}T09:00`
		);
	});

	test("creating two events with the same title yields two distinct files", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		const today = formatLocalDate(new Date());

		const baseline = snapshotEventFiles(obsidian.vaultDir);
		await createEventViaModal(obsidian, {
			title: "Duplicate Title",
			start: `${today}T09:00`,
			end: `${today}T10:00`,
		});
		await createEventViaModal(obsidian, {
			title: "Duplicate Title",
			start: `${today}T11:00`,
			end: `${today}T12:00`,
		});

		const allFiles = listEventFiles(obsidian.vaultDir).filter((p) => !baseline.has(p));
		expect(allFiles.length).toBe(2);
		expect(new Set(allFiles).size).toBe(2);

		// Both files should be recognisably distinct on disk — the zettel suffix
		// differs. Read raw content and confirm no collision occurred.
		const bodies = allFiles.map((abs) => readFileSync(abs, "utf8"));
		expect(bodies[0]).not.toBe(bodies[1]);
	});

	test("toggling All Day on a timed event hides Start/End and shows Date; toggling off restores timed controls", async ({
		obsidian,
	}) => {
		const today = formatLocalDate(new Date());
		const relativePath = await (async () => {
			await openCalendarReady(obsidian.page);
			return createEventViaModal(obsidian, {
				title: "Mode Toggle",
				start: `${today}T09:00`,
				end: `${today}T10:00`,
			});
		})();

		await rightClickEventMenu(obsidian.page, "Mode Toggle", "editEvent");
		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 15_000 });

		// Flip All Day ON → Start/End become non-functional; Date input appears.
		await fillEventModal(obsidian.page, { allDay: true, date: today });
		await obsidian.page.locator('[data-testid="prisma-event-control-date"]').first().waitFor({ state: "visible" });
		await saveEventModal(obsidian.page);

		await expect
			.poll(() => String(readFileSync(join(obsidian.vaultDir, relativePath), "utf8")), { timeout: 10_000 })
			.toContain("All Day: true");

		// Reopen and flip All Day OFF.
		await rightClickEventMenu(obsidian.page, "Mode Toggle", "editEvent");
		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 15_000 });

		await fillEventModal(obsidian.page, { allDay: false, start: `${today}T14:00`, end: `${today}T15:00` });
		await saveEventModal(obsidian.page);

		const after = readFileSync(join(obsidian.vaultDir, relativePath), "utf8");
		expect(after).toContain(`${today}T14:00`);
		expect(after).toContain(`${today}T15:00`);
	});
});
