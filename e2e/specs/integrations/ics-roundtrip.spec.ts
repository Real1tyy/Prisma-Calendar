import { existsSync, readdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";
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
import { ICS_EXPORT_SUBMIT_TID, ICS_IMPORT_FILE_TID, ICS_IMPORT_SUBMIT_TID, sel } from "../../fixtures/testids";

// Full ICS roundtrip. The contract we verify:
//
//   Given a set of events seeded to disk in Prisma's canonical frontmatter
//   format, exporting to .ics with timezone=UTC, deleting every event note,
//   and importing the produced .ics with timezone=UTC must reproduce every
//   event with the same set of Prisma-understood properties.
//
// What we compare per event (byte-for-byte): start/end dates, date (all-day),
// category, location, participants, custom frontmatter keys (preserved via
// X-PRISMA-FM-*), and RRule. ZettelID is regenerated on import (14-digit
// suffix in filename — format-checked, not value-checked). The `All Day`
// boolean is not asserted for timed events because the seed omits it.

const EVENTS_DIR = "Events";
const EXPORTS_DIR = "Prisma-Exports";
const EXPORT_SUBMIT = sel(ICS_EXPORT_SUBMIT_TID);
const IMPORT_FILE_INPUT = sel(ICS_IMPORT_FILE_TID);
const IMPORT_SUBMIT = sel(ICS_IMPORT_SUBMIT_TID);

function listEventMarkdown(vaultDir: string): string[] {
	const dir = join(vaultDir, EVENTS_DIR);
	if (!existsSync(dir)) return [];
	return readdirSync(dir).filter((f) => f.endsWith(".md") && !f.startsWith("Virtual Events"));
}

/** Strip the 14-digit ZettelID suffix the importer appends to regenerated files. */
function titleFromFilename(filename: string): string {
	return filename.replace(/-\d{14}(?=\.md$)/, "").replace(/\.md$/, "");
}

/**
 * Derive the frontmatter shape the importer should write for a given seed.
 * Single source of truth — previously every seed entry duplicated its
 * frontmatter in an `expected` field. The transformation mirrors how
 * `seedEvent` writes the disk file, with the timed-event date fields promoted
 * to the canonical `:ss.000Z` shape Prisma normalises to during import.
 */
function expectedFromSeed(event: SeedEventInput): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	if (event.startDate) out["Start Date"] = `${event.startDate}:00.000Z`;
	if (event.endDate) out["End Date"] = `${event.endDate}:00.000Z`;
	if (event.date) out["Date"] = event.date;
	if (event.allDay) out["All Day"] = true;
	if (event.category) out["Category"] = event.category;
	if (event.location) out["Location"] = event.location;
	if (event.participants && event.participants.length > 0) out["Participants"] = event.participants;
	if (event.rrule) out["RRule"] = event.rrule;
	if (event.extra) Object.assign(out, event.extra);
	return out;
}

interface RoundTripHandles {
	icsPath: string;
	exportedIcs: string;
}

/**
 * Seed → export → scorch → import. Every test that exercises a different
 * flavour of events runs through this identical pipeline, asserting against
 * the returned ICS + on-disk state.
 */
async function runRoundTrip(
	{ page, vaultDir }: { page: Page; vaultDir: string },
	seed: readonly SeedEventInput[]
): Promise<RoundTripHandles> {
	seedEvents(vaultDir, seed);
	await refreshCalendar(page);
	await waitForEventCount(page, seed.length);

	await runCommand(page, "Prisma Calendar: Export calendar as .ics");
	await page.locator(EXPORT_SUBMIT).first().click();

	const exportsDir = join(vaultDir, EXPORTS_DIR);
	await expect
		.poll(() => (existsSync(exportsDir) ? readdirSync(exportsDir).filter((f) => f.endsWith(".ics")) : []))
		.toHaveLength(1);

	const icsPath = join(exportsDir, readdirSync(exportsDir).find((f) => f.endsWith(".ics"))!);
	const exportedIcs = readFileSync(icsPath, "utf8");
	expect((exportedIcs.match(/BEGIN:VEVENT/g) ?? []).length).toBe(seed.length);

	for (const md of listEventMarkdown(vaultDir)) {
		unlinkSync(join(vaultDir, EVENTS_DIR, md));
	}
	await refreshCalendar(page);
	expect(listEventMarkdown(vaultDir)).toHaveLength(0);

	await runCommand(page, "Prisma Calendar: Import .ics file");
	await page.locator(IMPORT_FILE_INPUT).first().setInputFiles(icsPath);
	const importSubmit = page.locator(IMPORT_SUBMIT).first();
	await expect(importSubmit).toBeEnabled();
	await importSubmit.click();

	// The import modal closes asynchronously after submit. Waiting for it to
	// detach before the file-count poll prevents the next palette command
	// from racing with a still-visible modal.
	await expect.poll(() => page.locator(".modal").count()).toBe(0);

	await expect.poll(() => listEventMarkdown(vaultDir).length).toBe(seed.length);
	await refreshCalendar(page);
	await expect.poll(() => getEventCount(page)).toBe(seed.length);

	return { icsPath, exportedIcs };
}

