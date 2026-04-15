import { executeCommand, openNote } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../fixtures/electron";

test.describe("event edit", () => {
	test("reads a seeded event from disk", async ({ obsidian }) => {
		const content = obsidian.readVaultFile("Events/Team Meeting.md");
		expect(content).toContain("Team Meeting");
		expect(content).toContain("Start Date");
	});

	test("edit-active-note command runs against the open event", async ({ obsidian }) => {
		await openNote(obsidian.page, "Events/Team Meeting");
		const executed = await executeCommand(obsidian.page, "prisma-calendar:edit-current-note-as-event");
		expect(executed).toBe(true);
	});
});
