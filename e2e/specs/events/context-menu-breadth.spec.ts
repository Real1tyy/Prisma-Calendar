import { type Page } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { todayStamp } from "../../fixtures/dates";
import { expect, test } from "../../fixtures/electron";
import { seedEvent, type SeedEventInput } from "../../fixtures/seed-events";
import { listEventFiles, openCalendarReady, rightClickEventMenu } from "./events-helpers";

// Round 3 — Every move / clone / fillTime context-menu item. Each test seeds
// on disk, opens the calendar, invokes the menu, then reads frontmatter from
// disk via `seedAndOpen().readFm()`, which discriminates between the source
// and any clone sharing the same title.

const SEED_POLL_TIMEOUT_MS = 10_000;
const MUTATION_POLL_TIMEOUT_MS = 10_000;
const WEEK_MINUTES = 7 * 24 * 60;

/**
 * Parse an ISO-like string the plugin produces. Prisma stores wall-clock
 * local time with a `Z` suffix (the "local-time-as-UTC" convention); parsing
 * via `new Date()` would shift it by the TZ offset. Stripping the `Z` makes
 * JS parse as local time, matching wall-clock semantics used in the tests.
 */
function parseLocalIso(iso: string): number {
	return new Date(iso.replace(/Z$/, "")).getTime();
}

function minutesBetween(isoA: string, isoB: string): number {
	return Math.round((parseLocalIso(isoB) - parseLocalIso(isoA)) / 60_000);
}

/** Returns every vault-relative path whose file matches `Events/<title>.md` or `Events/<title>-<digits>.md`. */
function pathsForTitle(vaultDir: string, title: string): string[] {
	const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const matcher = new RegExp(`^Events/${escaped}(-\\d+)?\\.md$`);
	return listEventFiles(vaultDir)
		.map((abs) => abs.slice(vaultDir.length + 1))
		.filter((rel) => matcher.test(rel));
}

async function waitForSeed(vaultDir: string, title: string): Promise<void> {
	const deadline = Date.now() + SEED_POLL_TIMEOUT_MS;
	for (;;) {
		if (pathsForTitle(vaultDir, title).length > 0) return;
		if (Date.now() > deadline) throw new Error(`seed for "${title}" never appeared on disk`);
		await new Promise((r) => setTimeout(r, 100));
	}
}

interface Obsidian {
	page: Page;
	vaultDir: string;
}

interface SeedHandle {
	/**
	 * Read the *source* file's frontmatter. When a clone exists that shares the
	 * title, this picks the file whose Start Date still matches the seed —
	 * that's the source; clones have a shifted Start Date.
	 */
	readFm: () => Record<string, unknown>;
}

async function seedAndOpen(obsidian: Obsidian, seed: SeedEventInput): Promise<SeedHandle> {
	seedEvent(obsidian.vaultDir, seed);
	await openCalendarReady(obsidian.page);
	await obsidian.page.locator(".fc-event", { hasText: seed.title }).first().waitFor({ state: "visible" });
	await waitForSeed(obsidian.vaultDir, seed.title);
	const originalStart = seed.startDate ?? seed.date ?? "";

	const readFm = (): Record<string, unknown> => {
		const matches = pathsForTitle(obsidian.vaultDir, seed.title);
		if (matches.length === 0) throw new Error(`no file matches title "${seed.title}"`);
		if (matches.length === 1) return readEventFrontmatter(obsidian.vaultDir, matches[0]!);
		const source = matches.find((rel) => {
			const fm = readEventFrontmatter(obsidian.vaultDir, rel);
			return String(fm["Start Date"] ?? "") === originalStart;
		});
		return readEventFrontmatter(obsidian.vaultDir, source ?? matches[0]!);
	};
	return { readFm };
}

