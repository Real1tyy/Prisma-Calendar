import { readFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import {
	createEventViaModal,
	EVENT_MODAL_SELECTOR,
	formatLocalDate,
	listEventFiles,
	openCreateModal,
	rightClickEventMenu,
	snapshotEventFiles,
} from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

test.describe("event modal UX", () => {
	test("minimize then Restore minimized event modal preserves title and start time", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Minimize Roundtrip",
			start: `${today}T09:00`,
			end: `${today}T10:00`,
		});

		await calendar.page
			.locator(sel(TID.event.btn("minimize")))
			.first()
			.click();
		// Modal hides — the Title input disappears from DOM because the modal
		// is unmounted on minimize (state is held in MinimizedModalManager).
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "detached" });

		await calendar.runCommand("Prisma Calendar: Restore minimized event modal");

		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });
		await expect(calendar.page.locator(sel(TID.event.control("title"))).first()).toHaveValue("Minimize Roundtrip");
		await expect(calendar.page.locator(sel(TID.event.control("start"))).first()).toHaveValue(`${today}T09:00`);
	});

	test("creating two events with the same title yields two distinct files", async ({ calendar, obsidian }) => {
		const today = formatLocalDate(new Date());

		const baseline = snapshotEventFiles(calendar.vaultDir);
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

		const allFiles = listEventFiles(calendar.vaultDir).filter((p) => !baseline.has(p));
		expect(allFiles.length).toBe(2);
		expect(new Set(allFiles).size).toBe(2);

		// Both files should be recognisably distinct on disk — the zettel suffix
		// differs. Read raw content and confirm no collision occurred.
		const bodies = allFiles.map((abs) => readFileSync(abs, "utf8"));
		expect(bodies[0]).not.toBe(bodies[1]);
	});

	test("toggling All Day on a timed event hides Start/End and shows Date; toggling off restores timed controls", async ({
		calendar,
		obsidian,
	}) => {
		const today = formatLocalDate(new Date());
		const relativePath = await createEventViaModal(obsidian, {
			title: "Mode Toggle",
			start: `${today}T09:00`,
			end: `${today}T10:00`,
		});

		await rightClickEventMenu(calendar.page, "Mode Toggle", "editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		// Flip All Day ON → Start/End become non-functional; Date input appears.
		await fillEventModal(calendar.page, { allDay: true, date: today });
		await calendar.page
			.locator(sel(TID.event.control("date")))
			.first()
			.waitFor({ state: "visible" });
		await saveEventModal(calendar.page);

		await expect
			.poll(() => String(readFileSync(join(calendar.vaultDir, relativePath), "utf8")))
			.toContain("All Day: true");

		// Reopen and flip All Day OFF.
		await rightClickEventMenu(calendar.page, "Mode Toggle", "editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		await fillEventModal(calendar.page, { allDay: false, start: `${today}T14:00`, end: `${today}T15:00` });
		await saveEventModal(calendar.page);

		const after = readFileSync(join(calendar.vaultDir, relativePath), "utf8");
		expect(after).toContain(`${today}T14:00`);
		expect(after).toContain(`${today}T15:00`);
	});
});
