import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	createEventViaModal,
	EVENT_MODAL_SELECTOR,
	eventBlockLocator,
	expectEventVisible,
	formatLocalDate,
	listEventFiles,
	openCalendarReady,
	openCreateModal,
	rightClickEventMenu,
} from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

// Round 4 — data integrity. Invariants a user never wants violated:
// - Title rename in the modal renames the backing file on disk and the
//   filename stamp (embedded timestamp) stays stable.
// - Titles with filename-illegal characters (`/`) get sanitised in the
//   filename and still render in the calendar.
// - External file writes under `Events/` are picked up live by the indexer
//   without a reload.

function extractFilenameStamp(relativePath: string): string | null {
	const match = relativePath.match(/-(\d{10,})\.md$/);
	return match ? match[1]! : null;
}

test.describe("event data integrity", () => {
	test("renaming the title renames the on-disk file; stamp stays stable", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		const today = formatLocalDate(new Date());

		const originalPath = await createEventViaModal(obsidian, {
			title: "Old Title",
			start: `${today}T09:00`,
			end: `${today}T10:00`,
		});

		// Prisma stamps a timestamp into every event filename (`-YYYYMMDDhhmmss`).
		// That stamp is the durable id — not a frontmatter field. Rename must
		// preserve it.
		const originalStamp = extractFilenameStamp(originalPath);
		expect(originalStamp, `event filename must carry a stamp: ${originalPath}`).not.toBeNull();

		await expectEventVisible(obsidian.page, "Old Title");
		await rightClickEventMenu(obsidian.page, "Old Title", "editEvent");
		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 15_000 });

		await fillEventModal(obsidian.page, { title: "New Title" });
		await saveEventModal(obsidian.page);

		await expect
			.poll(
				() => {
					const relPaths = listEventFiles(obsidian.vaultDir).map((abs) => abs.slice(obsidian.vaultDir.length + 1));
					return relPaths.some((p) => p.includes("New Title")) && !relPaths.some((p) => p === originalPath);
				},
				{ timeout: 10_000 }
			)
			.toBe(true);

		const renamedRelative = listEventFiles(obsidian.vaultDir)
			.map((abs) => abs.slice(obsidian.vaultDir.length + 1))
			.find((p) => p.includes("New Title"));
		expect(renamedRelative, "renamed file must exist on disk").toBeTruthy();

		expect(extractFilenameStamp(renamedRelative!)).toBe(originalStamp);

		await expectEventVisible(obsidian.page, "New Title");
		await expect(eventBlockLocator(obsidian.page, "Old Title")).toHaveCount(0);
	});

	test("title with filename-illegal characters blocks save and surfaces a notice", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		const today = formatLocalDate(new Date());

		// Plugin validates title at save time. `/` can never be written to a
		// filename so we refuse rather than silently sanitise, avoiding the
		// "user typed Foo/Bar and the file ended up as FooBar" surprise.
		const baseline = new Set(listEventFiles(obsidian.vaultDir));
		await openCreateModal(obsidian.page);
		await fillEventModal(obsidian.page, {
			title: "Slashed / Title",
			start: `${today}T09:00`,
			end: `${today}T10:00`,
		});

		// Save is attempted but must be blocked. `waitForClose: false` so we
		// can observe the still-open modal and the notice.
		await saveEventModal(obsidian.page, { waitForClose: false });

		// Modal must stay open — no file written.
		await expect(obsidian.page.locator(EVENT_MODAL_SELECTOR)).toBeVisible();

		// Notice surfaces with the validation message.
		await expect(obsidian.page.locator(".notice", { hasText: "Event title cannot contain" })).toBeVisible();

		// Nothing new was written to disk — compare against the pre-action baseline.
		const newlyCreated = listEventFiles(obsidian.vaultDir).filter((p) => !baseline.has(p));
		expect(newlyCreated).toEqual([]);
	});

	test("externally-written file under Events/ appears in the calendar without reload", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		const today = formatLocalDate(new Date());

		const externalPath = "Events/External Event.md";
		writeFileSync(
			join(obsidian.vaultDir, externalPath),
			`---
Start Date: ${today}T14:00
End Date: ${today}T15:00
---

# External Event
`,
			"utf8"
		);

		await expectEventVisible(obsidian.page, "External Event");

		// Rewrite Start Date to a different time; the on-disk change must be
		// picked up.
		writeFileSync(
			join(obsidian.vaultDir, externalPath),
			`---
Start Date: ${today}T16:00
End Date: ${today}T17:00
---

# External Event
`,
			"utf8"
		);

		await expect
			.poll(() => String(readEventFrontmatter(obsidian.vaultDir, externalPath)["Start Date"] ?? ""), {
				timeout: 10_000,
			})
			.toBe(`${today}T16:00`);

		expect(existsSync(join(obsidian.vaultDir, externalPath))).toBe(true);
	});
});
