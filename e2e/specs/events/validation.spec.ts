import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { createEventViaModal, openCalendarReady } from "./events-helpers";

// Robustness canaries for the save path. The plugin currently accepts most
// inputs and writes them as-entered; these tests assert that — invalid inputs
// do not crash the modal, do not produce malformed YAML, and do not leave the
// calendar in an inconsistent state. If a real guard is added later (e.g. a
// Notice on end<start) the tests should be updated to assert the guard.
test.describe("event save — validation canaries", () => {
	test("saving with end before start persists both values and does not corrupt frontmatter", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const relativePath = await createEventViaModal(obsidian, {
			title: "Inverted Times",
			start: "2026-05-10T15:00",
			end: "2026-05-10T10:00",
		});

		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		expect(fm["Start Date"], "start should round-trip as entered").toBe("2026-05-10T15:00:00.000Z");
		expect(fm["End Date"], "end should round-trip as entered").toBe("2026-05-10T10:00:00.000Z");
	});

	test("saving with a blank title produces a readable file without crashing", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);

		const relativePath = await createEventViaModal(obsidian, {
			title: "",
			start: "2026-05-10T09:00",
			end: "2026-05-10T10:00",
		});

		const fm = readEventFrontmatter(obsidian.vaultDir, relativePath);
		expect(fm).toBeDefined();
		expect(fm["Start Date"]).toBe("2026-05-10T09:00:00.000Z");
		expect(relativePath.endsWith(".md")).toBe(true);
	});
});
