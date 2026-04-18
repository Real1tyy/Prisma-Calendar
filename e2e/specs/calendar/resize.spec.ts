import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { eventByTitle, gotoToday, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { boundingBoxOrThrow, drag } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("resize to change duration", () => {
	test("dragging the bottom edge of an event extends End Date", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		const file = seedEvent(vaultDir, todayTimedEvent("Resize Me", 9, 10));

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Resize Me");

		const before = readEventFrontmatter(vaultDir, file);
		const block = eventByTitle(page, "Resize Me");
		await block.hover();
		const box = await boundingBoxOrThrow(block, "Resize Me block");

		// FullCalendar's resize handle lives in the thin strip along the
		// bottom edge of the event block. Stepped drag from 1px above the
		// bottom straight down grows the block by ~2h on a default 30m-slot
		// timeGridDay view.
		const startX = box.x + box.width / 2;
		const startY = box.y + box.height - 2;
		await drag(page, { x: startX, y: startY }, { x: startX, y: startY + 120 }, { mode: "stepped", steps: 20 });

		await expect
			.poll(() => String(readEventFrontmatter(vaultDir, file)["End Date"]) !== String(before["End Date"]), {
				message: `End Date did not change after resize of ${file}`,
			})
			.toBe(true);

		const endBefore = Date.parse(String(before["End Date"]).replace(" ", "T"));
		const endAfter = Date.parse(String(readEventFrontmatter(vaultDir, file)["End Date"]).replace(" ", "T"));
		expect(endAfter).toBeGreaterThan(endBefore);
	});
});
