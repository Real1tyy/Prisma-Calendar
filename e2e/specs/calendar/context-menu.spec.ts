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
