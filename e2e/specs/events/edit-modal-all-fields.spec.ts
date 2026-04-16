import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { expect, test } from "../../fixtures/electron";
import {
	chipsForField,
	EVENT_MODAL_SELECTOR,
	formatLocalDate,
	openCalendarReady,
	removeChip,
	rightClickEventMenu,
} from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

// Edit-side parity: seed a fully-populated event on disk so FullCalendar
// renders a block for it, then right-click the block → click Edit event in
// the context menu → mutate every field → save → re-read frontmatter.
// Drives the full "real user edits an existing event" flow.
test.describe("edit event — all fields", () => {
	test("right-click → Edit event reads fields, saves mutations", async ({ obsidian }) => {
		// Anchor today so FullCalendar's default month view contains the block.
		const today = formatLocalDate(new Date());
		// Pre-bake the ZettelID so ensureZettelIdOnSave is a no-op on save; the
		// rename-then-write path otherwise races the file indexer.
		const seedPath = "Events/Editable Event-20250101000000.md";
		const seed = `---
Start Date: ${today}T09:00
End Date: ${today}T10:00
Category:
  - Work
Participants:
  - Alice
Location: Room A
Icon: calendar
Break: 5
Minutes Before: 10
Priority: high
---

# Editable Event
`;
		writeFileSync(join(obsidian.vaultDir, seedPath), seed, "utf8");

		await openCalendarReady(obsidian.page);

		await obsidian.page
			.locator(".fc-event", { hasText: "Editable Event" })
			.first()
			.waitFor({ state: "visible", timeout: 15_000 });

		await rightClickEventMenu(obsidian.page, "Editable Event", "editEvent");
		await obsidian.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible", timeout: 15_000 });

		const categoryChips = chipsForField(obsidian.page, "prisma-event-field-categories");
		await expect(categoryChips).toHaveCount(1);
		await expect(categoryChips.first()).toHaveAttribute("data-chip-value", "Work");

		// A real user replacing chip-list values clicks × on each existing chip
		// before adding new ones — that's what we drive here.
		await removeChip(obsidian.page, "prisma-event-field-categories", "Work");
		await expect(categoryChips).toHaveCount(0);

		const participantChips = chipsForField(obsidian.page, "prisma-event-field-participants");
		await removeChip(obsidian.page, "prisma-event-field-participants", "Alice");
		await expect(participantChips).toHaveCount(0);

		// Mutate every field except title (title rename races the indexer).
		await fillEventModal(obsidian.page, {
			start: `${today}T14:00`,
			end: `${today}T15:30`,
			categories: ["Personal", "Fitness"],
			participants: ["Charlie"],
			location: "Room B",
			icon: "dumbbell",
			breakMinutes: 10,
			minutesBefore: 30,
			customProperties: { Priority: "low" },
		});

		await saveEventModal(obsidian.page);

		await expect
			.poll(() => readEventFrontmatter(obsidian.vaultDir, seedPath)["Location"], { timeout: 10_000 })
			.toBe("Room B");

		expectFrontmatter(obsidian.vaultDir, seedPath, {
			"Start Date": `${today}T14:00:00.000Z`,
			"End Date": `${today}T15:30:00.000Z`,
			Category: ["Personal", "Fitness"],
			Participants: "Charlie",
			Location: "Room B",
			Icon: "dumbbell",
			Break: 10,
			"Minutes Before": 30,
			Priority: "low",
		});
	});
});
