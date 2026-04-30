import type { Page } from "@playwright/test";
import { settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { fromAnchor } from "../../fixtures/dates";
import { expect, testWithSeededFiles as test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings } from "../../fixtures/helpers";
import { getCalendars } from "../../fixtures/plugin-data";
import { type SeedEventInput, seedEvents, waitForCalendarCount } from "../../fixtures/seed-events";
import { expectEventVisible, openCalendarView } from "../events/events-helpers";

// ─── Dataset: three folders with distinct property schemas ───────────────────

const MEETINGS: SeedEventInput[] = [
	{
		title: "Team Standup",
		subdir: "Meetings",
		extra: {
			"Meeting Start": fromAnchor(0, 9),
			"Meeting End": fromAnchor(0, 10),
			"Created On": fromAnchor(0).slice(0, 10),
		},
	},
	{
		title: "Sprint Planning",
		subdir: "Meetings",
		extra: {
			"Meeting Start": fromAnchor(1, 14),
			"Meeting End": fromAnchor(1, 15),
			"Created On": fromAnchor(1).slice(0, 10),
		},
	},
];

const PERSONAL: SeedEventInput[] = [
	{
		title: "Guitar Lesson",
		subdir: "Personal",
		extra: {
			"Start Time": fromAnchor(0, 18),
			"End Time": fromAnchor(0, 19),
			Due: fromAnchor(0).slice(0, 10),
		},
	},
	{
		title: "Yoga Class",
		subdir: "Personal",
		extra: {
			"Start Time": fromAnchor(1, 7),
			"End Time": fromAnchor(1, 8),
			Due: fromAnchor(1).slice(0, 10),
		},
	},
];

const WORK_PROJECTS: SeedEventInput[] = [
	{
		title: "API Rate Limiting",
		subdir: "Work Projects",
		extra: {
			Start: fromAnchor(0, 10),
			End: fromAnchor(0, 17),
			"Review Date": fromAnchor(0).slice(0, 10),
		},
	},
	{
		title: "Security Audit",
		subdir: "Work Projects",
		extra: {
			Start: fromAnchor(1, 10),
			End: fromAnchor(1, 17),
			"Review Date": fromAnchor(1).slice(0, 10),
		},
	},
];

async function configureCalendarViaModal(page: Page, folderName: string): Promise<void> {
	await page.locator('[data-testid="prisma-settings-calendar-configure"]').click();
	const modal = page.locator('[data-testid="prisma-configure-calendar-modal"]');
	await modal.waitFor({ state: "visible" });
	const cards = modal.locator(".prisma-first-launch-suggestion");
	await expect(cards.first()).toBeVisible();
	await cards.filter({ hasText: folderName }).click();
	await modal.locator('[data-testid="prisma-configure-save"]').click();
	await settleSettings(page, { pluginId: PLUGIN_ID });
}

async function createAndConfigureCalendar(
	page: Page,
	vaultDir: string,
	folderName: string,
	expectedBundleCount: number
): Promise<string> {
	const calendarsBefore = getCalendars(vaultDir);
	await page.locator('[data-testid="prisma-settings-calendar-add"]').click();
	await waitForCalendarCount(page, expectedBundleCount);

	const calendarsAfter = getCalendars(vaultDir);
	const newCal = calendarsAfter.find((c) => !calendarsBefore.some((b) => b.id === c.id))!;

	// Close and reopen settings so React mounts with fresh state — the stale
	// handleConfigure closure from before the create would save to the wrong
	// calendar otherwise.
	await closeSettings(page);
	await openPrismaSettings(page);

	const dropdown = page.locator(".prisma-calendar-management select.dropdown");
	await dropdown.selectOption(newCal.id);
	await configureCalendarViaModal(page, folderName);
	return newCal.id;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("multi-calendar lifecycle: create, configure, delete without full refresh", () => {
	test.beforeEach(async ({ obsidian }) => {
		seedEvents(obsidian.vaultDir, [...MEETINGS, ...PERSONAL, ...WORK_PROJECTS]);
		await obsidian.page.waitForTimeout(2000);
	});

	test("creating a new calendar does not close settings or re-index existing calendars", async ({ obsidian }) => {
		const { page } = obsidian;

		// Configure the default calendar to Meetings
		await openPrismaSettings(page);
		await configureCalendarViaModal(page, "Meetings");
		await expect(page.locator(".modal-container .mod-settings")).toBeVisible();
		await closeSettings(page);

		// Verify Meetings events are visible
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Team Standup", 20_000);
		await expectEventVisible(page, "Sprint Planning");

		// Create a new calendar — settings must stay open
		await openPrismaSettings(page);
		const newCalId = await createAndConfigureCalendar(page, obsidian.vaultDir, "Personal", 2);
		await expect(page.locator(".modal-container .mod-settings")).toBeVisible();
		await closeSettings(page);

		// Verify the new calendar shows Personal events
		await openCalendarView(page, newCalId);
		await expectEventVisible(page, "Guitar Lesson", 20_000);
		await expectEventVisible(page, "Yoga Class");

		// Switch back to default — Meetings events still there, no re-index
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Team Standup");
		await expectEventVisible(page, "Sprint Planning");
	});

	test("deleting a calendar does not affect other calendars", async ({ obsidian }) => {
		const { page } = obsidian;

		// Set up: configure default to Meetings, create second for Personal
		await openPrismaSettings(page);
		await configureCalendarViaModal(page, "Meetings");
		const secondCalId = await createAndConfigureCalendar(page, obsidian.vaultDir, "Personal", 2);
		await closeSettings(page);

		// Verify both calendars work
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Team Standup", 20_000);

		await openCalendarView(page, secondCalId);
		await expectEventVisible(page, "Guitar Lesson", 20_000);

		// Select the second calendar and delete it
		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(secondCalId);
		await page.locator('[data-testid="prisma-settings-calendar-delete"]').click();
		await waitForCalendarCount(page, 1);

		const calendarsAfterDelete = getCalendars(obsidian.vaultDir);
		expect(calendarsAfterDelete).toHaveLength(1);
		expect(calendarsAfterDelete[0].id).toBe("default");

		// Default calendar still shows Meetings events — no re-index
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Team Standup");
		await expectEventVisible(page, "Sprint Planning");
	});

	test("full lifecycle: create three calendars, configure each, delete one, remaining still work", async ({
		obsidian,
	}) => {
		const { page } = obsidian;

		// Step 1: Configure default calendar → Meetings
		await openPrismaSettings(page);
		await configureCalendarViaModal(page, "Meetings");
		await closeSettings(page);
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Team Standup", 20_000);

		// Step 2: Create second calendar → Personal
		await openPrismaSettings(page);
		const secondId = await createAndConfigureCalendar(page, obsidian.vaultDir, "Personal", 2);
		await closeSettings(page);

		await openCalendarView(page, secondId);
		await expectEventVisible(page, "Guitar Lesson", 20_000);
		await expectEventVisible(page, "Yoga Class");

		// Step 3: Create third calendar → Work Projects
		await openPrismaSettings(page);
		const thirdId = await createAndConfigureCalendar(page, obsidian.vaultDir, "Work Projects", 3);
		await closeSettings(page);

		await openCalendarView(page, thirdId);
		await expectEventVisible(page, "API Rate Limiting", 20_000);
		await expectEventVisible(page, "Security Audit");

		// Step 4: Verify all three calendars still show events (no interference)
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Team Standup");
		await openCalendarView(page, secondId);
		await expectEventVisible(page, "Guitar Lesson");
		await openCalendarView(page, thirdId);
		await expectEventVisible(page, "API Rate Limiting");

		// Step 5: Delete second calendar — other two must survive
		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(secondId);
		await page.locator('[data-testid="prisma-settings-calendar-delete"]').click();
		await waitForCalendarCount(page, 2);

		// First and third still render their events
		await openCalendarView(page, "default");
		await expectEventVisible(page, "Team Standup");
		await expectEventVisible(page, "Sprint Planning");
		await openCalendarView(page, thirdId);
		await expectEventVisible(page, "API Rate Limiting");
		await expectEventVisible(page, "Security Audit");
	});

	test("renaming a planning system updates ribbon icon, command name, and leaf tab", async ({ obsidian }) => {
		const { page } = obsidian;

		await openPrismaSettings(page);
		await configureCalendarViaModal(page, "Meetings");
		await closeSettings(page);

		// Open the calendar view so a leaf tab exists
		await openCalendarView(page, "default");
		const leafTab = page.locator('.workspace-tab-header[data-type*="default"] .workspace-tab-header-inner-title');
		await expect(leafTab).toHaveText("Main Calendar");

		const ribbon = page.locator('[data-testid="prisma-ribbon-open-default"]');
		await expect(ribbon).toHaveAttribute("aria-label", "Main Calendar");

		// Rename via settings — use Enter to submit (verifies Enter closes the modal)
		await openPrismaSettings(page);
		await page.locator('[data-testid="prisma-settings-calendar-rename"]').click();
		const renameInput = page.locator('[data-testid="prisma-settings-calendar-rename-input"]').first();
		await renameInput.waitFor({ state: "visible" });
		await renameInput.fill("Work Schedule");
		await renameInput.press("Enter");
		await settleSettings(page, { pluginId: PLUGIN_ID });
		await closeSettings(page);

		// Ribbon tooltip updated
		await expect(ribbon).toHaveAttribute("aria-label", "Work Schedule");

		// Leaf tab name updated
		await expect(leafTab).toHaveText("Work Schedule");

		// Command name updated
		const commandName = await page.evaluate((pid) => {
			const w = window as unknown as {
				app: { commands: { commands: Record<string, { name: string }> } };
			};
			return w.app.commands.commands[`${pid}:open-calendar-default`]?.name;
		}, PLUGIN_ID);
		expect(commandName).toBe("Open Work Schedule");
	});

	test("deleting a planning system removes its ribbon icon and commands", async ({ obsidian }) => {
		const { page } = obsidian;

		await openPrismaSettings(page);
		const secondId = await createAndConfigureCalendar(page, obsidian.vaultDir, "Personal", 2);
		await closeSettings(page);

		const secondRibbon = page.locator(`[data-testid="prisma-ribbon-open-${secondId}"]`);
		await expect(secondRibbon).toBeVisible();

		let hasCommand = await page.evaluate(
			({ pid, calId }) => `${pid}:open-calendar-${calId}` in (window as any).app.commands.commands,
			{ pid: PLUGIN_ID, calId: secondId }
		);
		expect(hasCommand).toBe(true);

		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(secondId);
		await page.locator('[data-testid="prisma-settings-calendar-delete"]').click();
		await waitForCalendarCount(page, 1);
		await closeSettings(page);

		await expect(secondRibbon).toHaveCount(0);

		hasCommand = await page.evaluate(
			({ pid, calId }) => `${pid}:open-calendar-${calId}` in (window as any).app.commands.commands,
			{ pid: PLUGIN_ID, calId: secondId }
		);
		expect(hasCommand).toBe(false);
	});

	test("create/delete cycles leave no orphaned ribbon icons or commands", async ({ obsidian }) => {
		const { page } = obsidian;

		const countRibbonIcons = () => page.locator('[data-testid^="prisma-ribbon-open-"]').count();
		const countCommands = () =>
			page.evaluate((pid) => {
				const cmds = (window as any).app.commands.commands as Record<string, unknown>;
				return Object.keys(cmds).filter((k) => k.startsWith(`${pid}:open-calendar-`)).length;
			}, PLUGIN_ID);

		expect(await countRibbonIcons()).toBe(1);
		expect(await countCommands()).toBe(1);

		// Cycle 1: create then delete
		await openPrismaSettings(page);
		const id1 = await createAndConfigureCalendar(page, obsidian.vaultDir, "Meetings", 2);
		await closeSettings(page);
		expect(await countRibbonIcons()).toBe(2);
		expect(await countCommands()).toBe(2);

		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(id1);
		await page.locator('[data-testid="prisma-settings-calendar-delete"]').click();
		await waitForCalendarCount(page, 1);
		await closeSettings(page);
		expect(await countRibbonIcons()).toBe(1);
		expect(await countCommands()).toBe(1);

		// Cycle 2: create then delete again (same ID gets reused)
		await openPrismaSettings(page);
		const id2 = await createAndConfigureCalendar(page, obsidian.vaultDir, "Personal", 2);
		await closeSettings(page);
		expect(await countRibbonIcons()).toBe(2);

		await openPrismaSettings(page);
		await page.locator(".prisma-calendar-management select.dropdown").selectOption(id2);
		await page.locator('[data-testid="prisma-settings-calendar-delete"]').click();
		await waitForCalendarCount(page, 1);
		await closeSettings(page);
		expect(await countRibbonIcons()).toBe(1);
		expect(await countCommands()).toBe(1);
	});

	test("settings open to last-used planning system", async ({ obsidian }) => {
		const { page } = obsidian;

		await openPrismaSettings(page);
		const secondId = await createAndConfigureCalendar(page, obsidian.vaultDir, "Personal", 2);
		await closeSettings(page);

		// Open the second calendar view — sets lastUsedCalendarId
		await openCalendarView(page, secondId);
		await expect
			.poll(() =>
				page.evaluate(
					({ pid, id }) => {
						const w = window as unknown as {
							app: {
								plugins: {
									plugins: Record<string, { syncStore?: { data?: { lastUsedCalendarId?: string } } }>;
								};
							};
						};
						return w.app.plugins.plugins[pid]?.syncStore?.data?.lastUsedCalendarId === id;
					},
					{ pid: PLUGIN_ID, id: secondId }
				)
			)
			.toBe(true);

		// Reopen settings — dropdown should pre-select the second calendar
		await openPrismaSettings(page);
		const dropdown = page.locator(".prisma-calendar-management select.dropdown");
		await expect(dropdown).toHaveValue(secondId);
	});
});
