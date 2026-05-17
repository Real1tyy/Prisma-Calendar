import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { createEventHandle } from "../../fixtures/dsl";
import { expect, testWithNotifications as test } from "../../fixtures/electron";
import { refreshCalendar, updateCalendarSettings } from "../../fixtures/seed-events";
import { chipsForField, EVENT_MODAL_SELECTOR, formatLocalDate, removeChip } from "./events-helpers";
import { fillEventModal, saveEventModal } from "./fill-event-modal";

const WORK_COLOR = "#228855";
const PERSONAL_COLOR = "#dd5599";

// Edit-side parity: seed a fully-populated event on disk so FullCalendar
// renders a block for it, then right-click the block → click Edit event in
// the context menu → mutate every field → save → re-read frontmatter.
// Drives the full "real user edits an existing event" flow.
test.describe("edit event — all fields", () => {
	test("right-click → Edit event reads fields, saves mutations", async ({ calendar }) => {
		// Anchor today so FullCalendar's default month view contains the block.
		const today = formatLocalDate(new Date());
		// Pre-bake the ZettelID so ensureZettelIdOnSave is a no-op on save; the
		// rename-then-write path otherwise races the file indexer.
		const seedPath = "Events/Editable Event-20250101000000.md";
		// `Already Notified: true` keeps the notification-manager modal from
		// popping up when wall-clock is within MAX_PAST_NOTIFICATION_THRESHOLD
		// of the 09:00 start — that modal would intercept the right-click below.
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
Already Notified: true
---

# Editable Event
`;
		writeFileSync(join(calendar.vaultDir, seedPath), seed, "utf8");
		await updateCalendarSettings(calendar.page, {
			colorRules: [
				{ id: "rule-work", expression: "Category.includes('Work')", color: WORK_COLOR, enabled: true },
				{ id: "rule-personal", expression: "Category.includes('Personal')", color: PERSONAL_COLOR, enabled: true },
			],
		});
		await refreshCalendar(calendar.page);

		const evt = createEventHandle(calendar, seedPath, "Editable Event");
		await evt.expectVisible();

		// Pre-edit the tile pulls the Work rule's colour.
		await evt.expectColor(WORK_COLOR);

		await evt.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		const categoryChips = chipsForField(calendar.page, "prisma-event-field-categories");
		await expect(categoryChips).toHaveCount(1);
		await expect(categoryChips.first()).toHaveAttribute("data-chip-value", "Work");

		// A real user replacing chip-list values clicks × on each existing chip
		// before adding new ones — that's what we drive here.
		await removeChip(calendar.page, "prisma-event-field-categories", "Work");
		await expect(categoryChips).toHaveCount(0);

		const participantChips = chipsForField(calendar.page, "prisma-event-field-participants");
		await removeChip(calendar.page, "prisma-event-field-participants", "Alice");
		await expect(participantChips).toHaveCount(0);

		// Mutate every field except title (title rename races the indexer).
		await fillEventModal(calendar.page, {
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

		await saveEventModal(calendar.page);

		await evt.expectFrontmatter("Location", (v) => v === "Room B");

		expectFrontmatter(calendar.vaultDir, seedPath, {
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

		// Editing the category chip must re-evaluate the colour rule: Work
		// no longer matches, Personal does, so the tile flips to the
		// Personal rule's colour.
		await evt.expectColor(PERSONAL_COLOR);
	});

	test("edit modal assigns prerequisites + toggles mark-as-done into Status", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const targetPath = "Events/Target Event-20250101000000.md";
		const prereqPath = "Events/Source Event-20250101000001.md";

		writeFileSync(
			join(calendar.vaultDir, targetPath),
			`---
Start Date: ${today}T09:00
End Date: ${today}T10:00
Already Notified: true
---

# Target Event
`,
			"utf8"
		);
		writeFileSync(
			join(calendar.vaultDir, prereqPath),
			`---
Start Date: ${today}T08:00
End Date: ${today}T08:30
Already Notified: true
---

# Source Event
`,
			"utf8"
		);
		await refreshCalendar(calendar.page);

		const target = createEventHandle(calendar, targetPath, "Target Event");
		await target.expectVisible();
		await target.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		await fillEventModal(calendar.page, {
			prerequisites: ["Source Event"],
			markAsDone: true,
		});

		await saveEventModal(calendar.page);

		await target.expectFrontmatter("Status", (v) => v === "Done");

		const fm = readEventFrontmatter(calendar.vaultDir, targetPath);
		const pathNoExt = prereqPath.replace(/\.md$/, "");
		const displayName = pathNoExt.replace(/^.*\//, "");
		const expectedLink = `[[${pathNoExt}|${displayName}]]`;
		const prereqValue = fm["Prerequisite"];
		expect(Array.isArray(prereqValue) ? prereqValue : [prereqValue]).toEqual([expectedLink]);
	});
});