test.describe("event context menu — move/clone/fillTime breadth", () => {
	test("moveToNextWeek shifts Start/End +7 days, file count unchanged", async ({ obsidian }) => {
		const startISO = todayStamp(9, 0);
		const endISO = todayStamp(10, 0);
		const { readFm } = await seedAndOpen(obsidian, { title: "Move Next", startDate: startISO, endDate: endISO });
		const before = listEventFiles(obsidian.vaultDir).length;

		await rightClickEventMenu(obsidian.page, "Move Next", "moveToNextWeek");

		await expect
			.poll(() => String(readFm()["Start Date"] ?? ""), { timeout: MUTATION_POLL_TIMEOUT_MS })
			.not.toBe(startISO);

		const fm = readFm();
		expect(minutesBetween(startISO, String(fm["Start Date"]))).toBe(WEEK_MINUTES);
		expect(minutesBetween(endISO, String(fm["End Date"]))).toBe(WEEK_MINUTES);
		expect(listEventFiles(obsidian.vaultDir).length).toBe(before);
	});

	test("moveToPreviousWeek shifts Start/End -7 days", async ({ obsidian }) => {
		const startISO = todayStamp(9, 0);
		const endISO = todayStamp(10, 0);
		const { readFm } = await seedAndOpen(obsidian, { title: "Move Prev", startDate: startISO, endDate: endISO });

		await rightClickEventMenu(obsidian.page, "Move Prev", "moveToPreviousWeek");

		await expect
			.poll(() => String(readFm()["Start Date"] ?? ""), { timeout: MUTATION_POLL_TIMEOUT_MS })
			.not.toBe(startISO);

		const fm = readFm();
		expect(minutesBetween(startISO, String(fm["Start Date"]))).toBe(-WEEK_MINUTES);
		expect(minutesBetween(endISO, String(fm["End Date"]))).toBe(-WEEK_MINUTES);
	});

	test("cloneToNextWeek creates a new file +7 days; original unchanged", async ({ obsidian }) => {
		const startISO = todayStamp(9, 0);
		const endISO = todayStamp(10, 0);
		const { readFm } = await seedAndOpen(obsidian, { title: "Clone Next", startDate: startISO, endDate: endISO });
		const countBefore = pathsForTitle(obsidian.vaultDir, "Clone Next").length;

		await rightClickEventMenu(obsidian.page, "Clone Next", "cloneToNextWeek");

		// Poll until a new "Clone Next" file appears — exactly one more than before.
		await expect
			.poll(() => pathsForTitle(obsidian.vaultDir, "Clone Next").length, { timeout: MUTATION_POLL_TIMEOUT_MS })
			.toBe(countBefore + 1);

		const source = readFm();
		expect(source["Start Date"]).toBe(startISO);
		expect(source["End Date"]).toBe(endISO);

		// The clone is the file whose Start Date differs from the source's —
		// that's how we discriminate regardless of which stamp lands first.
		const clone = pathsForTitle(obsidian.vaultDir, "Clone Next")
			.map((rel) => ({ rel, fm: readEventFrontmatter(obsidian.vaultDir, rel) }))
			.find(({ fm }) => fm["Start Date"] !== startISO);
		if (!clone) throw new Error("could not find clone file by Start Date");
		expect(minutesBetween(startISO, String(clone.fm["Start Date"]))).toBe(WEEK_MINUTES);
		expect(minutesBetween(endISO, String(clone.fm["End Date"]))).toBe(WEEK_MINUTES);
	});

	test("cloneToPreviousWeek creates a new file -7 days", async ({ obsidian }) => {
		const startISO = todayStamp(9, 0);
		const endISO = todayStamp(10, 0);
		await seedAndOpen(obsidian, { title: "Clone Prev", startDate: startISO, endDate: endISO });
		const countBefore = pathsForTitle(obsidian.vaultDir, "Clone Prev").length;

		await rightClickEventMenu(obsidian.page, "Clone Prev", "cloneToPreviousWeek");

		await expect
			.poll(() => pathsForTitle(obsidian.vaultDir, "Clone Prev").length, { timeout: MUTATION_POLL_TIMEOUT_MS })
			.toBe(countBefore + 1);

		const clone = pathsForTitle(obsidian.vaultDir, "Clone Prev")
			.map((rel) => ({ rel, fm: readEventFrontmatter(obsidian.vaultDir, rel) }))
			.find(({ fm }) => fm["Start Date"] !== startISO);
		if (!clone) throw new Error("could not find clone file by Start Date");
		expect(minutesBetween(startISO, String(clone.fm["Start Date"]))).toBe(-WEEK_MINUTES);
		expect(minutesBetween(endISO, String(clone.fm["End Date"]))).toBe(-WEEK_MINUTES);
	});

	test("fillStartTimeNow lands between wall-clock-before and wall-clock-after", async ({ obsidian }) => {
		const startISO = todayStamp(1, 0);
		const endISO = todayStamp(2, 0);
		const { readFm } = await seedAndOpen(obsidian, { title: "Fill Start Now", startDate: startISO, endDate: endISO });

		const before = Date.now();
		await rightClickEventMenu(obsidian.page, "Fill Start Now", "fillStartTimeNow");
		await expect
			.poll(() => String(readFm()["Start Date"] ?? ""), { timeout: MUTATION_POLL_TIMEOUT_MS })
			.not.toBe(startISO);
		const after = Date.now();

		const actual = parseLocalIso(String(readFm()["Start Date"]));
		expect(actual).toBeGreaterThanOrEqual(before - 60_000);
		expect(actual).toBeLessThanOrEqual(after + 60_000);
	});

	test("fillEndTimeNow lands between wall-clock-before and wall-clock-after", async ({ obsidian }) => {
		const startISO = todayStamp(1, 0);
		const endISO = todayStamp(2, 0);
		const { readFm } = await seedAndOpen(obsidian, { title: "Fill End Now", startDate: startISO, endDate: endISO });

		const before = Date.now();
		await rightClickEventMenu(obsidian.page, "Fill End Now", "fillEndTimeNow");
		await expect.poll(() => String(readFm()["End Date"] ?? ""), { timeout: MUTATION_POLL_TIMEOUT_MS }).not.toBe(endISO);
		const after = Date.now();

		const actual = parseLocalIso(String(readFm()["End Date"]));
		expect(actual).toBeGreaterThanOrEqual(before - 60_000);
		expect(actual).toBeLessThanOrEqual(after + 60_000);
	});

	test("fillStartTimePrevious snaps Start to the previous event's End (exact)", async ({ obsidian }) => {
		const prevStart = todayStamp(9, 0);
		const prevEnd = todayStamp(9, 30);
		seedEvent(obsidian.vaultDir, { title: "Previous Event", startDate: prevStart, endDate: prevEnd });

		const targetStart = todayStamp(10, 0);
		const targetEnd = todayStamp(11, 0);
		const { readFm } = await seedAndOpen(obsidian, {
			title: "Target Start",
			startDate: targetStart,
			endDate: targetEnd,
		});
		await obsidian.page.locator(".fc-event", { hasText: "Previous Event" }).first().waitFor({ state: "visible" });

		await rightClickEventMenu(obsidian.page, "Target Start", "fillStartTimePrevious");

		// The plugin may rewrite the ISO format when it persists (adding `:ss.SSSZ`);
		// compare as parsed timestamps so the test tolerates the format drift while
		// still asserting the exact wall-clock time.
		await expect
			.poll(() => parseLocalIso(String(readFm()["Start Date"] ?? "")), { timeout: MUTATION_POLL_TIMEOUT_MS })
			.toBe(parseLocalIso(prevEnd));

		// End must be untouched — only Start snaps.
		expect(parseLocalIso(String(readFm()["End Date"]))).toBe(parseLocalIso(targetEnd));
	});

	test("fillEndTimeNext snaps End to the next event's Start (exact)", async ({ obsidian }) => {
		const targetStart = todayStamp(10, 0);
		const targetEnd = todayStamp(11, 0);
		const { readFm } = await seedAndOpen(obsidian, {
			title: "Target End",
			startDate: targetStart,
			endDate: targetEnd,
		});

		const nextStart = todayStamp(12, 0);
		const nextEnd = todayStamp(13, 0);
		seedEvent(obsidian.vaultDir, { title: "Next Event", startDate: nextStart, endDate: nextEnd });
		await obsidian.page.locator(".fc-event", { hasText: "Next Event" }).first().waitFor({ state: "visible" });

		await rightClickEventMenu(obsidian.page, "Target End", "fillEndTimeNext");

		await expect
			.poll(() => parseLocalIso(String(readFm()["End Date"] ?? "")), { timeout: MUTATION_POLL_TIMEOUT_MS })
			.toBe(parseLocalIso(nextStart));

		// Start must be untouched — only End snaps.
		expect(parseLocalIso(String(readFm()["Start Date"]))).toBe(parseLocalIso(targetStart));
	});
});