/**
 * Walk every seed, find its imported file by title, and assert every key
 * `expectedFromSeed` produces round-trips byte-for-byte.
 */
function assertRoundTripFidelity(vaultDir: string, seed: readonly SeedEventInput[]): void {
	const importedFilenames = listEventMarkdown(vaultDir);
	const byTitle = new Map<string, string>(importedFilenames.map((f) => [titleFromFilename(f), f]));

	expect([...byTitle.keys()].sort()).toEqual(seed.map((e) => e.title).sort());

	for (const event of seed) {
		const filename = byTitle.get(event.title);
		expect(filename, `imported file for "${event.title}" missing`).toBeDefined();
		expect(filename!, `zettel id must be re-stamped on "${event.title}"`).toMatch(/-\d{14}\.md$/);

		const fm = readEventFrontmatter(vaultDir, `${EVENTS_DIR}/${filename!}`);
		for (const [key, value] of Object.entries(expectedFromSeed(event))) {
			expect(fm[key], `"${event.title}" → ${key} must round-trip byte-for-byte`).toEqual(value);
		}
	}
}

test.describe("ICS roundtrip", () => {
	test("basic events (timed, all-day, categories, participants, location, custom keys)", async ({ obsidian }) => {
		const seed: SeedEventInput[] = [
			{
				title: "Team Meeting",
				startDate: "2026-06-01T10:00",
				endDate: "2026-06-01T11:00",
				category: "Work",
				location: "Room 3",
				participants: ["alice@example.com", "bob@example.com"],
				extra: { Icon: "briefcase" },
			},
			{
				title: "Weekly Review",
				startDate: "2026-06-02T14:00",
				endDate: "2026-06-02T15:00",
				category: "Work",
			},
			{
				title: "Workout",
				startDate: "2026-06-03T07:00",
				endDate: "2026-06-03T08:00",
				category: "Fitness",
				location: "Gym",
			},
			{
				title: "Conference Day",
				date: "2026-06-04",
				allDay: true,
				category: "Work",
			},
			{
				title: "Holiday Break",
				date: "2026-12-25",
				allDay: true,
				extra: { Icon: "tree" },
			},
			{
				title: "Yearly Review",
				startDate: "2026-12-31T16:00",
				endDate: "2026-12-31T17:00",
				category: "Work",
				rrule: "FREQ=YEARLY;INTERVAL=1",
				extra: { Icon: "clock", Priority: 2 },
			},
		];

		const { exportedIcs } = await runRoundTrip(obsidian, seed);
		for (const event of seed) expect(exportedIcs).toContain(`SUMMARY:${event.title}`);
		assertRoundTripFidelity(obsidian.vaultDir, seed);
	});

	test("recurrence patterns (daily, weekly, monthly, yearly) preserve RRULE", async ({ obsidian }) => {
		const seed: SeedEventInput[] = [
			{
				title: "Daily Standup",
				startDate: "2026-06-01T09:00",
				endDate: "2026-06-01T09:15",
				category: "Work",
				rrule: "FREQ=DAILY;INTERVAL=1",
			},
			{
				title: "Monthly Planning",
				startDate: "2026-06-01T15:00",
				endDate: "2026-06-01T16:00",
				category: "Work",
				rrule: "FREQ=MONTHLY;INTERVAL=1",
			},
			{
				title: "Quarterly Review",
				startDate: "2026-06-15T10:00",
				endDate: "2026-06-15T11:30",
				category: "Work",
				rrule: "FREQ=MONTHLY;INTERVAL=3",
			},
			{
				title: "Birthday",
				date: "2026-07-04",
				allDay: true,
				rrule: "FREQ=YEARLY;INTERVAL=1",
			},
		];

		await runRoundTrip(obsidian, seed);
		assertRoundTripFidelity(obsidian.vaultDir, seed);
	});

	test("custom frontmatter keys round-trip via X-PRISMA-FM-*", async ({ obsidian }) => {
		const seed: SeedEventInput[] = [
			{
				title: "Project Planning",
				startDate: "2026-08-01T10:00",
				endDate: "2026-08-01T12:00",
				extra: {
					Priority: 1,
					Project: "Phoenix",
					Status: "In Progress",
					Effort: 5,
				},
			},
			{
				title: "Design Review",
				startDate: "2026-08-02T14:00",
				endDate: "2026-08-02T15:00",
				extra: {
					ReviewRound: 2,
					Blocked: false,
				},
			},
		];

		const { exportedIcs } = await runRoundTrip(obsidian, seed);
		expect(exportedIcs).toMatch(/X-PRISMA-FM-/);
		assertRoundTripFidelity(obsidian.vaultDir, seed);
	});

	test("RRULE bounded by COUNT and UNTIL round-trips verbatim", async ({ obsidian }) => {
		const seed: SeedEventInput[] = [
			{
				title: "Five Standups",
				startDate: "2026-09-07T09:00",
				endDate: "2026-09-07T09:15",
				category: "Work",
				rrule: "FREQ=DAILY;COUNT=5",
			},
			{
				title: "Weekly Review Until EOY",
				startDate: "2026-09-04T15:00",
				endDate: "2026-09-04T16:00",
				category: "Work",
				rrule: "FREQ=WEEKLY;UNTIL=20261231T235959Z",
			},
			{
				title: "Monthly One-on-One",
				startDate: "2026-09-15T10:00",
				endDate: "2026-09-15T10:30",
				category: "Work",
				rrule: "FREQ=MONTHLY;COUNT=6",
			},
		];

		await runRoundTrip(obsidian, seed);
		assertRoundTripFidelity(obsidian.vaultDir, seed);
	});

	test("re-importing the same .ics does not crash and leaves original events intact", async ({ obsidian }) => {
		// Documents current behaviour of the manual `Import .ics file`
		// command: `importEventsToCalendar` in ics-import.ts compares ICS
		// `uid` against `event.id` in the store, but the store id is
		// derived from file path, not ICS UID — so manual re-import creates
		// new files for every VEVENT. The ICS *subscription* sync path
		// (`ics-subscription.spec.ts`) is UID-aware and dedupes correctly;
		// the manual-import command does not. That's a known gap; this
		// test locks in the "at least does not crash and keeps originals"
		// guarantee so behaviour only ever improves from here.
		const { page, vaultDir } = obsidian;

		const seed: SeedEventInput[] = [
			{
				title: "Team Meeting",
				startDate: "2026-10-01T10:00",
				endDate: "2026-10-01T11:00",
				category: "Work",
			},
			{
				title: "Weekly Review",
				startDate: "2026-10-08T15:00",
				endDate: "2026-10-08T16:00",
				category: "Work",
			},
			{
				title: "Holiday",
				date: "2026-10-13",
				allDay: true,
			},
		];

		const { icsPath } = await runRoundTrip(obsidian, seed);
		const afterFirstImport = new Set(listEventMarkdown(vaultDir));
		expect(afterFirstImport.size).toBe(seed.length);

		await runCommand(page, "Prisma Calendar: Import .ics file");
		await page.locator(IMPORT_FILE_INPUT).first().setInputFiles(icsPath);
		const importSubmit = page.locator(IMPORT_SUBMIT).first();
		await expect(importSubmit).toBeEnabled();
		await importSubmit.click();
		await expect.poll(() => page.locator(".modal").count()).toBe(0);

		await refreshCalendar(page);

		// Originals must survive — the re-import must not *overwrite* existing
		// files or reduce the vault below its post-first-import count.
		const afterSecondImport = listEventMarkdown(vaultDir);
		expect(afterSecondImport.length).toBeGreaterThanOrEqual(seed.length);
		for (const original of afterFirstImport) {
			expect(afterSecondImport).toContain(original);
		}
	});
});
