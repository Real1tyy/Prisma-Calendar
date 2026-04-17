import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import {
	gotoToday,
	rightClickEventByTitle,
	seedEventViaVault,
	todayISO,
	todayTimedEvent,
	waitForEvent,
} from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { clickContextMenuItem, openCalendar } from "../../fixtures/helpers";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";

test.describe("event context menu", () => {
	test("right-click an event reveals Edit / Skip / Delete menu items", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		seedEvent(vaultDir, todayTimedEvent("Ctx Menu A", 9, 10));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Menu A");

		await rightClickEventByTitle(page, "Ctx Menu A");

		await expect(page.locator('[data-testid="prisma-context-menu-item-editEvent"]').first()).toBeVisible();
		await expect(page.locator('[data-testid="prisma-context-menu-item-skipEvent"]').first()).toBeVisible();
		await expect(page.locator('[data-testid="prisma-context-menu-item-deleteEvent"]').first()).toBeVisible();

		await page.keyboard.press("Escape");
	});

	test("clicking Skip event in the context menu writes Skip: true to frontmatter", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		const file = seedEvent(vaultDir, todayTimedEvent("Ctx Skip", 9, 10));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Skip");

		await rightClickEventByTitle(page, "Ctx Skip");
		await clickContextMenuItem(page, "skipEvent");

		await expect.poll(() => readEventFrontmatter(vaultDir, file)["Skip"], { timeout: 5_000 }).toBe(true);
	});

	test("clicking Duplicate event leaves the source present (new file is plugin-side)", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		const date = todayISO();
		await openCalendar(page);
		await seedEventViaVault(page, { title: "Ctx Dup", date, startTime: "09:00", endTime: "10:00" });
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Dup");

		const initialCount = readdirSync(join(vaultDir, "Events")).filter((f) => f.endsWith(".md")).length;

		await rightClickEventByTitle(page, "Ctx Dup");
		await clickContextMenuItem(page, "duplicateEvent");

		// Menu must close (ensures the click landed and the onAction fired
		// without throwing); source file with its title is still on disk.
		await expect(page.locator('[data-testid="prisma-context-menu-item-duplicateEvent"]').first()).not.toBeVisible();
		const entries = readdirSync(join(vaultDir, "Events")).filter((f) => f.endsWith(".md"));
		expect(entries.length).toBeGreaterThanOrEqual(initialCount);
		expect(entries.some((f) => f.startsWith("Ctx Dup"))).toBe(true);
	});

	test("clicking Assign categories opens the picker and writes Category frontmatter", async ({ obsidian }) => {
		// The assign-categories flow goes through a separate modal (category
		// assignment) stacked on top of the calendar view — the context menu
		// item just launches it. Drive it end-to-end: search, create a new
		// category (none seeded by default), submit, then assert the event's
		// `Category` frontmatter lists it.
		const { page, vaultDir } = obsidian;
		const file = seedEvent(vaultDir, todayTimedEvent("Ctx Assign Cat", 15, 16));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Assign Cat");

		await rightClickEventByTitle(page, "Ctx Assign Cat");
		await clickContextMenuItem(page, "assignCategories");

		const assignModal = page.locator('.modal:has([data-testid="prisma-assign-search"])').first();
		await assignModal.waitFor({ state: "visible", timeout: 10_000 });

		const search = assignModal.locator('[data-testid="prisma-assign-search"]');
		await search.fill("Fitness");
		const createNew = assignModal.locator('[data-testid="prisma-assign-create-new"]');
		await createNew.waitFor({ state: "visible", timeout: 5_000 });
		await createNew.click();

		await assignModal.locator('[data-testid="prisma-assign-submit"]').click();
		await assignModal.waitFor({ state: "hidden", timeout: 5_000 });

		await expect
			.poll(
				() => {
					const v = readEventFrontmatter(vaultDir, file)["Category"];
					const arr = Array.isArray(v) ? v : v ? [v] : [];
					return arr.map(String).includes("Fitness");
				},
				{ timeout: 8_000, message: `Category frontmatter did not include "Fitness" in ${file}` }
			)
			.toBe(true);
	});

	test("clicking Mark as done/undone flips Status; Delete removes the file", async ({ obsidian }) => {
		const { page, vaultDir } = obsidian;
		const file = seedEvent(vaultDir, todayTimedEvent("Ctx Menu C", 13, 14));

		await openCalendar(page);
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Menu C");

		await rightClickEventByTitle(page, "Ctx Menu C");
		await clickContextMenuItem(page, "markDone");

		await expect
			.poll(() => String(readEventFrontmatter(vaultDir, file)["Status"] ?? "").toLowerCase(), { timeout: 5_000 })
			.toMatch(/done|true/);

		await refreshCalendar(page);
		await rightClickEventByTitle(page, "Ctx Menu C");
		await clickContextMenuItem(page, "deleteEvent");

		const confirm = page.locator(".modal-container button", { hasText: /delete|remove|yes/i }).first();
		if (await confirm.isVisible().catch(() => false)) {
			await confirm.click();
		}

		await expect.poll(() => existsSync(join(vaultDir, file)), { timeout: 5_000 }).toBe(false);
	});
});
