import { runCommand } from "../../fixtures/commands";
import { expect, test } from "../../fixtures/electron";
import { openCalendar } from "../../fixtures/helpers";
import { refreshCalendar, seedEvents, waitForEventCount } from "../../fixtures/seed-events";

// 500-event smoke. Seed deterministically (not via the modal), activate the
// calendar view, assert initial render within budget and survives 10
// navigation cycles without runaway heap growth. Skipped under E2E_FAST=1.

const EVENT_COUNT = 500;
const NAV_CYCLES = 10;
const CALENDAR_ROOT = ".fc";

test.describe("large dataset smoke @slow", () => {
	test.skip(process.env["E2E_FAST"] === "1", "skipped under E2E_FAST=1");

	test("500 events render and survive repeated navigation without runaway memory", async ({ obsidian }) => {
		const events = Array.from({ length: EVENT_COUNT }, (_, i) => {
			const day = (i % 28) + 1;
			const month = ((Math.floor(i / 28) % 12) + 1).toString().padStart(2, "0");
			return {
				title: `Event ${i.toString().padStart(4, "0")}`,
				startDate: `2026-${month}-${day.toString().padStart(2, "0")}T09:00`,
				endDate: `2026-${month}-${day.toString().padStart(2, "0")}T10:00`,
				category: i % 2 === 0 ? "Work" : "Personal",
			};
		});

		seedEvents(obsidian.vaultDir, events);
		await refreshCalendar(obsidian.page);

		const t0 = Date.now();
		await openCalendar(obsidian.page);
		await obsidian.page.locator(CALENDAR_ROOT).first().waitFor({ state: "visible", timeout: 30_000 });
		const renderMs = Date.now() - t0;
		expect(renderMs, `initial render took ${renderMs}ms`).toBeLessThan(30_000);

		await waitForEventCount(obsidian.page, EVENT_COUNT);

		const sampleHeap = async (): Promise<number> =>
			obsidian.page.evaluate(() => {
				const p = performance as unknown as { memory?: { usedJSHeapSize: number } };
				return p.memory?.usedJSHeapSize ?? 0;
			});

		const heapBefore = await sampleHeap();
		for (let i = 0; i < NAV_CYCLES; i++) {
			await runCommand(obsidian.page, "Prisma Calendar: Navigate forward");
			await obsidian.page.waitForTimeout(150);
		}
		const heapAfter = await sampleHeap();

		if (heapBefore > 0 && heapAfter > 0) {
			const ratio = heapAfter / heapBefore;
			expect(ratio, `heap grew ${ratio.toFixed(2)}x across ${NAV_CYCLES} navigations`).toBeLessThan(2);
		}
	});
});
