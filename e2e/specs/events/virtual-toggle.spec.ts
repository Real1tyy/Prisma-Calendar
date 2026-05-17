import type { Page } from "@playwright/test";

import { PLUGIN_ID } from "../../fixtures/constants";
import { fromAnchor } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { sel, TID } from "../../fixtures/testids";
import type { PrismaPlugin, PrismaWindow } from "../../fixtures/window-types";
import { listEventFiles, openCreateModal, snapshotEventFiles, waitForModalClosed } from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

// Parity guard for the Virtual toggle on the event create modal. The
// imperative BaseEventModal branched on the `Virtual` checkbox state and
// routed through `bundle.createVirtualEvent` instead of `bundle.createEvent`;
// the React port carries that branch in `handleCreateSubmit`
// (event-create-modal.tsx). These specs prove the routing still holds — no
// .md file under Events/, and the new event lands in `virtualEventStore`.

function readVirtualEventTitles(page: Page): Promise<string[]> {
	return page.evaluate((pid: string) => {
		const w = window as unknown as PrismaWindow;
		const bundle = (w.app.plugins.plugins[pid] as PrismaPlugin | undefined)?.calendarBundles?.[0];
		if (!bundle) throw new Error("bundle missing");
		return bundle.virtualEventStore.getAll().map((v: { title: string }) => v.title);
	}, PLUGIN_ID);
}

test.describe("event modal — Virtual toggle", () => {
	test("creating with Virtual toggle ON writes to virtualEventStore, not Events/", async ({ calendar }) => {
		const baseline = snapshotEventFiles(calendar.vaultDir);

		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Virtual Sync",
			start: fromAnchor(0, 14, 0),
			end: fromAnchor(0, 14, 30),
		});
		// The Virtual toggle lives in the modal header — it's not exposed by
		// `fillEventModal` so drive it directly here.
		await calendar.page
			.locator(sel(TID.event.control("virtual")))
			.first()
			.click();

		await saveEventModal(calendar.page);
		await waitForModalClosed(calendar.page);

		// Give the create-virtual command a moment to flush before counting on
		// disk. The store update is synchronous in-memory; the markdown file is
		// debounced. We assert via the store path which is the authoritative
		// signal for "the event exists".
		await expect.poll(() => readVirtualEventTitles(calendar.page)).toContain("Virtual Sync");

		// No new physical .md file should have appeared under Events/ — the
		// Virtual Events.md sentinel is excluded by listEventFiles.
		const after = new Set(listEventFiles(calendar.vaultDir));
		const added = [...after].filter((p) => !baseline.has(p));
		expect(added, "virtual create must NOT write a physical event file").toEqual([]);
	});

	test("creating with Virtual toggle OFF still writes a physical file (control case)", async ({ calendar }) => {
		const baseline = snapshotEventFiles(calendar.vaultDir);

		await openCreateModal(calendar.page);
		await fillEventModal(calendar.page, {
			title: "Real Sync",
			start: fromAnchor(0, 15, 0),
			end: fromAnchor(0, 15, 30),
		});
		// Virtual toggle stays unchecked.
		await saveEventModal(calendar.page);
		await waitForModalClosed(calendar.page);

		await expect.poll(() => listEventFiles(calendar.vaultDir).filter((p) => !baseline.has(p)).length).toBe(1);

		// And the new event does NOT land in the virtual store.
		expect(await readVirtualEventTitles(calendar.page)).not.toContain("Real Sync");
	});
});
