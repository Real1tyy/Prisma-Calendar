import { basename } from "node:path";

import { expect, test } from "../../fixtures/electron";
import {
	formatLocalDate,
	openCalendarReady,
	openCreateModal,
	snapshotEventFiles,
	waitForNewEventFiles,
} from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

// Five quick creates via the toolbar Create button — catches filename
// collisions and shared-state bugs that only show up under back-to-back
// creation.
test.describe("multiple events — isolation", () => {
	test("five create-button clicks produce five distinct files", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		const baseline = snapshotEventFiles(obsidian.vaultDir);

		const today = formatLocalDate(new Date());
		const titles = ["Event A", "Event B", "Event C", "Event D", "Event E"];
		for (let i = 0; i < titles.length; i++) {
			const hour = String(9 + i).padStart(2, "0");
			await openCreateModal(obsidian.page);
			await fillEventModal(obsidian.page, {
				title: titles[i]!,
				start: `${today}T${hour}:00`,
				end: `${today}T${hour}:30`,
			});
			await saveEventModal(obsidian.page);
		}

		const newFiles = await waitForNewEventFiles(obsidian.vaultDir, baseline, titles.length);
		expect(new Set(newFiles).size).toBe(titles.length);

		const basenames = newFiles.map((p) => basename(p));
		for (const title of titles) {
			expect(basenames.some((name) => name.startsWith(title))).toBe(true);
		}
	});
});
