import { expect, type Locator } from "@playwright/test";

import {
	createEventViaModal,
	formatLocalDate,
	listEventFiles,
	monthsFromTodayTo,
	navigateCalendar,
	type ObsidianHandle,
	openCalendarReady,
	switchToMonthView,
	virtualInstanceLocator,
} from "./events-helpers";

// Small helpers used only by the Round 2/3/4 robustness specs. Every helper
// here composes existing primitives — nothing that belongs in shared/e2e
// (Foundation-owned) or in `events-helpers.ts` (Round 1-owned).
//
// Settings mutation uses `updateCalendarSettings` from `fixtures/seed-events.ts`.

const POLL_INTERVAL_MS = 100;
const DEFAULT_POLL_TIMEOUT_MS = 10_000;

/**
 * Match a physical instance filename for `title`: `Title YYYY-MM-DD-<zettel>.md`
 * — the space-date-zettel suffix is what distinguishes instances from the
 * source event note, which uses `Title-<zettel>.md` (no date token).
 *
 * Mirrors the regex in `events/recurring.spec.ts`; kept local to avoid a
 * circular import between two spec-adjacent helper files.
 */
export function instanceFileRegex(title: string): RegExp {
	const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`/${escaped} (\\d{4})-(\\d{2})-(\\d{2})-\\d+\\.md$`);
}

/** Parse `YYYY-MM-DD` captured from the filename into a local Date. */
export function parseInstanceDate(match: RegExpMatchArray): Date {
	return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function collectInstanceFiles(vaultDir: string, title: string): string[] {
	const regex = instanceFileRegex(title);
	return listEventFiles(vaultDir).filter((p) => regex.test(p));
}

/**
 * Sorted list of instance dates (`YYYY-MM-DD`) parsed out of the physical
 * instance filenames for `title`. Used by the recurring-events spec to
 * assert the *exact* calendar dates the plugin materialised, not just the
 * count — the count is a weaker signal because the plugin's past-events
 * boundary is inclusive of today, which is easy to miscount.
 */
export function collectInstanceDates(vaultDir: string, title: string): string[] {
	const regex = instanceFileRegex(title);
	return collectInstanceFiles(vaultDir, title)
		.map((abs) => {
			const match = abs.match(regex);
			return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
		})
		.filter((d): d is string => d !== null)
		.sort();
}

/** Local-calendar `YYYY-MM-DD` for a Date — no timezone conversion. */
export function toYMD(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/** Clone `d` and shift by `days` calendar days in local time. */
export function addDays(d: Date, days: number): Date {
	const next = new Date(d);
	next.setDate(next.getDate() + days);
	return next;
}

/** Local midnight today — anchor for date-offset expectations across the recurring suite. */
export function todayMidnight(): Date {
	const t = new Date();
	t.setHours(0, 0, 0, 0);
	return t;
}

/**
 * Poll until `predicate()` returns true. Throws with `message` on timeout.
 * Used by propagation specs that poll for frontmatter changes after
 * PROPAGATION_DEBOUNCE_MS + propagation work settles.
 */
export async function waitFor(
	predicate: () => boolean | Promise<boolean>,
	message: string,
	timeoutMs = DEFAULT_POLL_TIMEOUT_MS
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		if (await predicate()) return;
		if (Date.now() > deadline) throw new Error(`waitFor timed out: ${message}`);
		await new Promise((r) => window.setTimeout(r, POLL_INTERVAL_MS));
	}
}

const RECURRING_INSTANCE_TIMEOUT_MS = 15_000;
const VIRTUAL_REVEAL_MAX_MONTHS = 12;

/**
 * Setup a weekly-recurring source event anchored at `dayOfMonth` of next
 * month, wait for the two default physical instances to materialise at +7
 * and +14, then navigate the active calendar to the anchor month so all
 * three blocks (source + 2 physicals) are inside the rendered view.
 *
 * The next-month anchor is chosen so source, +7, and +14 all sit within one
 * rendered month — avoids flakes near month boundaries that show up when
 * anchoring near today.
 */
export async function setupWeeklyRecurringAtNextMonth(
	obsidian: ObsidianHandle,
	title: string,
	dayOfMonth = 5
): Promise<{ sourcePath: string; anchor: Date; expectedDates: [string, string] }> {
	await openCalendarReady(obsidian.page);
	await switchToMonthView(obsidian.page);

	const today = todayMidnight();
	const anchor = new Date(today.getFullYear(), today.getMonth() + 1, dayOfMonth);
	const anchorStr = formatLocalDate(anchor);
	const expectedDates: [string, string] = [toYMD(addDays(anchor, 7)), toYMD(addDays(anchor, 14))];

	const sourcePath = await createEventViaModal(obsidian, {
		title,
		start: `${anchorStr}T09:00`,
		end: `${anchorStr}T10:00`,
		recurring: { rruleType: "custom", customFreq: "WEEKLY", customInterval: 1 },
	});

	await expect
		.poll(() => collectInstanceDates(obsidian.vaultDir, title), { timeout: RECURRING_INSTANCE_TIMEOUT_MS })
		.toEqual(expectedDates);

	await navigateCalendar(obsidian.page, monthsFromTodayTo(anchorStr));

	return { sourcePath, anchor, expectedDates };
}

/**
 * Locate the first virtual-instance block for `title`, advancing the calendar
 * forward one month at a time until at least one is rendered. Throws if none
 * appears within `maxMonths` advances — that's a real defect because virtuals
 * are unbounded for an open-ended weekly RRule.
 *
 * Used by drag-revert specs where a virtual instance must exist somewhere
 * downstream of the source; skipping the test when none is in the current
 * month would let regressions slip past on calendar months that happen to
 * land on a boundary.
 */
export async function revealVirtualInstance(
	obsidian: ObsidianHandle,
	title: string,
	maxMonths = VIRTUAL_REVEAL_MAX_MONTHS
): Promise<Locator> {
	const blocks = virtualInstanceLocator(obsidian.page, title);
	for (let advanced = 0; advanced <= maxMonths; advanced++) {
		if ((await blocks.count()) > 0) return blocks.first();
		await navigateCalendar(obsidian.page, 1);
	}
	throw new Error(`revealVirtualInstance: no virtual instance for "${title}" within ${maxMonths} months`);
}
