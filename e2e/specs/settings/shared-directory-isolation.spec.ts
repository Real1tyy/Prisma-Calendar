import type { Page } from "@playwright/test";
import { setTextInput, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { fromAnchor } from "../../fixtures/dates";
import { expect, testWithSeededFiles as test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, setSchemaTextInput, switchSettingsTab } from "../../fixtures/helpers";
import { getCalendars } from "../../fixtures/plugin-data";
import { type SeedEventInput, seedEvents, waitForCalendarCount } from "../../fixtures/seed-events";
import { expectEventVisible, openCalendarView } from "../events/events-helpers";

// ─── Dataset: one directory, two property schemas ────────────────────────────
//
// "Shared" folder contains 4 notes. Two use "Start Date"/"End Date", two use
// "Start"/"End". Each planning system is configured for one schema and should
// see only its matching events.

const SHARED_DIR = "Shared";

const SCHEMA_A_EVENTS: SeedEventInput[] = [
	{
		title: "Weekly Review",
		subdir: SHARED_DIR,
		extra: {
			"Start Date": fromAnchor(0, 9),
			"End Date": fromAnchor(0, 10),
		},
	},
	{
		title: "Budget Meeting",
		subdir: SHARED_DIR,
		extra: {
			"Start Date": fromAnchor(1, 14),
			"End Date": fromAnchor(1, 15),
		},
	},
];

const SCHEMA_B_EVENTS: SeedEventInput[] = [
	{
		title: "Design Sprint",
		subdir: SHARED_DIR,
		extra: {
			Start: fromAnchor(0, 11),
			End: fromAnchor(0, 12),
		},
	},
	{
		title: "Code Review",
		subdir: SHARED_DIR,
		extra: {
			Start: fromAnchor(1, 16),
			End: fromAnchor(1, 17),
		},
	},
];

async function configureCalendarManually(page: Page, dir: string, startProp: string, endProp: string): Promise<void> {
	// Commit properties first so the parser knows which frontmatter keys to
	// look for when the directory change triggers indexing.
	await switchSettingsTab(page, "properties");
	await setSchemaTextInput(page, "startProp", startProp);
	await setSchemaTextInput(page, "endProp", endProp);
	await settleSettings(page, { pluginId: PLUGIN_ID });
	await switchSettingsTab(page, "general");
	await setTextInput(page, "prisma-settings-control-directory", dir);
	await settleSettings(page, { pluginId: PLUGIN_ID });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("shared directory isolation: planning systems on the same folder", () => {
	test.beforeEach(async ({ obsidian }) => {
		seedEvents(obsidian.vaultDir, [...SCHEMA_A_EVENTS, ...SCHEMA_B_EVENTS]);
		await obsidian.page.waitForTimeout(2000);
	});

	test("same directory, different properties — each planning system sees only its matching events", async ({
		obsidian,
	}) => {
		const { page } = obsidian;

		// Configure default calendar → Shared dir with "Start Date"/"End Date"
		await openPrismaSettings(page);
		await configureCalendarManually(page, SHARED_DIR, "Start Date", "End Date");
		await closeSettings(page);

		await openCalendarView(page, "default");
		await expectEventVisible(page, "Weekly Review", 20_000);
		await expectEventVisible(page, "Budget Meeting");

		// Create second planning system → same dir, "Start"/"End"
		await openPrismaSettings(page);
		const calendarsBefore = getCalendars(obsidian.vaultDir);
		await page.locator('[data-testid="prisma-settings-calendar-add"]').click();
		await waitForCalendarCount(page, 2);
		const calendarsAfter = getCalendars(obsidian.vaultDir);
		const secondId = calendarsAfter.find((c) => !calendarsBefore.some((b) => b.id === c.id))!.id;
		await closeSettings(page);
		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(secondId);
		await configureCalendarManually(page, SHARED_DIR, "Start", "End");
		await closeSettings(page);

		// Second planning system shows only Schema B events
		await openCalendarView(page, secondId);
		await expectEventVisible(page, "Design Sprint", 20_000);
		await expectEventVisible(page, "Code Review");

		// First planning system still shows only Schema A events
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Weekly Review");
		await expectEventVisible(page, "Budget Meeting");

		// Verify exact counts via plugin API — no cross-contamination
		const counts = await page.evaluate((pid) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<
							string,
							{ calendarBundles?: Array<{ calendarId: string; eventStore: { getAllEvents: () => unknown[] } }> }
						>;
					};
				};
			};
			const bundles = w.app.plugins.plugins[pid]?.calendarBundles ?? [];
			return Object.fromEntries(bundles.map((b) => [b.calendarId, b.eventStore.getAllEvents().length]));
		}, PLUGIN_ID);

		expect(counts["default"]).toBe(2);
		expect(counts[secondId]).toBe(2);
	});

	test("same directory, same properties — both planning systems see all events independently", async ({ obsidian }) => {
		const { page } = obsidian;

		// Configure default calendar → Shared dir with "Start Date"/"End Date"
		await openPrismaSettings(page);
		await configureCalendarManually(page, SHARED_DIR, "Start Date", "End Date");
		await closeSettings(page);

		await openCalendarView(page, "default");
		await expectEventVisible(page, "Weekly Review", 20_000);

		// Create second planning system → same dir, same properties
		await openPrismaSettings(page);
		const calendarsBefore = getCalendars(obsidian.vaultDir);
		await page.locator('[data-testid="prisma-settings-calendar-add"]').click();
		await waitForCalendarCount(page, 2);
		const calendarsAfter = getCalendars(obsidian.vaultDir);
		const secondId = calendarsAfter.find((c) => !calendarsBefore.some((b) => b.id === c.id))!.id;
		await closeSettings(page);
		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(secondId);
		await configureCalendarManually(page, SHARED_DIR, "Start Date", "End Date");
		await closeSettings(page);

		// Both planning systems see Schema A events
		await openCalendarView(page, secondId);
		await expectEventVisible(page, "Weekly Review", 20_000);
		await expectEventVisible(page, "Budget Meeting");

		await openCalendarView(page, "default");
		await expectEventVisible(page, "Weekly Review");
		await expectEventVisible(page, "Budget Meeting");
	});

	test("deleting one planning system on a shared directory does not affect the other", async ({ obsidian }) => {
		const { page } = obsidian;

		// Set up two planning systems on the same directory
		await openPrismaSettings(page);
		await configureCalendarManually(page, SHARED_DIR, "Start Date", "End Date");
		const calendarsBefore = getCalendars(obsidian.vaultDir);
		await page.locator('[data-testid="prisma-settings-calendar-add"]').click();
		await waitForCalendarCount(page, 2);
		const calendarsAfter = getCalendars(obsidian.vaultDir);
		const secondId = calendarsAfter.find((c) => !calendarsBefore.some((b) => b.id === c.id))!.id;
		await closeSettings(page);
		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(secondId);
		await configureCalendarManually(page, SHARED_DIR, "Start", "End");
		await closeSettings(page);

		// Verify both work
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Weekly Review", 20_000);
		await openCalendarView(page, secondId);
		await expectEventVisible(page, "Design Sprint", 20_000);

		// Delete the second planning system
		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(secondId);
		await page.locator('[data-testid="prisma-settings-calendar-delete"]').click();
		await waitForCalendarCount(page, 1);

		// First still works
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Weekly Review");
		await expectEventVisible(page, "Budget Meeting");
	});
});
