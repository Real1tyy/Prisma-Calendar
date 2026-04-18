import { expect } from "@playwright/test";

import { testResilience as test } from "../../fixtures/electron";
import { createEventViaToolbar, fillEventModalMinimal } from "../../fixtures/helpers";
import { reloadAndWaitForPrisma } from "../../fixtures/resilience-helpers";
import { listEventFiles } from "../events/events-helpers";

// Reloading mid-edit must NOT write a partial file to the vault. The user may
// have typed a title into the modal but never clicked "Save" — that draft is
// ephemeral and should simply be dropped, leaving the events folder untouched.
test("open modal, type title, reload → no partial file written", async ({ calendar }) => {
	const before = listEventFiles(calendar.vaultDir)
		.map((p) => p.split("/").pop() ?? "")
		.sort();

	await createEventViaToolbar(calendar.page);
	await fillEventModalMinimal(calendar.page, { title: "Draft That Will Be Discarded" });

	await reloadAndWaitForPrisma(calendar.page);

	const after = listEventFiles(calendar.vaultDir)
		.map((p) => p.split("/").pop() ?? "")
		.sort();
	expect(after).toEqual(before);
	expect(after.some((n) => n.toLowerCase().includes("draft that will be discarded"))).toBe(false);
});
