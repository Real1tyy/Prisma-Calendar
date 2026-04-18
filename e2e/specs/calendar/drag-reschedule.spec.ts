import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { eventByTitle, gotoToday, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { dragByDelta } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("drag to reschedule", () => {
	test("dragging a timed block down shifts Start/End Date and preserves duration", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		const file = seedEvent(vaultDir, todayTimedEvent("Drag Me", 10, 11));

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Drag Me");

		const before = readEventFrontmatter(vaultDir, file);
		await dragByDelta(page, eventByTitle(page, "Drag Me"), 0, 120);

		await expect
			.poll(() => String(readEventFrontmatter(vaultDir, file)["Start Date"]) !== String(before["Start Date"]), {
				message: `Start Date did not change after drag of ${file}`,
			})
			.toBe(true);

		const after = readEventFrontmatter(vaultDir, file);
		const startBefore = Date.parse(String(before["Start Date"]).replace(" ", "T"));
		const endBefore = Date.parse(String(before["End Date"]).replace(" ", "T"));
		const startAfter = Date.parse(String(after["Start Date"]).replace(" ", "T"));
		const endAfter = Date.parse(String(after["End Date"]).replace(" ", "T"));
		expect(endAfter - startAfter).toBe(endBefore - startBefore);
	});
});
