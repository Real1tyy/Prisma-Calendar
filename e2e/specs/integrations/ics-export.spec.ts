import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, type SeedEventInput, seedEvents } from "../../fixtures/seed-events";

// Exports go through the `showCalendarSelectModal` → ics-export writer. The
// modal submit button is stamped `data-testid="prisma-ics-export-submit"` so
// we can target it without scraping the English label. Writer emits a single
// .ics under the vault's `Prisma-Exports/` folder.

const EXPORTS_DIR = "Prisma-Exports";
const EXPORT_SUBMIT = '[data-testid="prisma-ics-export-submit"]';

const SEED: readonly SeedEventInput[] = [
	{
		title: "Team Meeting",
		startDate: "2026-05-04T10:00",
		endDate: "2026-05-04T11:00",
		category: "Work",
		location: "Room 3",
	},
	{
		title: "Weekly Review",
		startDate: "2026-05-05T14:00",
		endDate: "2026-05-05T15:00",
		category: "Work",
	},
	{
		title: "Workout",
		startDate: "2026-05-06T07:00",
		endDate: "2026-05-06T08:00",
		category: "Fitness",
	},
	{
		title: "Project Planning",
		startDate: "2026-05-07T13:00",
		endDate: "2026-05-07T14:30",
		category: "Work",
	},
	{
		title: "Conference Day",
		date: "2026-05-08",
		allDay: true,
		category: "Work",
	},
];

test.describe("ICS export", () => {
	test.beforeEach(async ({ obsidian }) => {
		seedEvents(obsidian.vaultDir, SEED);
		await refreshCalendar(obsidian.page);
	});

	test("writer produces five VEVENTs with correct SUMMARY / DTSTART / CATEGORIES / LOCATION", async ({ obsidian }) => {
		await runCommand(obsidian.page, "Prisma Calendar: Export calendar as .ics");

		const submit = obsidian.page.locator(EXPORT_SUBMIT).first();
		await submit.waitFor({ state: "visible" });
		await submit.click();

		const exportsDir = join(obsidian.vaultDir, EXPORTS_DIR);
		await expect
			.poll(() => (existsSync(exportsDir) ? readdirSync(exportsDir).filter((f) => f.endsWith(".ics")) : []))
			.toHaveLength(1);

		const icsFile = readdirSync(exportsDir).find((f) => f.endsWith(".ics"))!;
		const ics = readFileSync(join(exportsDir, icsFile), "utf8");

		const veventCount = (ics.match(/BEGIN:VEVENT/g) ?? []).length;
		expect(veventCount).toBe(SEED.length);

		for (const event of SEED) expect(ics).toContain(`SUMMARY:${event.title}`);

		expect(ics).toMatch(/DTSTART;VALUE=DATE:20260508/);
		expect(ics).toMatch(/DTSTART[^\r\n]*:20260504T100000/);
		expect(ics).toMatch(/DTEND[^\r\n]*:20260504T110000/);
		expect(ics).toContain("CATEGORIES:Work");
		expect(ics).toContain("LOCATION:Room 3");
	});
});
