import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";
import { DateTime } from "luxon";

import { anchorISO } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar } from "../../fixtures/seed-events";
import { eventBlockLocator } from "./events-helpers";

// Drag a timed block in week view from its 09:00 slot to the 14:00 slot in
// the anchor day's column. FC's EventDragging computes the date delta from
// the hits at mousedown and mouseup — clicking inside the event's top row
// and releasing on the target slot yields a clean +5h shift, so the written
// Start/End are deterministic (14:00→15:00). The plugin writes via
// `toLocalISOString` + `ensureISOSuffix`, producing the `.000Z` suffix even
// though the value is local wall-clock time.
//
// Seeded and navigated against `anchorISO()` (past-Wednesday) so the target
// day-column is always inside the rendered week regardless of what day of
// the week the suite runs on — see `docs/specs/e2e-date-anchor-robustness.md`.
test.describe("drag event → move", () => {
	test("drag a timed block 5 hours down shifts Start/End by exactly that delta", async ({ calendar }) => {
		const anchor = anchorISO();
		const seedPath = "Events/Movable Event-20250101000000.md";
		// Seed with the exact storage format the plugin emits after a drag so
		// the written Start/End strings match byte-for-byte without format
		// churn through `ensureISOSuffix`.
		writeFileSync(
			join(calendar.vaultDir, seedPath),
			`---
Start Date: ${anchor}T09:00:00.000Z
End Date: ${anchor}T10:00:00.000Z
---

# Movable Event
`,
			"utf8"
		);
		await refreshCalendar(calendar.page);

		await calendar.switchMode("week");
		await calendar.goToAnchor();
		const movable = await calendar.eventByTitle("Movable Event");
		await movable.expectVisible();

		const block = eventBlockLocator(calendar.page, "Movable Event").first();
		const blockBox = await block.boundingBox();
		expect(blockBox).not.toBeNull();
		if (!blockBox) return;

		const targetSlot = calendar.page.locator('.fc-timegrid-slot-lane[data-time="14:00:00"]').first();
		const anchorCol = calendar.page.locator(`.fc-timegrid-col[data-date="${anchor}"]`).first();
		await targetSlot.waitFor({ state: "visible" });
		const slotBox = await targetSlot.boundingBox();
		const colBox = await anchorCol.boundingBox();
		expect(slotBox).not.toBeNull();
		expect(colBox, "anchor day's timed column should be present").not.toBeNull();
		if (!slotBox || !colBox) return;

		// Grab a few pixels below the block top so the mousedown hit lands
		// inside the 09:00 row rather than straddling the 09:30 boundary at
		// block center (blockBox.height spans 09:00→10:00).
		const pickupX = blockBox.x + blockBox.width / 2;
		const pickupY = blockBox.y + 5;
		const dropX = colBox.x + colBox.width / 2;
		const dropY = slotBox.y + slotBox.height / 2;

		await calendar.page.mouse.move(pickupX, pickupY);
		await calendar.page.mouse.down();
		await calendar.page.waitForTimeout(50);
		// Jitter past FC's eventDragMinDistance so dragstart fires; otherwise
		// the interaction degrades to a click and eventDrop never runs.
		await calendar.page.mouse.move(pickupX + 8, pickupY, { steps: 4 });
		await calendar.page.mouse.move(dropX, dropY, { steps: 25 });
		await calendar.page.waitForTimeout(100);
		await calendar.page.mouse.up();

		await movable.expectFrontmatter("Start Date", (v) => v === `${anchor}T14:00:00.000Z`);

		const fm = readEventFrontmatter(calendar.vaultDir, seedPath);
		expect(String(fm["Start Date"]), "Start Date must be exactly the drop slot time").toBe(`${anchor}T14:00:00.000Z`);
		expect(String(fm["End Date"]), "End Date must be drop slot time + original 60 min duration").toBe(
			`${anchor}T15:00:00.000Z`
		);

		const start = DateTime.fromISO(String(fm["Start Date"]), { zone: "utc" });
		const end = DateTime.fromISO(String(fm["End Date"]), { zone: "utc" });
		expect(start.isValid).toBe(true);
		expect(end.isValid).toBe(true);
		expect(end.diff(start, "minutes").minutes, "duration must round-trip at 60 min").toBe(60);
	});
});
