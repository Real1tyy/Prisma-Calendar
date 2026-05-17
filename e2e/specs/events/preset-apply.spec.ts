import { expectFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { updateCalendarSettings } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";
import { openCreateModal, waitForModalClosed } from "./events-helpers";
import { saveEventModal } from "./fill-event-modal";

// E2E-only assertion: preset → modal → save → on-disk frontmatter. The
// in-modal preset apply (title overwrite, recurring flip, all-day flip,
// default-on-mount, dropdown-resets) is pure form mutation and is fully
// covered by RTL at tests/components/event-form/event-form.test.tsx — those
// tests would catch any regression in the preset-apply handler without
// paying the Electron-spinup cost.

const WORKOUT_PRESET = {
	id: "preset-workout",
	name: "Morning Workout",
	title: "Morning Workout",
	location: "Gym",
	categories: "Fitness",
	createdAt: 1_700_000_000_000,
};

test.describe("event modal — preset selector", () => {
	test("preset-applied fields persist through save to disk", async ({ calendar }) => {
		await updateCalendarSettings(calendar.page, { eventPresets: [WORKOUT_PRESET] });

		await openCreateModal(calendar.page);
		await calendar.page
			.locator(sel(TID.event.control("preset")))
			.first()
			.selectOption(WORKOUT_PRESET.id);
		// Stamp a start/end so the save path doesn't classify the event as untracked.
		await calendar.page
			.locator(sel(TID.event.control("start")))
			.first()
			.fill(fromAnchor(0, 9, 0));
		await calendar.page
			.locator(sel(TID.event.control("end")))
			.first()
			.fill(fromAnchor(0, 9, 30));

		await saveEventModal(calendar.page);
		await waitForModalClosed(calendar.page);
		await calendar.goToAnchor();

		const evt = await calendar.eventByTitle(WORKOUT_PRESET.title);
		expectFrontmatter(calendar.vaultDir, evt.path, {
			Location: "Gym",
			Category: "Fitness",
		});
	});
});
