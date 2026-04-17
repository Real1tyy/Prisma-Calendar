import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { eventByTitle, gotoToday, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("resize to change duration", () => {
	test("dragging the bottom edge of an event extends End Date", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		const file = seedEvent(vaultDir, todayTimedEvent("Resize Me", 9, 10));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Resize Me");

		const before = readEventFrontmatter(vaultDir, file);
		const block = eventByTitle(page, "Resize Me");
		await block.hover();
		const box = await block.boundingBox();
		if (!box) throw new Error("Resize Me block has no bounding box");

		// FullCalendar's resize handle lives in the thin strip along the
		// bottom edge of the event block. Drag from 1px above the bottom
		// straight down to grow the block by ~2h on a default 30m-slot
		// timeGridDay view.
		const startX = box.x + box.width / 2;
		const startY = box.y + box.height - 2;
		await page.mouse.move(startX, startY);
		await page.mouse.down();
		const steps = 20;
		for (let i = 1; i <= steps; i++) {
			await page.mouse.move(startX, startY + (120 * i) / steps);
			// Gesture pacing — FullCalendar requires ≥1 frame between moves
			// for its resize listener to debounce properly.
			await page.waitForTimeout(15);
		}
		await page.mouse.up();

		await expect
			.poll(() => String(readEventFrontmatter(vaultDir, file)["End Date"]) !== String(before["End Date"]), {
				timeout: 8_000,
				message: `End Date did not change after resize of ${file}`,
			})
			.toBe(true);

		const endBefore = Date.parse(String(before["End Date"]).replace(" ", "T"));
		const endAfter = Date.parse(String(readEventFrontmatter(vaultDir, file)["End Date"]).replace(" ", "T"));
		expect(endAfter).toBeGreaterThan(endBefore);
	});
});
