import { expect } from "@playwright/test";

import { PLUGIN_ID } from "../../fixtures/constants";
import { todayISO, todayStamp } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { VIRTUAL_EVENTS_BLOCK_CLASS, VIRTUAL_EVENTS_TABLE_CLASS } from "../../fixtures/testids";
import type { PrismaPlugin, PrismaWindow } from "../../fixtures/window-types";

// The `prisma-virtual-events` code-fence is registered as a Markdown code-
// block processor that mounts `VirtualEventsBlockRenderer`. The renderer
// paints a table of virtual events with two action buttons per row: "Make
// real" (delegates to `CalendarBundle.convertToReal`) and "Show" (drives
// `CalendarBundle.navigateToEvent`). `virtual-events-file.spec.ts` only
// asserts the command opens the file — nothing exercises the rendered
// block itself.
//
// This spec seeds a virtual event through the production code path
// (`VirtualEventStore.add`), opens the auto-created file, switches to
// reading mode so the code-block processor mounts, and asserts the
// rendered table + clicks "Make real" to verify the conversion writes a
// real event file to disk.

const VIRTUAL_EVENTS_PATH = "Events/Virtual Events.md";

test.describe("integrations: virtual events block renderer", () => {
	test("rendered block shows seeded events and Make real converts to a real event file", async ({ calendar }) => {
		const page = calendar.page;
		const start = todayStamp(9, 0);
		const end = todayStamp(10, 0);

		await calendar.seedVirtualEvent({ title: "Virtual Lunch", start, end });

		await calendar.openFileInReadingMode(VIRTUAL_EVENTS_PATH);

		// Obsidian mounts the block twice (editor + reading mode); the
		// reading-mode instance is visible while the editor copy stays hidden.
		// Filter to the visible one.
		const block = page.locator(`${VIRTUAL_EVENTS_BLOCK_CLASS}:visible`).first();
		await block.waitFor({ state: "visible", timeout: 10_000 });
		const table = block.locator(VIRTUAL_EVENTS_TABLE_CLASS);
		await expect(table).toBeVisible();
		const row = table.locator("tbody tr");
		await expect(row).toHaveCount(1);
		await expect(row.locator("td").nth(0)).toHaveText("Virtual Lunch");

		const baselineFiles = await page.evaluate(() => {
			const w = window as unknown as PrismaWindow;
			return w.app.vault
				.getMarkdownFiles()
				.map((f) => f.path)
				.filter((p) => p.startsWith("Events/") && p !== "Events/Virtual Events.md");
		});
		expect(baselineFiles).toHaveLength(0);

		const makeRealBtn = row.locator("button:has-text('Make real')");
		await makeRealBtn.click();

		// `convertToReal` writes a real markdown file under `Events/` and removes
		// the row from the virtual store. The block re-renders empty (or with the
		// next row) — assert the count dropped to zero and a new file appeared.
		await expect
			.poll(async () =>
				page.evaluate(() => {
					const w = window as unknown as PrismaWindow;
					return w.app.vault
						.getMarkdownFiles()
						.map((f) => f.path)
						.filter((p) => p.startsWith("Events/") && p !== "Events/Virtual Events.md").length;
				})
			)
			.toBe(1);

		await expect(table.locator("tbody tr")).toHaveCount(0);
	});

	test("Show button navigates the calendar to the virtual event's date", async ({ calendar }) => {
		const page = calendar.page;
		const start = todayStamp(14, 0);
		const end = todayStamp(15, 0);

		await calendar.seedVirtualEvent({ title: "Virtual Jump Target", start, end });

		await calendar.openFileInReadingMode(VIRTUAL_EVENTS_PATH);
		const block = page.locator(`${VIRTUAL_EVENTS_BLOCK_CLASS}:visible`).first();
		await block.waitFor({ state: "visible", timeout: 10_000 });
		const row = block.locator("table tbody tr").first();
		await expect(row).toBeVisible();

		await row.locator("button:has-text('Show')").click();

		// `navigateToEvent` switches the workspace back to the calendar view and
		// navigates to the event's date. Assert the active calendar's date now
		// matches today (the seed date).
		await expect
			.poll(async () =>
				page.evaluate((pid) => {
					const w = window as unknown as PrismaWindow;
					const plugin = w.app.plugins.plugins[pid] as PrismaPlugin | undefined;
					const cal = plugin?.calendarBundles?.[0]?.viewRef?.calendarComponent?.calendar;
					const d = cal?.getDate?.();
					if (!d) return null;
					return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
				}, PLUGIN_ID)
			)
			.toBe(todayISO());
	});
});
