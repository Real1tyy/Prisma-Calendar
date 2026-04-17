import { expect } from "@playwright/test";

import { testResilience as test } from "../../fixtures/electron";
import { createEventViaToolbar, fillEventModalMinimal, openCalendarViewViaRibbon } from "../../fixtures/helpers";
import { reloadAndWaitForPrisma } from "../../fixtures/resilience-helpers";
import { listEventFiles } from "../events/events-helpers";

// Reloading mid-edit must NOT write a partial file to the vault. The user may
// have typed a title into the modal but never clicked "Save" — that draft is
// ephemeral and should simply be dropped, leaving the events folder untouched.
test("open modal, type title, reload → no partial file written", async ({ obsidian }) => {
	await openCalendarViewViaRibbon(obsidian.page);
	const before = listEventFiles(obsidian.vaultDir)
		.map((p) => p.split("/").pop() ?? "")
		.sort();

	await createEventViaToolbar(obsidian.page);
	await fillEventModalMinimal(obsidian.page, { title: "Draft That Will Be Discarded" });

	await reloadAndWaitForPrisma(obsidian.page);

	const after = listEventFiles(obsidian.vaultDir)
		.map((p) => p.split("/").pop() ?? "")
		.sort();
	expect(after).toEqual(before);
	expect(after.some((n) => n.toLowerCase().includes("draft that will be discarded"))).toBe(false);
});
