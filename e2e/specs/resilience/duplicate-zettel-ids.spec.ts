import { expect } from "@playwright/test";

import { testResilience as test } from "../../fixtures/electron";
import { reloadAndWaitForPrisma, resolveByZettelId, vaultHasFilesEndingWith } from "../../fixtures/resilience-helpers";
import { seedEvent } from "../../fixtures/seed-events";

// Duplicate ZettelIDs arise when users copy-paste event files or from
// misbehaving sync clients. Both files should render (nothing silently
// dropped) and command handlers that resolve "the event" must surface all
// matches deterministically — not one, not neither.
test("duplicate ZettelID files all render and resolve", async ({ obsidian }) => {
	const ZETTEL_ID = "20260801120000";
	const files = [
		{ title: `Dup A-${ZETTEL_ID}`, startDate: "2026-08-10T09:00", endDate: "2026-08-10T10:00" },
		{ title: `Dup B-${ZETTEL_ID}`, startDate: "2026-08-11T14:00", endDate: "2026-08-11T15:00" },
	];
	for (const f of files) {
		seedEvent(obsidian.vaultDir, { ...f, extra: { ZettelID: ZETTEL_ID } });
	}

	await reloadAndWaitForPrisma(obsidian.page);

	const existence = await vaultHasFilesEndingWith(
		obsidian.page,
		files.map((f) => `${f.title}.md`)
	);
	expect(
		existence.every((e) => e),
		"both duplicate files should remain on disk"
	).toBe(true);

	// The metadata cache is populated asynchronously after reload — poll
	// rather than snapshotting immediately.
	await expect
		.poll(async () => (await resolveByZettelId(obsidian.page, ZETTEL_ID)).length, {
			message: "metadata cache should surface all duplicate ZettelID files",
		})
		.toBe(files.length);
});
