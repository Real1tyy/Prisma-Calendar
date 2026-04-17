import type { Page } from "@playwright/test";

/**
 * Format a `YYYY-MM-DDTHH:mm` string anchored to today's local date. Used by
 * analytics specs to seed events at deterministic times without coupling to
 * timezones or Luxon.
 */
export function todayStamp(hours: number, minutes = 0): string {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	const hh = String(hours).padStart(2, "0");
	const mi = String(minutes).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

/**
 * Dismiss the topmost modal via Escape and wait for the modal count to drop.
 * Robust against stacked modals — `first()`-based waits can resolve on a
 * sibling that was already open before the call.
 */
export async function closeOpenModal(page: Page): Promise<void> {
	const before = await page.locator(".modal").count();
	await page.keyboard.press("Escape");
	await page.waitForFunction((prev) => document.querySelectorAll(".modal").length < prev, before, {
		timeout: 5_000,
	});
}

/**
 * Stats views default to "Event Name" aggregation. Flip to "Category" so entry
 * rows are keyed by category name — required for deterministic assertions on
 * category-aggregated stats.
 */
export async function switchAggregationToCategory(page: Page): Promise<void> {
	const button = page.locator('[data-testid="prisma-stats-mode-button"]').first();
	await button.waitFor({ state: "visible", timeout: 5_000 });
	if ((await button.innerText()).trim() === "Event Name") {
		await button.click();
	}
}
