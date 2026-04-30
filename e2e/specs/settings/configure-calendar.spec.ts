import { readPluginData, settleSettings } from "@real1ty-obsidian-plugins/testing/e2e";

import { PLUGIN_ID } from "../../fixtures/constants";
import { fromAnchor } from "../../fixtures/dates";
import { expect, testWithSeededFiles as test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { type SeedEventInput, seedEvents } from "../../fixtures/seed-events";
import { expectEventVisible, openCalendarReady } from "../events/events-helpers";

// ─── Dataset: three folders with distinct property schemas ───────────────────

const MEETINGS: SeedEventInput[] = [
	"Weekly Standup",
	"1-on-1 with Sarah",
	"Architecture Discussion",
	"Budget Review",
	"Client Demo",
	"Compliance Training",
	"Hiring Sync",
	"Investor Update",
	"Product Roadmap",
	"Team Offsite",
].map((title, i) => ({
	title,
	subdir: "Meetings",
	extra: {
		"Meeting Start": `2026-05-${String(i + 1).padStart(2, "0")}T09:00`,
		"Meeting End": `2026-05-${String(i + 1).padStart(2, "0")}T10:00`,
		"Created On": `2026-04-${String(i + 1).padStart(2, "0")}`,
	},
}));

const PERSONAL: SeedEventInput[] = [
	"Yoga Class",
	"Book Club",
	"Dentist Appointment",
	"Dinner with Alex",
	"Grocery Run",
	"Guitar Lesson",
	"Hiking Trip",
	"Concert Tickets",
	"Car Service",
	"Apartment Deep Clean",
].map((title, i) => ({
	title,
	subdir: "Personal",
	extra: {
		"Start Time": `2026-06-${String(i + 1).padStart(2, "0")}T14:00`,
		"End Time": `2026-06-${String(i + 1).padStart(2, "0")}T15:30`,
		Due: `2026-06-${String(i + 1).padStart(2, "0")}`,
	},
}));

const WORK_PROJECTS: SeedEventInput[] = [
	"API Rate Limiting",
	"Backend Migration",
	"CI Pipeline Fix",
	"Design Review",
	"Onboarding Doc Update",
	"Performance Benchmarks",
	"Q3 Planning",
	"Release v2.4",
	"Security Audit",
	"Sprint Retro",
].map((title, i) => ({
	title,
	subdir: "Work Projects",
	extra: {
		Start: `2026-07-${String(i + 1).padStart(2, "0")}T10:00`,
		End: `2026-07-${String(i + 1).padStart(2, "0")}T17:00`,
		"Review Date": `2026-07-${String(i + 15).padStart(2, "0")}`,
	},
}));

type CalendarRow = { id: string; directory?: string; startProp?: string; endProp?: string; dateProp?: string };
type PluginData = { calendars: CalendarRow[] };

function getCalendars(vaultDir: string): CalendarRow[] {
	return (readPluginData(vaultDir, PLUGIN_ID) as PluginData).calendars;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe("settings: configure calendar with property detection", () => {
	test.beforeEach(async ({ obsidian }) => {
		seedEvents(obsidian.vaultDir, [...MEETINGS, ...PERSONAL, ...WORK_PROJECTS]);
		await obsidian.page.waitForTimeout(2000);
	});

	test("configure modal detects folders and prefills properties on suggestion click", async ({ obsidian }) => {
		const { page } = obsidian;
		await openPrismaSettings(page);

		await page.locator('[data-testid="prisma-settings-calendar-configure"]').click();

		const modal = page.locator('[data-testid="prisma-configure-calendar-modal"]');
		await modal.waitFor({ state: "visible" });

		const suggestionCards = modal.locator(".prisma-first-launch-suggestion");
		await expect(suggestionCards.first()).toBeVisible();

		const cardTexts = await suggestionCards.allTextContents();
		expect(cardTexts.some((t) => t.includes("Meetings"))).toBe(true);
		expect(cardTexts.some((t) => t.includes("Personal"))).toBe(true);
		expect(cardTexts.some((t) => t.includes("Work Projects"))).toBe(true);

		// Click Meetings — "Meeting Start"/"Meeting End" match start/end keywords
		await suggestionCards.filter({ hasText: "Meetings" }).click();

		const startInput = modal.locator('[data-testid="prisma-configure-start-prop"]');
		const endInput = modal.locator('[data-testid="prisma-configure-end-prop"]');
		const dateInput = modal.locator('[data-testid="prisma-configure-date-prop"]');
		const dirInput = modal.locator('[data-testid="prisma-configure-directory-input"]');

		await expect(dirInput).toHaveValue("Meetings");
		await expect(startInput).toHaveValue("Meeting Start");
		await expect(endInput).toHaveValue("Meeting End");
		await expect(dateInput).toHaveValue("Created On");

		await modal.locator('[data-testid="prisma-configure-save"]').click();
		await settleSettings(page, { pluginId: PLUGIN_ID });

		const calendars = getCalendars(obsidian.vaultDir);
		expect(calendars[0].directory).toBe("Meetings");
		expect(calendars[0].startProp).toBe("Meeting Start");
		expect(calendars[0].endProp).toBe("Meeting End");
		expect(calendars[0].dateProp).toBe("Created On");

		// Verify the settings UI reflects the saved values
		await switchSettingsTab(page, "general");
		const dirControl = page.locator('[data-testid="prisma-settings-control-directory"]');
		await expect(dirControl).toHaveValue("Meetings");

		await switchSettingsTab(page, "properties");
		const startField = page.locator('[data-testid="prisma-settings-field-startProp"] input').first();
		const endField = page.locator('[data-testid="prisma-settings-field-endProp"] input').first();
		const dateField = page.locator('[data-testid="prisma-settings-field-dateProp"] input').first();
		await expect(startField).toHaveValue("Meeting Start");
		await expect(endField).toHaveValue("Meeting End");
		await expect(dateField).toHaveValue("Created On");
	});

	test("switching between suggestions updates prefilled properties", async ({ obsidian }) => {
		const { page } = obsidian;
		await openPrismaSettings(page);

		await page.locator('[data-testid="prisma-settings-calendar-configure"]').click();

		const modal = page.locator('[data-testid="prisma-configure-calendar-modal"]');
		await modal.waitFor({ state: "visible" });

		const suggestionCards = modal.locator(".prisma-first-launch-suggestion");
		await expect(suggestionCards.first()).toBeVisible();

		const startInput = modal.locator('[data-testid="prisma-configure-start-prop"]');
		const endInput = modal.locator('[data-testid="prisma-configure-end-prop"]');
		const dateInput = modal.locator('[data-testid="prisma-configure-date-prop"]');

		// Personal: "Start Time" matches start keyword, "End Time" matches end
		await suggestionCards.filter({ hasText: "Personal" }).click();
		await expect(startInput).toHaveValue("Start Time");
		await expect(endInput).toHaveValue("End Time");
		await expect(dateInput).toHaveValue("Due");

		// Work Projects: "Start" matches start keyword, "End" matches end
		await suggestionCards.filter({ hasText: "Work Projects" }).click();
		await expect(startInput).toHaveValue("Start");
		await expect(endInput).toHaveValue("End");
		await expect(dateInput).toHaveValue("Review Date");

		// Switch back to Meetings
		await suggestionCards.filter({ hasText: "Meetings" }).click();
		await expect(startInput).toHaveValue("Meeting Start");
		await expect(endInput).toHaveValue("Meeting End");
	});

	test("Use prefill buttons fill the input on click", async ({ obsidian }) => {
		const { page } = obsidian;
		await openPrismaSettings(page);

		await page.locator('[data-testid="prisma-settings-calendar-configure"]').click();

		const modal = page.locator('[data-testid="prisma-configure-calendar-modal"]');
		await modal.waitFor({ state: "visible" });

		const suggestionCards = modal.locator(".prisma-first-launch-suggestion");
		await expect(suggestionCards.first()).toBeVisible();

		await suggestionCards.filter({ hasText: "Personal" }).click();

		// Click "End Time" prefill button on the start field
		const startPrefillEndTime = modal.locator('[data-testid="prisma-configure-prefill-start-end-time"]');
		await expect(startPrefillEndTime).toBeVisible();
		await startPrefillEndTime.click();

		const startInput = modal.locator('[data-testid="prisma-configure-start-prop"]');
		await expect(startInput).toHaveValue("End Time");
	});

	test("cancel discards changes", async ({ obsidian }) => {
		const { page } = obsidian;
		await openPrismaSettings(page);

		const calendarsBefore = getCalendars(obsidian.vaultDir);

		await page.locator('[data-testid="prisma-settings-calendar-configure"]').click();
		const modal = page.locator('[data-testid="prisma-configure-calendar-modal"]');
		await modal.waitFor({ state: "visible" });

		const suggestionCards = modal.locator(".prisma-first-launch-suggestion");
		await expect(suggestionCards.first()).toBeVisible();
		await suggestionCards.filter({ hasText: "Work Projects" }).click();

		await modal.locator('[data-testid="prisma-configure-cancel"]').click();
		await modal.waitFor({ state: "detached" });

		const calendarsAfter = getCalendars(obsidian.vaultDir);
		expect(calendarsAfter[0].directory).toBe(calendarsBefore[0].directory);
	});

	test("calendar re-indexes and renders events after directory switch via configure", async ({ obsidian }) => {
		const { page } = obsidian;

		// Seed anchor-relative events so they're visible on the current week
		const meetingsVisible: SeedEventInput[] = [
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
		const personalVisible: SeedEventInput[] = [
			{
				title: "Guitar Lesson",
				subdir: "Personal",
				extra: { "Start Time": fromAnchor(0, 18), "End Time": fromAnchor(0, 19), Due: fromAnchor(0).slice(0, 10) },
			},
			{
				title: "Yoga Class",
				subdir: "Personal",
				extra: { "Start Time": fromAnchor(1, 7), "End Time": fromAnchor(1, 8), Due: fromAnchor(1).slice(0, 10) },
			},
		];
		seedEvents(obsidian.vaultDir, [...meetingsVisible, ...personalVisible]);
		await page.waitForTimeout(2000);

		// Configure calendar to use Meetings folder
		await openPrismaSettings(page);
		await page.locator('[data-testid="prisma-settings-calendar-configure"]').click();

		const modal = page.locator('[data-testid="prisma-configure-calendar-modal"]');
		await modal.waitFor({ state: "visible" });
		const suggestionCards = modal.locator(".prisma-first-launch-suggestion");
		await expect(suggestionCards.first()).toBeVisible();
		await suggestionCards.filter({ hasText: "Meetings" }).click();
		await modal.locator('[data-testid="prisma-configure-save"]').click();
		await settleSettings(page, { pluginId: PLUGIN_ID });
		await closeSettings(page);

		await closeSettings(page);
		await openCalendarReady(page);
		await expectEventVisible(page, "Team Standup", 20_000);
		await expectEventVisible(page, "Sprint Planning");

		// Now switch to Personal via configure
		await openPrismaSettings(page);
		await page.locator('[data-testid="prisma-settings-calendar-configure"]').click();
		const modal2 = page.locator('[data-testid="prisma-configure-calendar-modal"]');
		await modal2.waitFor({ state: "visible" });
		const cards2 = modal2.locator(".prisma-first-launch-suggestion");
		await expect(cards2.first()).toBeVisible();
		await cards2.filter({ hasText: "Personal" }).click();
		await modal2.locator('[data-testid="prisma-configure-save"]').click();
		await settleSettings(page, { pluginId: PLUGIN_ID });
		await closeSettings(page);
		await openCalendarReady(page);
		await expectEventVisible(page, "Guitar Lesson", 20_000);
		await expectEventVisible(page, "Yoga Class");
	});
});
