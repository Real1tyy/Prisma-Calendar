import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";

import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent, setFrontmatterField, waitForEventCount } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";
import { createEventViaModal, formatLocalDate, openCalendarReady, switchToMonthView } from "./events-helpers";
import { addDays, collectInstanceDates, toYMD } from "./robustness-helpers";

// End-to-end lifecycle of recurring events — physical instance files on disk
// and calendar blocks rendered in the grid. Every test asserts the *exact*
// calendar dates the plugin is expected to materialise, derived from the
// plugin's generation algorithm:
//
//   getInitialOccurrenceDate skips the source day, then the plugin fills
//   `futureInstancesCount` forward from `today`. When `Generate Past Events`
//   is on, `ensurePastInstances` walks from the initial occurrence up to and
//   including today, creating an instance file per day. Expected sets fall
//   out of those rules directly.
//
// The expected dates are computed at test start (today-anchored) so they
// move with the clock and don't hard-code any calendar day.

const INSTANCE_TIMEOUT_MS = 15_000;
const RENDER_TIMEOUT_MS = 10_000;

/**
 * Count blocks that correspond to a file on disk (physical instances). The
 * calendar-view render stamps `data-event-file-path` only when filePath is
 * non-empty, so this selector discriminates physical from virtual cleanly.
 */
async function countPhysicalBlocks(page: Page, title: string): Promise<number> {
	return page
		.locator(`.workspace-leaf.mod-active ${sel(TID.block)}[data-event-title="${title}"][data-event-file-path]`)
		.count();
}

/** Local midnight today — all date-offset expectations anchor here. */
function todayMidnight(): Date {
	const t = new Date();
	t.setHours(0, 0, 0, 0);
	return t;
}

