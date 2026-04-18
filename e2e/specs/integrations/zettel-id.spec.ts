import { readdirSync } from "node:fs";
import { join } from "node:path";

import { openNote } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { seedEvent } from "../../fixtures/seed-events";

// `add-zettel-id-to-current-note` renames the active file to
// `<title>-<zettelId>.md` and writes the ZettelID to frontmatter.
// Re-running on an already-stamped note must be a no-op.

const EVENTS_DIR = "Events";

function listEvents(vaultDir: string): string[] {
	return readdirSync(join(vaultDir, EVENTS_DIR));
}

test.describe("zettel ID", () => {
	let originalRelative: string;

	test.beforeEach(async ({ calendar }) => {
		originalRelative = seedEvent(calendar.vaultDir, {
			title: "Stand-up",
			startDate: "2026-05-10T09:00",
			endDate: "2026-05-10T09:15",
		});
	});

	test("adds a 14-digit ID to filename and re-running is idempotent", async ({ calendar }) => {
		await openNote(calendar.page, originalRelative.replace(/\.md$/, ""));

		await calendar.runCommand("Prisma Calendar: Add ZettelID to current note");

		await expect.poll(() => listEvents(calendar.vaultDir).find((f) => /^Stand-up-\d{14}\.md$/.test(f))).toBeDefined();

		const renamed = listEvents(calendar.vaultDir).find((f) => /^Stand-up-\d{14}\.md$/.test(f))!;
		const newId = renamed.match(/-(\d{14})\.md$/)![1];

		await openNote(calendar.page, `${EVENTS_DIR}/${renamed.replace(/\.md$/, "")}`);
		await calendar.runCommand("Prisma Calendar: Add ZettelID to current note");

		const filesAfter = listEvents(calendar.vaultDir);
		expect(filesAfter.filter((f) => f.startsWith("Stand-up-"))).toHaveLength(1);
		expect(filesAfter).toContain(`Stand-up-${newId}.md`);
	});
});
