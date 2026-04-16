import { expect, test } from "../../fixtures/electron";
import {
	EVENT_MODAL_SELECTOR,
	expectEventVisible,
	openCalendarReady,
	snapshotEventFiles,
	switchToWeekView,
	waitForNewEventFiles,
} from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

// Drag-select on FullCalendar's time grid must open the event modal with the
// selected range pre-filled, accept a title, and render the saved block back
// into the grid. The drag path is a real workflow — users drag across slots
// to pick a time range, not type dates into inputs.
test.describe("create event — from calendar drag", () => {
	test("drag on time grid pre-fills start/end and renders saved block", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		await switchToWeekView(obsidian.page);

		const slot = obsidian.page.locator(".fc-timegrid-slot-lane").first();
		await slot.waitFor({ state: "visible", timeout: 15_000 });

		const slotBox = await slot.boundingBox();
		expect(slotBox).not.toBeNull();
		if (!slotBox) return;

		const baseline = snapshotEventFiles(obsidian.vaultDir);
		const startX = slotBox.x + slotBox.width / 2;
		const startY = slotBox.y + 2;
		const endY = slotBox.y + slotBox.height * 2;

		await obsidian.page.mouse.move(startX, startY);
		await obsidian.page.mouse.down();
		await obsidian.page.mouse.move(startX, endY, { steps: 10 });
		await obsidian.page.mouse.up();

		const modal = obsidian.page.locator(EVENT_MODAL_SELECTOR);
		await modal.waitFor({ state: "attached", timeout: 15_000 });
		await modal.waitFor({ state: "visible", timeout: 15_000 });

		const start = await obsidian.page.locator('[data-testid="prisma-event-control-start"]').inputValue();
		expect(start).not.toBe("");

		const end = await obsidian.page.locator('[data-testid="prisma-event-control-end"]').inputValue();
		expect(end).not.toBe("");

		await fillEventModal(obsidian.page, { title: "Dragged Event" });
		await saveEventModal(obsidian.page);
		await waitForNewEventFiles(obsidian.vaultDir, baseline, 1);

		await expectEventVisible(obsidian.page, "Dragged Event");
	});
});
