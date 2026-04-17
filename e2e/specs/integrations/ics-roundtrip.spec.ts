import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";
import {
	getEventCount,
	refreshCalendar,
	type SeedEventInput,
	seedEvents,
	waitForEventCount,
} from "../../fixtures/seed-events";

// Full ICS roundtrip. The contract we verify:
//
//   Given a set of events seeded to disk in Prisma's canonical frontmatter
//   format, exporting to .ics with timezone=UTC, deleting every event note,
//   and importing the produced .ics with timezone=UTC must reproduce every
//   event with the same set of Prisma-understood properties.
//
// What we compare per event (byte-for-byte):
//   • Title            (via summary / filename)
//   • Start Date       (timed)   – canonical `YYYY-MM-DDTHH:mm:ss.000Z`
//   • End Date         (timed)
//   • Date             (all-day) – `YYYY-MM-DD`
//   • Category         – single or multi-value
//   • Location
//   • Participants     – list preserved verbatim
//   • Custom frontmatter keys   – preserved via X-PRISMA-FM-* round-trip
//   • RRule                     – preserved via X-PRISMA-FM-*
//
// What regenerates (not asserted):
//   • ZettelID in filename — the seeded files have no IDs; import generates
//     fresh 14-digit ones. We only check the format.
//   • The `All Day` boolean flag — importer always writes it; seed omits it
//     for timed events. Both are semantically equivalent; we skip that key
//     in the diff.

const EVENTS_DIR = "Events";
const EXPORTS_DIR = "Prisma-Exports";
const EXPORT_SUBMIT = '[data-testid="prisma-ics-export-submit"]';
const IMPORT_FILE_INPUT = '[data-testid="prisma-ics-import-file"]';
const IMPORT_SUBMIT = '[data-testid="prisma-ics-import-submit"]';

interface SeededEvent extends SeedEventInput {
	expected: Record<string, unknown>;
}

const SEED: readonly SeededEvent[] = [
	{
		title: "Team Meeting",
		startDate: "2026-06-01T10:00",
		endDate: "2026-06-01T11:00",
		category: "Work",
		location: "Room 3",
		participants: ["alice@example.com", "bob@example.com"],
		extra: { Icon: "briefcase" },
		expected: {
			"Start Date": "2026-06-01T10:00:00.000Z",
			"End Date": "2026-06-01T11:00:00.000Z",
			Category: "Work",
			Location: "Room 3",
			Participants: ["alice@example.com", "bob@example.com"],
			Icon: "briefcase",
		},
	},
	{
		title: "Weekly Review",
		startDate: "2026-06-02T14:00",
		endDate: "2026-06-02T15:00",
		category: "Work",
		expected: {
			"Start Date": "2026-06-02T14:00:00.000Z",
			"End Date": "2026-06-02T15:00:00.000Z",
			Category: "Work",
		},
	},
	{
		title: "Workout",
		startDate: "2026-06-03T07:00",
		endDate: "2026-06-03T08:00",
		category: "Fitness",
		location: "Gym",
		expected: {
			"Start Date": "2026-06-03T07:00:00.000Z",
			"End Date": "2026-06-03T08:00:00.000Z",
			Category: "Fitness",
			Location: "Gym",
		},
	},
	{
		title: "Conference Day",
		date: "2026-06-04",
		allDay: true,
		category: "Work",
		expected: {
			Date: "2026-06-04",
			"All Day": true,
			Category: "Work",
		},
	},
	{
		title: "Holiday Break",
		date: "2026-12-25",
		allDay: true,
		extra: { Icon: "tree" },
		expected: {
			Date: "2026-12-25",
			"All Day": true,
			Icon: "tree",
		},
	},
	{
		title: "Yearly Review",
		startDate: "2026-12-31T16:00",
		endDate: "2026-12-31T17:00",
		category: "Work",
		rrule: "FREQ=YEARLY;INTERVAL=1",
		extra: { Icon: "clock", Priority: 2 },
		expected: {
			"Start Date": "2026-12-31T16:00:00.000Z",
			"End Date": "2026-12-31T17:00:00.000Z",
			Category: "Work",
			RRule: "FREQ=YEARLY;INTERVAL=1",
			Icon: "clock",
			Priority: 2,
		},
	},
];

function listEventMarkdown(vaultDir: string): string[] {
	const dir = join(vaultDir, EVENTS_DIR);
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("Virtual Events"));
}

/** Strip the 14-digit ZettelID suffix the importer appends to regenerated files. */
function titleFromFilename(filename: string): string {
	return filename.replace(/-\d{14}(?=\.md$)/, "").replace(/\.md$/, "");
}

test("ICS roundtrip: export → delete → import preserves every Prisma-understood property", async ({ obsidian }) => {
	const { page, vaultDir } = obsidian;

	seedEvents(vaultDir, SEED);
	await refreshCalendar(page);
	await waitForEventCount(page, SEED.length);

	// ── Export via palette → submit ──────────────────────────────────────
	await runCommand(page, "Prisma Calendar: Export calendar as .ics");
	await page.locator(EXPORT_SUBMIT).first().click();

	const exportsDir = join(vaultDir, EXPORTS_DIR);
	await expect
		.poll(() => (existsSync(exportsDir) ? readdirSync(exportsDir).filter((f) => f.endsWith(".ics")) : []))
		.toHaveLength(1);

	const icsPath = join(exportsDir, readdirSync(exportsDir).find((f) => f.endsWith(".ics"))!);
	const exportedIcs = readFileSync(icsPath, "utf8");
	expect((exportedIcs.match(/BEGIN:VEVENT/g) ?? []).length).toBe(SEED.length);
	for (const event of SEED) expect(exportedIcs).toContain(`SUMMARY:${event.title}`);

	// ── Scorched earth: delete every seeded event note ───────────────────
	for (const md of listEventMarkdown(vaultDir)) {
		unlinkSync(join(vaultDir, EVENTS_DIR, md));
	}
	await refreshCalendar(page);
	expect(listEventMarkdown(vaultDir)).toHaveLength(0);

	// ── Import the .ics back ─────────────────────────────────────────────
	await runCommand(page, "Prisma Calendar: Import .ics file");
	await page.locator(IMPORT_FILE_INPUT).first().setInputFiles(icsPath);
	const importSubmit = page.locator(IMPORT_SUBMIT).first();
	await expect(importSubmit).toBeEnabled();
	await importSubmit.click();

	await expect.poll(() => listEventMarkdown(vaultDir).length).toBe(SEED.length);
	await refreshCalendar(page);
	await expect.poll(() => getEventCount(page)).toBeGreaterThanOrEqual(SEED.length);

	// ── Compare imported frontmatter against expected ────────────────────
	const importedFilenames = listEventMarkdown(vaultDir);
	const byTitle = new Map<string, string>(importedFilenames.map((f) => [titleFromFilename(f), f]));

	expect([...byTitle.keys()].sort()).toEqual(SEED.map((e) => e.title).sort());

	for (const event of SEED) {
		const filename = byTitle.get(event.title);
		expect(filename, `imported file for "${event.title}" missing`).toBeDefined();
		expect(filename!, `zettel id must be re-stamped on "${event.title}"`).toMatch(/-\d{14}\.md$/);

		const fm = readEventFrontmatter(vaultDir, `${EVENTS_DIR}/${filename!}`);

		for (const [key, expected] of Object.entries(event.expected)) {
			expect(fm[key], `"${event.title}" → ${key} must round-trip byte-for-byte`).toEqual(expected);
		}
	}
});
