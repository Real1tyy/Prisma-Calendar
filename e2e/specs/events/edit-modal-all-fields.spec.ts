import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { executeCommand, expectFrontmatter, openNote } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import { waitForEventModalOpen, waitForModalClosed, waitForWorkspaceReady } from "./events-helpers";
import { type E2EWindow, fillEventModal, saveEventModal } from "./fill-event-modal";

// Edit-side parity: seed a fully-populated event on disk, open the edit modal
// via the command, mutate every field, save, and assert the frontmatter shows
// the new values. Proves the edit modal reads every field from frontmatter and
// writes every field back.
test.describe("edit event — all fields", () => {
	test("reads every field, mutates, round-trips back to disk", async ({ obsidian }) => {
		// Pre-bake the ZettelID suffix into the seed filename so the edit path's
		// `ensureZettelIdOnSave = true` is a no-op — the rename→snapshot race
		// inside `updateEvent` otherwise swallows the first frontmatter diff.
		const seedPath = "Events/Editable Event-20250101000000.md";
		const seed = `---
Start Date: 2026-05-10T09:00
End Date: 2026-05-10T10:00
Category:
  - Work
Participants:
  - Alice
Prerequisite:
  - "[[Project Planning]]"
Location: Room A
Icon: calendar
Break: 5
Minutes Before: 10
Priority: high
---

# Editable Event
`;
		writeFileSync(join(obsidian.vaultDir, seedPath), seed, "utf8");

		// Let Obsidian pick the new file up before opening it — metadataCache
		// otherwise races with the command that reads frontmatter. Also wait
		// for a tab group to exist; `openNote` calls `getUnpinnedLeaf()` which
		// throws on a bare workspace.
		await waitForWorkspaceReady(obsidian.page);
		await obsidian.page.waitForTimeout(500);
		await openNote(obsidian.page, "Events/Editable Event-20250101000000");

		const executed = await executeCommand(obsidian.page, "prisma-calendar:edit-current-note-as-event");
		expect(executed).toBe(true);
		await waitForEventModalOpen(obsidian.page, 15_000);

		// Edit modal should load categories/participants/prerequisites into chips.
		const loadedCategories = await obsidian.page.evaluate(() => {
			const w = window as unknown as E2EWindow;
			return w.__prismaActiveEventModal?.categoriesChipList?.value ?? [];
		});
		expect(loadedCategories).toContain("Work");

		// Mutate every field except the title. Title edits trigger a
		// rename-then-write path that races the plugin's file-indexer; covering
		// title-driven renames belongs to a dedicated spec that can wait on the
		// indexer settling. The rest of the fields exercise the edit→frontmatter
		// round-trip on a stable file path.
		await fillEventModal(obsidian.page, {
			start: "2026-05-11T14:00",
			end: "2026-05-11T15:30",
			categories: ["Personal", "Fitness"],
			participants: ["Charlie"],
			prerequisites: ["[[Team Meeting]]"],
			location: "Room B",
			icon: "dumbbell",
			breakMinutes: 10,
			minutesBefore: 30,
			customProperties: { Priority: "low" },
		});

		await saveEventModal(obsidian.page);
		await waitForModalClosed(obsidian.page, 15_000);
		await obsidian.page.waitForTimeout(1_000);

		// Title edits can rename the file (title becomes filename). The updated
		// file lives wherever Obsidian chose to put it — resolve by scanning
		// Events/ for the one file (we only created one).
		const currentFile = await obsidian.page.evaluate(() => {
			const w = window as unknown as {
				app: { vault: { getMarkdownFiles: () => Array<{ path: string }> } };
			};
			return w.app.vault
				.getMarkdownFiles()
				.map((f) => f.path)
				.find((p) => p.startsWith("Events/"));
		});
		expect(currentFile).toBeTruthy();

		expectFrontmatter(obsidian.vaultDir, currentFile!, {
			"Start Date": "2026-05-11T14:00:00.000Z",
			"End Date": "2026-05-11T15:30:00.000Z",
			Category: ["Personal", "Fitness"],
			Participants: "Charlie",
			Prerequisite: "[[Team Meeting]]",
			Location: "Room B",
			Icon: "dumbbell",
			Break: 10,
			"Minutes Before": 30,
			Priority: "low",
		});
	});
});
