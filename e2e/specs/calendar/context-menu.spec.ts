import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { gotoToday, seedEventViaVault, todayISO, todayTimedEvent, waitForEvent } from "../../fixtures/calendar-helpers";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar, seedEvent } from "../../fixtures/seed-events";
import { sel, TID } from "../../fixtures/testids";

test.describe("event context menu", () => {
	test("right-click an event reveals Edit / Skip / Delete menu items", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		seedEvent(vaultDir, todayTimedEvent("Ctx Menu A", 9, 10));

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Menu A");

		const evt = await calendar.eventByTitle("Ctx Menu A");
		// Opening the menu is part of `rightClick(item)`, but we want to assert
		// three items are present before committing to any single action. Drive
		// the right-click directly and then keyboard-escape to close without
		// firing onAction on any item.
		const block = page.locator(`${sel(TID.block)}[data-event-title="Ctx Menu A"]`).first();
		await block.click({ button: "right" });

		await expect(page.locator(sel(TID.ctxMenu("editEvent"))).first()).toBeVisible();
		await expect(page.locator(sel(TID.ctxMenu("skipEvent"))).first()).toBeVisible();
		await expect(page.locator(sel(TID.ctxMenu("deleteEvent"))).first()).toBeVisible();

		await page.keyboard.press("Escape");
		void evt; // handle is ready for follow-up tests if ever needed
	});

	test("clicking Skip event in the context menu writes Skip: true to frontmatter", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		const file = seedEvent(vaultDir, todayTimedEvent("Ctx Skip", 9, 10));

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Skip");

		const evt = await calendar.eventByTitle("Ctx Skip");
		await evt.rightClick("skipEvent");

		await expect.poll(() => readEventFrontmatter(vaultDir, file)["Skip"]).toBe(true);
	});

	test("clicking Duplicate event leaves the source present (new file is plugin-side)", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		const date = todayISO();
		await seedEventViaVault(page, { title: "Ctx Dup", date, startTime: "09:00", endTime: "10:00" });
		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Dup");

		const initialCount = readdirSync(join(vaultDir, "Events")).filter((f) => f.endsWith(".md")).length;

		const evt = await calendar.eventByTitle("Ctx Dup");
		await evt.rightClick("duplicateEvent");

		// Menu must close (ensures the click landed and the onAction fired
		// without throwing); source file with its title is still on disk.
		await expect(page.locator(sel(TID.ctxMenu("duplicateEvent"))).first()).not.toBeVisible();
		const entries = readdirSync(join(vaultDir, "Events")).filter((f) => f.endsWith(".md"));
		expect(entries.length).toBeGreaterThanOrEqual(initialCount);
		expect(entries.some((f) => f.startsWith("Ctx Dup"))).toBe(true);
	});

	test("clicking Assign categories opens the picker and writes Category frontmatter", async ({ calendar }) => {
		// The assign-categories flow goes through a separate modal (category
		// assignment) stacked on top of the calendar view — the context menu
		// item just launches it. Drive it end-to-end: search, create a new
		// category (none seeded by default), submit, then assert the event's
		// `Category` frontmatter lists it.
		const { page, vaultDir } = calendar;
		const file = seedEvent(vaultDir, todayTimedEvent("Ctx Assign Cat", 15, 16));

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Assign Cat");

		const evt = await calendar.eventByTitle("Ctx Assign Cat");
		await evt.rightClick("assignCategories");

		const assignModal = page.locator(`.modal:has(${sel("prisma-assign-search")})`).first();
		await assignModal.waitFor({ state: "visible" });

		const search = assignModal.locator(sel("prisma-assign-search"));
		await search.fill("Fitness");
		const createNew = assignModal.locator(sel("prisma-assign-create-new"));
		await createNew.waitFor({ state: "visible" });
		await createNew.click();

		await assignModal.locator(sel("prisma-assign-submit")).click();
		await assignModal.waitFor({ state: "hidden" });

		await expect
			.poll(
				() => {
					const v = readEventFrontmatter(vaultDir, file)["Category"];
					const arr = Array.isArray(v) ? v : v ? [v] : [];
					return arr.map(String).includes("Fitness");
				},
				{ message: `Category frontmatter did not include "Fitness" in ${file}` }
			)
			.toBe(true);
	});

	test("clicking Mark as done/undone flips Status; Delete removes the file", async ({ calendar }) => {
		const { page, vaultDir } = calendar;
		const file = seedEvent(vaultDir, todayTimedEvent("Ctx Menu C", 13, 14));

		await refreshCalendar(page);
		await gotoToday(page);
		await waitForEvent(page, "Ctx Menu C");

		const evt = await calendar.eventByTitle("Ctx Menu C");
		await evt.rightClick("markDone");

		await expect
			.poll(() => String(readEventFrontmatter(vaultDir, file)["Status"] ?? "").toLowerCase())
			.toMatch(/done|true/);

		await refreshCalendar(page);
		// With Status: Done already on disk, the markDone row rewrites its
		// label to "Mark as undone". Re-open the menu and assert the live
		// override before deleting.
		const block = page.locator(`${sel(TID.block)}[data-event-title="Ctx Menu C"]`).first();
		await block.click({ button: "right" });
		await expect(page.locator(sel(TID.ctxMenu("markDone"))).first()).toContainText("undone");
		await page
			.locator(sel(TID.ctxMenu("deleteEvent")))
			.first()
			.click();

		const confirm = page.locator(".modal-container button", { hasText: /delete|remove|yes/i }).first();
		if (await confirm.isVisible().catch(() => false)) {
			await confirm.click();
		}

		await expect.poll(() => existsSync(join(vaultDir, file))).toBe(false);
	});
});
