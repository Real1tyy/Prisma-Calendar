import { existsSync, mkdirSync } from "node:fs";
import { basename, join } from "node:path";

import { expect } from "@playwright/test";
import { type BootstrappedObsidian, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { DEFAULT_CALENDAR_ID } from "../../fixtures/constants";
import { fromAnchor } from "../../fixtures/dates";
import { type CalendarHandle, createEventHandle, type EventHandle } from "../../fixtures/dsl";
import { testResilience as test } from "../../fixtures/electron";
import { activateCalendar, addCalendar } from "../../fixtures/resilience-helpers";

// Prisma calendars are differentiated by `directory` AND a per-system property
// schema (start/end/category/etc. each carry a configurable frontmatter key).
// Right-clicking an event exposes "Move to planning system…", which opens a
// schema-driven select modal. Choosing a destination:
//   1. translates the event's frontmatter from the source calendar's prop
//      names to the destination's,
//   2. moves the markdown file from the source directory into the destination
//      directory via Obsidian's `fileManager.renameFile`,
//   3. re-attributes the event reactively — the source bundle drops it, the
//      destination bundle picks it up.

// Directory name intentionally avoids the `Events` prefix — the default
// calendar's directory is `Events`, and a `startsWith` match against `Events-…`
// would make the default bundle keep indexing moved files. `Inbox-Secondary`
// gives clean isolation.
const SECONDARY_DIR = "Inbox-Secondary";
const SECONDARY_ID = "secondary";
const EVENT_TITLE = "Move Target";

const SECONDARY_CONFIG: Record<string, unknown> = {
	id: SECONDARY_ID,
	name: "Secondary",
	enabled: true,
	directory: SECONDARY_DIR,
	// Different property schema so we can verify translation —
	// secondary stores the start time under `Begin` instead of `Start Date`.
	startProp: "Begin",
	endProp: "Finish",
	categoryProp: "Topic",
};

async function setupSecondary(obsidian: BootstrappedObsidian): Promise<void> {
	mkdirSync(join(obsidian.vaultDir, SECONDARY_DIR), { recursive: true });
	// `preserveActiveView` spins up only the new bundle so the primary's
	// already-rendered tile (which we're about to right-click) stays mounted.
	await addCalendar(obsidian.page, SECONDARY_CONFIG, { preserveActiveView: true });
}

/**
 * Shared post-move assertion block. Both tests prove the same outcome via
 * different entry points (context menu vs public API) — the assertions over
 * disk, frontmatter translation, and reactive pickup live here.
 */
async function expectMovedToSecondary(
	obsidian: BootstrappedObsidian,
	calendar: CalendarHandle,
	source: EventHandle,
	expected: { start: string; end: string; category: string }
): Promise<void> {
	const destPath = `${SECONDARY_DIR}/${basename(source.path)}`;

	// File moved on disk into the secondary directory — file name (zettel
	// suffix included) is preserved.
	await expect
		.poll(() => existsSync(join(obsidian.vaultDir, destPath)), {
			message: `expected ${destPath} to exist after move`,
		})
		.toBe(true);
	expect(existsSync(join(obsidian.vaultDir, source.path))).toBe(false);

	// Frontmatter renamed to the secondary's schema. Poll — the rename and
	// frontmatter rewrite happen across two `processFrontMatter` calls, and
	// the rewrite settles a tick after the rename event fires.
	const moved = createEventHandle({ page: obsidian.page, vaultDir: obsidian.vaultDir }, destPath, source.title);
	await moved.expectFrontmatter("Begin", (v) => v === expected.start);
	const fm = readEventFrontmatter(obsidian.vaultDir, destPath);
	expect(fm["Finish"]).toBe(expected.end);
	expect(fm["Topic"]).toBe(expected.category);
	expect(fm["Start Date"]).toBeUndefined();
	expect(fm["End Date"]).toBeUndefined();
	expect(fm["Category"]).toBeUndefined();

	// Secondary picks the event up reactively. Activate its view, pin the
	// viewport to the anchor week so the seed date is visible, then resolve
	// a fresh handle via the DSL — `eventByTitle` waits for the tile to
	// render in the now-active leaf.
	await activateCalendar(obsidian.page, SECONDARY_ID);
	await calendar.switchMode("week");
	await calendar.goToAnchor();
	await calendar.eventByTitle(source.title);

	// Primary drops the event reactively. The source bundle's indexer must
	// observe the rename-out-of-scope and emit a file-deleted for the old
	// path; otherwise the old tile sticks around even though the file has
	// moved on disk. The handle is pinned to the original path, so the DSL
	// `expectVisible(false)` query looks for that exact tile in the active
	// (now primary) leaf — which is precisely the regression signal.
	await activateCalendar(obsidian.page, DEFAULT_CALENDAR_ID);
	await calendar.switchMode("week");
	await calendar.goToAnchor();
	await source.expectVisible(false);
}

test.describe("integrations: event move between calendars", () => {
	test("context menu moves an event into another planning system and translates its schema", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const evt = await calendar.seedOnDisk(EVENT_TITLE, {
			"Start Date": fromAnchor(0, 9, 0),
			"End Date": fromAnchor(0, 10, 0),
			Category: "Work",
		});
		await evt.expectVisible();

		await setupSecondary(obsidian);

		await evt.moveToCalendar(SECONDARY_ID);

		await expectMovedToSecondary(obsidian, calendar, evt, {
			start: fromAnchor(0, 9, 0),
			end: fromAnchor(0, 10, 0),
			category: "Work",
		});
	});

	test("API moveEventToCalendar moves event between bundles with schema translation", async ({
		calendar,
		obsidian,
	}) => {
		// Pro gate is required for `window.PrismaCalendar` to expose the action map.
		await calendar.unlockPro();
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const evt = await calendar.seedOnDisk("API Move", {
			"Start Date": fromAnchor(0, 11, 0),
			"End Date": fromAnchor(0, 12, 0),
			Category: "Personal",
		});
		await evt.expectVisible();

		await setupSecondary(obsidian);

		const result = await obsidian.page.evaluate(
			async ({ filePath, targetId }) => {
				type Api = {
					moveEventToCalendar?: (input: {
						filePath: string;
						targetCalendarId: string;
					}) => Promise<{ success: boolean; movedFilePath?: string; error?: string }>;
				};
				const api = (window as unknown as { PrismaCalendar?: Api }).PrismaCalendar;
				if (!api?.moveEventToCalendar) throw new Error("PrismaCalendar.moveEventToCalendar not exposed");
				return api.moveEventToCalendar({ filePath, targetCalendarId: targetId });
			},
			{ filePath: evt.path, targetId: SECONDARY_ID }
		);

		expect(result.success).toBe(true);
		expect(result.movedFilePath).toBe(`${SECONDARY_DIR}/${basename(evt.path)}`);

		await expectMovedToSecondary(obsidian, calendar, evt, {
			start: fromAnchor(0, 11, 0),
			end: fromAnchor(0, 12, 0),
			category: "Personal",
		});
	});
});