test.describe("recurring events — physical vs virtual instances", () => {
	test("weekly source materialises exactly 2 physicals at source+7 and source+14", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		await switchToMonthView(obsidian.page);

		const today = todayMidnight();
		const anchor = addDays(today, 2);
		const anchorStr = formatLocalDate(anchor);
		// Weekly, futureInstancesCount=2 (default). `getInitialOccurrenceDate`
		// skips source day, so the two physicals land at source+7 and source+14.
		const expectedDates = [toYMD(addDays(anchor, 7)), toYMD(addDays(anchor, 14))];

		await createEventViaModal(obsidian, {
			title: "Weekly Anchor",
			start: `${anchorStr}T09:00`,
			end: `${anchorStr}T10:00`,
			recurring: { rruleType: "custom", customFreq: "WEEKLY", customInterval: 1 },
		});

		await expect
			.poll(() => collectInstanceDates(obsidian.vaultDir, "Weekly Anchor"), { timeout: INSTANCE_TIMEOUT_MS })
			.toEqual(expectedDates);

		// Source + 2 physicals = 3 blocks with a data-event-file-path in the grid.
		await expect
			.poll(() => countPhysicalBlocks(obsidian.page, "Weekly Anchor"), { timeout: RENDER_TIMEOUT_MS })
			.toBe(3);
	});

	test("switching weekly → daily keeps the exact same 2 physicals (source+7, source+14) on disk", async ({
		obsidian,
	}) => {
		await openCalendarReady(obsidian.page);
		await switchToMonthView(obsidian.page);

		const today = todayMidnight();
		const anchor = addDays(today, 2);
		const anchorStr = formatLocalDate(anchor);
		// Weekly physicals before switch — the plugin must not touch these
		// when the rrule flips to daily (documented "don't destroy user files").
		const weeklyDates = [toYMD(addDays(anchor, 7)), toYMD(addDays(anchor, 14))];

		const sourcePath = await createEventViaModal(obsidian, {
			title: "Cadence Shift",
			start: `${anchorStr}T09:00`,
			end: `${anchorStr}T10:00`,
			recurring: { rruleType: "custom", customFreq: "WEEKLY", customInterval: 1 },
		});

		await expect
			.poll(() => collectInstanceDates(obsidian.vaultDir, "Cadence Shift"), { timeout: INSTANCE_TIMEOUT_MS })
			.toEqual(weeklyDates);

		// Rewrite source to daily cadence. This triggers `recurring-event-found`
		// with a diff → the plugin re-evaluates virtual cadence, leaves the
		// existing physicals alone. After the switch, futureInstances already
		// satisfies target=2, so no new physicals get created.
		await setFrontmatterField(obsidian.page, sourcePath, "RRule", "daily");
		await setFrontmatterField(obsidian.page, sourcePath, "RRuleSpec", "1");
		await refreshCalendar(obsidian.page);
		await obsidian.page.waitForTimeout(2_000);

		// Still exactly the two weekly dates — no daily fill-in of source+1..6.
		expect(collectInstanceDates(obsidian.vaultDir, "Cadence Shift")).toEqual(weeklyDates);

		// Source's RRule frontmatter reflects the new cadence.
		const src = readFileSync(join(obsidian.vaultDir, sourcePath), "utf8");
		expect(src).toMatch(/RRule:\s*daily/);
	});

	test("bumping Future Instances Count 2 → 3 materialises exactly source+5 as the next daily physical", async ({
		obsidian,
	}) => {
		await openCalendarReady(obsidian.page);
		await switchToMonthView(obsidian.page);

		const today = todayMidnight();
		const anchor = addDays(today, 2);
		const anchorStr = formatLocalDate(anchor);
		// Daily source at today+2, default futureInstancesCount=2. Initial
		// generation skips source day, then fills source+1 and source+2.
		const beforeDates = [toYMD(addDays(anchor, 1)), toYMD(addDays(anchor, 2))];
		// Bumping to 3 appends one more at source+3 (next daily after last).
		const afterDates = [...beforeDates, toYMD(addDays(anchor, 3))];

		const sourcePath = await createEventViaModal(obsidian, {
			title: "Capacity Bump",
			start: `${anchorStr}T09:00`,
			end: `${anchorStr}T10:00`,
			recurring: { rruleType: "custom", customFreq: "DAILY", customInterval: 1 },
		});

		await expect
			.poll(() => collectInstanceDates(obsidian.vaultDir, "Capacity Bump"), { timeout: INSTANCE_TIMEOUT_MS })
			.toEqual(beforeDates);

		await setFrontmatterField(obsidian.page, sourcePath, "Future Instances Count", 3);
		await refreshCalendar(obsidian.page);

		await expect
			.poll(() => collectInstanceDates(obsidian.vaultDir, "Capacity Bump"), { timeout: INSTANCE_TIMEOUT_MS })
			.toEqual(afterDates);

		// Source + 3 physicals = 4 blocks with a data-event-file-path in the grid.
		await expect
			.poll(() => countPhysicalBlocks(obsidian.page, "Capacity Bump"), { timeout: RENDER_TIMEOUT_MS })
			.toBe(4);
	});

	test("daily source at today-5 with Generate Past Events materialises the exact 6-date past-through-future set", async ({
		obsidian,
	}) => {
		await openCalendarReady(obsidian.page);
		await switchToMonthView(obsidian.page);

		const today = todayMidnight();
		const pastStart = addDays(today, -5);
		const pastStartStr = formatLocalDate(pastStart);
		// Future phase: `advancePastDate(today-4 @09:00, today @00:00)` advances
		// until current > boundary. today @09:00 > today @00:00, so it returns
		// `today @09:00` on that step — first physical lands on **today**, not
		// today+1. Then default futureInstancesCount=2 appends today+1.
		const futureDates = [toYMD(today), toYMD(addDays(today, 1))];
		// Past phase: `ensurePastInstances` walks while `currentDate <= today
		// @00:00`. today-1 @09:00 is still < today @00:00, but today @09:00 is
		// not → the last past date created is today-1, not today. So past
		// phase adds today-4..today-1 (4 dates).
		const pastDates = [-4, -3, -2, -1].map((offset) => toYMD(addDays(today, offset)));
		const expectedDates = [...pastDates, ...futureDates].sort();

		const sourcePath = await createEventViaModal(obsidian, {
			title: "Past Daily",
			start: `${pastStartStr}T09:00`,
			end: `${pastStartStr}T10:00`,
			recurring: { rruleType: "custom", customFreq: "DAILY", customInterval: 1 },
		});

		// Without past-events, only the two future physicals exist at this point.
		await expect
			.poll(() => collectInstanceDates(obsidian.vaultDir, "Past Daily"), { timeout: INSTANCE_TIMEOUT_MS })
			.toEqual(futureDates);

		// Enable past-event generation and re-trigger the manager.
		await setFrontmatterField(obsidian.page, sourcePath, "Generate Past Events", true);
		await refreshCalendar(obsidian.page);

		await expect
			.poll(() => collectInstanceDates(obsidian.vaultDir, "Past Daily"), { timeout: INSTANCE_TIMEOUT_MS })
			.toEqual(expectedDates);

		// Source + 6 physicals = 7 blocks with a data-event-file-path in the grid.
		await expect.poll(() => countPhysicalBlocks(obsidian.page, "Past Daily"), { timeout: RENDER_TIMEOUT_MS }).toBe(7);
	});

	test("rrule until caps recurring generation at the inclusive end date", async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
		await switchToMonthView(obsidian.page);

		const today = todayMidnight();
		const anchor = addDays(today, 2);
		const until = addDays(anchor, 1);
		const expectedDates = [toYMD(until)];

		seedEvent(obsidian.vaultDir, {
			title: "Semester Class",
			startDate: `${formatLocalDate(anchor)}T09:00`,
			endDate: `${formatLocalDate(anchor)}T10:00`,
			rrule: "daily",
			extra: { RRuleUntil: toYMD(until) },
		});

		await refreshCalendar(obsidian.page);
		await waitForEventCount(obsidian.page, 2);

		await expect
			.poll(() => collectInstanceDates(obsidian.vaultDir, "Semester Class"), { timeout: INSTANCE_TIMEOUT_MS })
			.toEqual(expectedDates);

		await expect
			.poll(() => countPhysicalBlocks(obsidian.page, "Semester Class"), { timeout: RENDER_TIMEOUT_MS })
			.toBe(2);
	});
});
