import { unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { anchorISO, fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { eventBlockLocator } from "../events/events-helpers";

// External tools (Obsidian Sync, a second editor, Dropbox) can rewrite or
// remove an event file behind the plugin's back. The indexer subscribes to
// `vault.on("modify")` and `metadataCache.on("deleted")`, so the calendar
// must converge on its own — no user-facing refresh button. These specs
// simulate the external write with raw `node:fs` calls (bypassing Obsidian's
// APIs entirely) and then assert on the rendered FC layout — the same
// surface the user sees — until convergence is observable.

test.describe("integrations: external file mutation", () => {
	test("external rewrite of an event file is picked up automatically", async ({ calendar }) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const evt = await calendar.seedOnDisk("External Rewrite", {
			"Start Date": fromAnchor(0, 9, 0),
			"End Date": fromAnchor(0, 10, 0),
		});
		await evt.expectVisible();

		const absolutePath = join(calendar.vaultDir, evt.path);
		const updatedStart = fromAnchor(0, 14, 0);
		const updatedEnd = fromAnchor(0, 15, 0);
		writeFileSync(
			absolutePath,
			`---\nStart Date: ${updatedStart}\nEnd Date: ${updatedEnd}\n---\n\n# External Rewrite\n`,
			"utf8"
		);

		// The vault watcher must reposition the rendered tile from the 09:00
		// slot to the 14:00 slot. FC anchors a timed block's top edge to its
		// start-time slot lane, so polling until the block's `boundingBox().y`
		// aligns with the 14:00 lane's top is the user-observable convergence
		// signal — no peeking at the indexer or DOM data attributes.
		const block = eventBlockLocator(calendar.page, "External Rewrite").first();
		const targetSlot = calendar.page
			.locator(`.fc-timegrid-col[data-date="${anchorISO()}"]`)
			.locator('xpath=ancestor::*[contains(@class, "fc-timegrid-body")]')
			.locator('.fc-timegrid-slot-lane[data-time="14:00:00"]')
			.first();
		await expect
			.poll(
				async () => {
					const blockBox = await block.boundingBox();
					const slotBox = await targetSlot.boundingBox();
					if (!blockBox || !slotBox) return null;
					return Math.abs(blockBox.y - slotBox.y);
				},
				{ message: "rendered tile never repositioned to the 14:00 slot" }
			)
			.toBeLessThan(5);

		// Title is unchanged — convergence must produce one tile, not a
		// duplicated old/new pair.
		await expect(eventBlockLocator(calendar.page, "External Rewrite")).toHaveCount(1);
	});

	test("external delete of an event file removes the tile automatically", async ({ calendar }) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const evt = await calendar.seedOnDisk("Doomed Event", {
			"Start Date": fromAnchor(0, 11, 0),
			"End Date": fromAnchor(0, 12, 0),
		});
		await evt.expectVisible();

		unlinkSync(join(calendar.vaultDir, evt.path));

		// `metadataCache.on("deleted")` drops the indexer row, the reactive
		// subscription tears the tile down, FC repaints without it. Playwright's
		// `toHaveCount` auto-retries — that retry IS the convergence poll.
		await expect(eventBlockLocator(calendar.page, "Doomed Event")).toHaveCount(0);
	});
});
