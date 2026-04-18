import { readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";

import { expect, type Page } from "@playwright/test";

import { ACTIVE_CALENDAR_LEAF, PLUGIN_ID } from "./constants";
import { seedEvent, type SeedEventInput, updateCalendarSettings } from "./seed-events";

// Helpers for high-volume / reactivity stress specs. The premise: the calendar
// must be *eventually consistent* — after any batch mutation (move, clone,
// skip, delete, undo/redo) the DOM-rendered event set must converge to match
// the on-disk event set, regardless of how many files changed at once. A
// "partial refresh" (some events move, some stay stale) is a prod-breaking
// bug. Every helper here polls on both the indexer state and the DOM so
// assertions catch divergence rather than race against it.

const EVENT_IN_LEAF = `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-event"]`;

export interface BulkSeedOptions {
	/** Prefix for auto-generated titles (default "Bulk"). */
	prefix?: string;
	/** First event's day offset from today (0 = today). Default 0. */
	startDayOffset?: number;
	/** Number of distinct days the events span. Events loop around via modulo. Default 7. */
	spreadDays?: number;
	/** First slot's hour-of-day (default 9). Subsequent slots stack +1h within each day. */
	startHour?: number;
	/** Optional subdir under vaultDir (default "Events"). */
	subdir?: string;
}

/**
 * Days-from-today offset pointing at the Sunday that starts the current week.
 * FullCalendar's default `firstDay` is Sunday. Seeds anchored here land events
 * inside the current `listWeek` / `timeGridWeek` window regardless of what day
 * of the week the test happens to run on.
 */
export function currentWeekStartOffset(): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return -today.getDay();
}

/**
 * Bump per-slot stacking / per-day caps to the max allowed values so stress
 * tests can render 10+ events in one time cell without FullCalendar
 * collapsing them into a "+more" link. Does NOT affect correctness — only
 * DOM visibility — so specs can count `[data-testid="prisma-cal-event"]`
 * nodes directly.
 */
export async function raiseRenderCapsForStress(page: Page): Promise<void> {
	await updateCalendarSettings(page, {
		eventMaxStack: 10,
		desktopMaxEventsPerDay: 0,
	});
}

/**
 * Race-safe event-file count. The shared `listEventFiles` helper walks the
 * Events/ tree with a `readdirSync` + per-entry `statSync`; under bulk undo
 * or batch delete the plugin deletes files in quick succession, and a stat
 * on an entry that vanished between readdir and stat throws ENOENT. This
 * wrapper tolerates that race by retrying once after a short pause —
 * callers are already polling via `expect.poll` so an occasional retry is
 * cheap.
 */
export function safeEventFileCount(vaultDir: string, subdir = "Events"): number {
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			return countMdFilesRecursive(join(vaultDir, subdir));
		} catch (err) {
			if (!isEnoent(err)) throw err;
			// tight retry — the race window is sub-ms; poll caller provides the outer timing
		}
	}
	// Final attempt — let the error propagate if the vault is truly broken.
	return countMdFilesRecursive(join(vaultDir, subdir));
}

function countMdFilesRecursive(dir: string): number {
	let total = 0;
	let entries: string[];
	try {
		entries = readdirSync(dir);
	} catch (err) {
		if (isEnoent(err)) return 0;
		throw err;
	}
	for (const entry of entries) {
		const full = join(dir, entry);
		let stat;
		try {
			stat = statSync(full);
		} catch (err) {
			if (isEnoent(err)) continue;
			throw err;
		}
		if (stat.isDirectory()) {
			total += countMdFilesRecursive(full);
		} else if (stat.isFile() && entry.endsWith(".md") && entry !== "Virtual Events.md") {
			total += 1;
		}
	}
	return total;
}

function isEnoent(err: unknown): boolean {
	return typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code === "ENOENT";
}

/**
 * Remove the `Team Meeting.md` that ships in the vault seed. Stress specs
 * assume a known-empty Events/ directory so absolute file / indexer counts
 * match the seeded batch exactly. The seed's sample event shows up in the
 * default E2E suite to prove the indexer works end-to-end; it does not
 * belong in stress-test reasoning.
 */
export function clearVaultSeedEvents(vaultDir: string): void {
	const sampleEvent = join(vaultDir, "Events", "Team Meeting.md");
	rmSync(sampleEvent, { force: true });
}

/**
 * Seed `count` timed events to disk, spread across `spreadDays` consecutive
 * days. Titles are deterministic and zero-padded (`<prefix> 001` … `<prefix> N`)
 * so lexical ordering matches numeric ordering — handy when per-title
 * assertions loop a slice of the batch.
 *
 * Writes bypass the create-event modal: this is a disk-level seed, indexed the
 * same way any on-disk event file is. Pair with `waitForIndexerToReach` to
 * gate the test on indexer convergence before the first mutation.
 */
