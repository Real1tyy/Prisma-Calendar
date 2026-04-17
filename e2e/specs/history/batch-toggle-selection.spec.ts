import type { Locator, Page } from "@playwright/test";

import { expect, test } from "../../fixtures/electron";
import {
	clickBatchButton,
	createEventViaToolbar,
	enterBatchMode,
	exitBatchMode,
	isoLocal,
	toggleEventInBatch,
} from "../../fixtures/history-helpers";
import { openCalendarReady } from "../events/events-helpers";

// Selection-state commands don't mutate events — they only flip UI state.
// These specs verify that clicking the batch toolbar button enters selection
// mode, that the "All" batch button selects visible events, and that "Clear"
// empties the selection — all through real clicks. Assertions cover both the
// per-event `batch-selected` class and the aggregate selection count, since a
// regression could easily drift one without the other.

const ACTIVE_CALENDAR_LEAF = ".workspace-leaf.mod-active";
const EVENT_IN_LEAF = `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-event"]`;
const SELECTED_EVENT_IN_LEAF = `${EVENT_IN_LEAF}.prisma-batch-selected`;
const BATCH_COUNTER = `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-batch-counter"]`;

function eventLocatorByTitle(page: Page, title: string): Locator {
	return page.locator(`${EVENT_IN_LEAF}[data-event-title="${title}"]`).first();
}

function selectedCount(page: Page): Promise<number> {
	return page.locator(SELECTED_EVENT_IN_LEAF).count();
}

test.describe("batch selection (UI-driven)", () => {
	test.beforeEach(async ({ obsidian }) => {
		await openCalendarReady(obsidian.page);
	});

	test("toolbar batch-select button enters selection mode and exits on Exit click", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Batch Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await enterBatchMode(obsidian.page);
		await expect(obsidian.page.locator(BATCH_COUNTER)).toBeVisible();
		await expect(obsidian.page.locator(BATCH_COUNTER)).toHaveText(/0 selected/);
		expect(await selectedCount(obsidian.page)).toBe(0);

		await exitBatchMode(obsidian.page);
		await expect(obsidian.page.locator(BATCH_COUNTER)).toBeHidden();
		expect(await selectedCount(obsidian.page)).toBe(0);
	});

	test("Select All / Clear batch buttons populate and empty the selection", async ({ obsidian }) => {
		const titles = ["Alice", "Bob", "Charlie"];
		for (const [i, title] of titles.entries()) {
			await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
				title,
				start: isoLocal(1, 9 + i),
				end: isoLocal(1, 10 + i),
			});
		}

		await enterBatchMode(obsidian.page);
		expect(await selectedCount(obsidian.page)).toBe(0);
		await expect(obsidian.page.locator(BATCH_COUNTER)).toHaveText(/0 selected/);

		await clickBatchButton(obsidian.page, "select-all");
		for (const title of titles) {
			await expect(eventLocatorByTitle(obsidian.page, title)).toHaveClass(/batch-selected/);
		}
		await expect.poll(() => selectedCount(obsidian.page)).toBe(titles.length);
		await expect(obsidian.page.locator(BATCH_COUNTER)).toHaveText(new RegExp(`${titles.length} selected`));

		await clickBatchButton(obsidian.page, "clear");
		for (const title of titles) {
			await expect(eventLocatorByTitle(obsidian.page, title)).not.toHaveClass(/batch-selected/);
		}
		await expect.poll(() => selectedCount(obsidian.page)).toBe(0);
		await expect(obsidian.page.locator(BATCH_COUNTER)).toHaveText(/0 selected/);

		await exitBatchMode(obsidian.page);
	});

	test("clicking an event while in batch mode toggles its selection", async ({ obsidian }) => {
		await createEventViaToolbar(obsidian.page, obsidian.vaultDir, {
			title: "Toggle Probe",
			start: isoLocal(1, 9),
			end: isoLocal(1, 10),
		});

		await enterBatchMode(obsidian.page);
		expect(await selectedCount(obsidian.page)).toBe(0);

		await toggleEventInBatch(obsidian.page, "Toggle Probe");
		await expect(eventLocatorByTitle(obsidian.page, "Toggle Probe")).toHaveClass(/batch-selected/);
		await expect.poll(() => selectedCount(obsidian.page)).toBe(1);
		await expect(obsidian.page.locator(BATCH_COUNTER)).toHaveText(/1 selected/);

		await toggleEventInBatch(obsidian.page, "Toggle Probe");
		await expect(eventLocatorByTitle(obsidian.page, "Toggle Probe")).not.toHaveClass(/batch-selected/);
		await expect.poll(() => selectedCount(obsidian.page)).toBe(0);
		await expect(obsidian.page.locator(BATCH_COUNTER)).toHaveText(/0 selected/);

		await exitBatchMode(obsidian.page);
	});
});
