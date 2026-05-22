import type { Page } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { PRISMA_TOUR_STEP_IDS, SAMPLE_EVENT_TITLE } from "../../src/react/onboarding/tour-constants";
import { expect } from "./electron";
import { eventTileByTitle, sel, TOUR_NEXT_TID, TOUR_PROGRESS_TID, TOUR_TOOLTIP_TID } from "./testids";

/** Step ids + title come straight from src so the DSL can never drift from the tour. */
export { SAMPLE_EVENT_TITLE };
export const TOUR_STEP_IDS = PRISMA_TOUR_STEP_IDS;
export const TOUR_STEP_COUNT = TOUR_STEP_IDS.length;
export const SAMPLE_EVENT_TILE = eventTileByTitle(SAMPLE_EVENT_TITLE);

/** Click Next from the current step until the tour shows `step / TOUR_STEP_COUNT`. */
export async function advanceTourTo(page: Page, step: number): Promise<void> {
	const next = page.locator(sel(TOUR_NEXT_TID));
	for (let s = 2; s <= step; s++) {
		await next.click();
		await expect(page.locator(sel(TOUR_PROGRESS_TID))).toHaveText(`${s} / ${TOUR_STEP_COUNT}`);
	}
}

// Candidate hours to drop the event on, in preference order. All are within the
// default-scrolled visible range of the week view and away from the 10:00 seed.
const DROP_TIME_CANDIDATES = ["14:00:00", "08:00:00", "15:00:00", "07:00:00", "16:00:00"];

/**
 * Drag the highlighted sample event to a different time *within its own day-column*
 * and return the file + the Start-Date substring it should now contain. Dragging
 * vertically (same column) avoids FullCalendar's drag-to-edge week navigation that
 * a horizontal cross-day drag triggers, and the target slot is picked clear of the
 * floating tour tooltip. The drag only reaches the grid because the "drag-and-drop"
 * step removed the blocking overlay (interaction: "page"). Caller asserts the
 * resulting on-disk Start Date.
 */
export async function dragSampleEventToNewTime(
	page: Page,
	vaultDir: string
): Promise<{ filePath: string; expectedStart: string }> {
	const tile = page.locator(SAMPLE_EVENT_TILE).first();
	await expect(tile).toBeVisible();
	const filePath = await tile.getAttribute("data-event-file-path");
	if (!filePath) throw new Error("sample event tile is missing data-event-file-path");
	const dayPart = String(readEventFrontmatter(vaultDir, filePath)["Start Date"]).slice(0, 10);

	const blockBox = await tile.boundingBox();
	if (!blockBox) throw new Error("could not resolve the sample event geometry");
	const tooltipBox = await page.locator(sel(TOUR_TOOLTIP_TID)).boundingBox();
	const pickupX = blockBox.x + blockBox.width / 2;
	const pickupY = blockBox.y + 5;

	const clearsTooltip = (y: number): boolean =>
		!tooltipBox ||
		pickupX < tooltipBox.x ||
		pickupX > tooltipBox.x + tooltipBox.width ||
		y < tooltipBox.y ||
		y > tooltipBox.y + tooltipBox.height;

	let dropY: number | undefined;
	let targetTime: string | undefined;
	for (const time of DROP_TIME_CANDIDATES) {
		const lane = await page.locator(`.fc-timegrid-slot-lane[data-time="${time}"]`).first().boundingBox();
		if (!lane) continue;
		const y = lane.y + lane.height / 2;
		if (clearsTooltip(y)) {
			dropY = y;
			targetTime = time.slice(0, 5);
			break;
		}
	}
	if (dropY === undefined || !targetTime) throw new Error("no time slot clear of the tour tooltip to drag onto");

	await page.mouse.move(pickupX, pickupY);
	await page.mouse.down();
	await page.waitForTimeout(50);
	// Jitter past FC's eventDragMinDistance so dragstart fires instead of a click.
	await page.mouse.move(pickupX, pickupY + 8, { steps: 4 });
	await page.mouse.move(pickupX, dropY, { steps: 25 });
	await page.waitForTimeout(100);
	await page.mouse.up();

	return { filePath, expectedStart: `${dayPart}T${targetTime}` };
}