export function seedBulkEvents(vaultDir: string, count: number, options: BulkSeedOptions = {}): string[] {
	const prefix = options.prefix ?? "Bulk";
	const spread = Math.max(1, options.spreadDays ?? 7);
	const startOffset = options.startDayOffset ?? 0;
	const baseHour = options.startHour ?? 9;
	const subdir = options.subdir ?? "Events";
	const width = Math.max(3, String(count).length);
	const paths: string[] = [];

	const base = new Date();
	base.setHours(0, 0, 0, 0);

	for (let i = 0; i < count; i++) {
		const dayIndex = i % spread;
		const slotInDay = Math.floor(i / spread);
		// 8 slots per day cap keeps events within 09:00–17:00 and avoids
		// crossing midnight when spread is small relative to count.
		const hour = baseHour + (slotInDay % 8);
		const day = new Date(base);
		day.setDate(base.getDate() + startOffset + dayIndex);
		const ymd = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;

		const title = `${prefix} ${String(i + 1).padStart(width, "0")}`;
		const input: SeedEventInput = {
			title,
			startDate: `${ymd}T${String(hour).padStart(2, "0")}:00`,
			endDate: `${ymd}T${String(hour + 1).padStart(2, "0")}:00`,
			subdir,
		};
		paths.push(seedEvent(vaultDir, input));
	}
	return paths;
}

/**
 * Count unique events rendered in the active calendar leaf. Dedups FullCalendar's
 * overflow / multi-day clones by `data-event-file-path`: month view injects
 * extra DOM nodes with the same path for "+N more" popovers and multi-day
 * spans, inflating the raw `[data-testid="prisma-cal-event"]` count.
 *
 * In week / day / list views this matches the intuitive count (one DOM node
 * per event). In month view it counts distinct events, ignoring overflow
 * clone-rendering.
 */
export async function uniqueVisibleEventCount(page: Page): Promise<number> {
	return page.evaluate((selector) => {
		const elements = document.querySelectorAll(selector);
		const paths = new Set<string>();
		let untitledWithoutPath = 0;
		for (const el of elements) {
			const fp = (el as HTMLElement).getAttribute("data-event-file-path");
			if (fp) {
				paths.add(fp);
			} else {
				untitledWithoutPath += 1;
			}
		}
		return paths.size + untitledWithoutPath;
	}, EVENT_IN_LEAF);
}

/** Count events the plugin's indexer currently holds for the default bundle. */
export async function indexerEventCount(page: Page): Promise<number> {
	return page.evaluate((pid) => {
		const w = window as unknown as {
			app: {
				plugins: {
					plugins: Record<
						string,
						{
							calendarBundles?: Array<{ eventStore: { getAllEvents: () => unknown[] } }>;
						}
					>;
				};
			};
		};
		const plugin = w.app.plugins.plugins[pid];
		const bundle = plugin?.calendarBundles?.[0];
		return bundle?.eventStore.getAllEvents().length ?? 0;
	}, PLUGIN_ID);
}

/**
 * Poll until the indexer reaches exactly `expected` events. Large seeded vaults
 * take noticeably longer to ingest than the 500ms refresh window bakes in, so
 * the tolerance here is generous by default.
 */
export async function waitForIndexerToReach(page: Page, expected: number): Promise<void> {
	await expect
		.poll(() => indexerEventCount(page), { message: `indexer never reached ${expected} events` })
		.toBe(expected);
}

/**
 * Assert the rendered DOM converges to exactly `expected` unique events in
 * the active calendar leaf. Uses `expect.poll` so a momentarily stale render
 * (diff in progress, RAF not yet fired) doesn't fail the spec — but a
 * persistently stale render does. Prefer this over `visibleEventCount`
 * followed by `toBe`, which races the DOM and flakes.
 */
export async function expectUniqueVisibleEventCount(page: Page, expected: number): Promise<void> {
	await expect
		.poll(() => uniqueVisibleEventCount(page), {
			message: `calendar DOM never converged to ${expected} unique visible events`,
		})
		.toBe(expected);
}

/**
 * Joint assertion: indexer AND DOM converge on the expected counts. The whole
 * point of the stress suite — if either diverges we've found a reactivity
 * regression. `indexer` is always the source of truth for "how many events
 * the plugin thinks exist". `visible` is the DOM-rendered subset within the
 * currently-visible view range; for an all-today seed in week/day/list view
 * the two should match, for events scattered across months `visible` < `indexer`.
 */
export async function expectCalendarConsistent(
	page: Page,
	options: { indexer: number; visible: number }
): Promise<void> {
	await waitForIndexerToReach(page, options.indexer);
	await expectUniqueVisibleEventCount(page, options.visible);
}
