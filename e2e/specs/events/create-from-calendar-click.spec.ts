import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import { EVENT_MODAL_SELECTOR, snapshotEventFiles, waitForNewEventFiles } from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

// Drag-select on FullCalendar's time grid must open the event modal with the
// selected range pre-filled, accept a title, and render the saved block back
// into the grid. The drag path is a real workflow — users drag across slots
// to pick a time range, not type dates into inputs.
test.describe("create event — from calendar drag", () => {
	test("drag on time grid pre-fills start/end and renders saved block", async ({ calendar }) => {
		await calendar.switchMode("week");

		const slot = calendar.page.locator(".fc-timegrid-slot-lane").first();
		await slot.waitFor({ state: "visible" });

		const slotBox = await slot.boundingBox();
		expect(slotBox).not.toBeNull();
		if (!slotBox) return;

		const baseline = snapshotEventFiles(calendar.vaultDir);
		const startX = slotBox.x + slotBox.width / 2;
		const startY = slotBox.y + 2;
		const endY = slotBox.y + slotBox.height * 2;

		await calendar.page.mouse.move(startX, startY);
		await calendar.page.mouse.down();
		await calendar.page.mouse.move(startX, endY, { steps: 10 });
		await calendar.page.mouse.up();

		const modal = calendar.page.locator(EVENT_MODAL_SELECTOR);
		await modal.waitFor({ state: "attached" });
		await modal.waitFor({ state: "visible" });

		await expect(calendar.page.locator(sel(TID.event.control("start")))).not.toHaveValue("");
		await expect(calendar.page.locator(sel(TID.event.control("end")))).not.toHaveValue("");

		await fillEventModal(calendar.page, { title: "Dragged Event" });
		await saveEventModal(calendar.page);
		await waitForNewEventFiles(calendar.vaultDir, baseline, 1);

		const evt = await calendar.eventByTitle("Dragged Event");
		await evt.expectVisible();
	});
});
