import type { Page } from "@playwright/test";

import { expectEventsNotVisibleByTitle, expectEventsVisibleByTitle, expectTitleCount } from "../history-helpers";
import type { EventHandle } from "./event";

// Bulk operations over a list of EventHandles. Specs that exercise batch ops
// used to repeat `for (const e of events) await e.expectX(...)` 4–6× per test;
// these helpers collapse that to one call. All of them are thin loops around
// the single-event primitives — no new semantics, just less noise.

export async function expectAllExist(events: readonly EventHandle[], yes: boolean): Promise<void> {
	for (const e of events) await e.expectExists(yes);
}

export async function expectAllFrontmatter(
	events: readonly EventHandle[],
	key: string,
	matcher: (v: unknown) => boolean
): Promise<void> {
	for (const e of events) await e.expectFrontmatter(key, matcher);
}

export async function expectAllVisible(page: Page, events: readonly EventHandle[]): Promise<void> {
	await expectEventsVisibleByTitle(
		page,
		events.map((e) => e.title)
	);
}

export async function expectAllHidden(page: Page, events: readonly EventHandle[]): Promise<void> {
	await expectEventsNotVisibleByTitle(
		page,
		events.map((e) => e.title)
	);
}

/** Assert each event's title is currently rendered `n` times in the active leaf. */
export async function expectAllTitleCount(page: Page, events: readonly EventHandle[], n: number): Promise<void> {
	for (const e of events) await expectTitleCount(page, e.title, n);
}
