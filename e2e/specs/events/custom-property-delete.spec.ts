import { writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";
import { expectFrontmatter, readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { createEventHandle } from "../../fixtures/dsl";
import { expect, test } from "../../fixtures/electron";
import { refreshCalendar } from "../../fixtures/seed-events";
import { EVENT_MODAL_SELECTOR, formatLocalDate } from "./events-helpers";
import { saveEventModal } from "./fill-event-modal";

// Parity guard for the custom-property delete path on the edit modal. The
// imperative modal diffed `originalCustomPropertyKeys` against the current form
// and `delete fm[key]` for any key that had been removed via the × button. The
// React port carries that diff in `buildEventSaveData` (build-event-save-data.ts:
// 109-117). These specs prove removing a row in the modal removes the key from
// the on-disk frontmatter — the most common silent-regression path because the
// remove button has no visible UI confirmation; only saving + re-reading the
// file proves the key is gone.

/**
 * Click the Remove button on the custom-property row whose key input matches.
 * Uses page.evaluate so we don't have to fight CollapsibleSection visibility
 * (the section defaults to collapsed; rows are still in the DOM with a
 * `prisma-collapsible-hidden` class, which would block locator-driven clicks).
 * The React handler reads from the DOM value via the synthetic click event, so
 * dispatching a real click on the button is sufficient to trigger the parent
 * state update.
 */
async function removeCustomPropRowByKey(page: Page, section: "other" | "display", key: string): Promise<void> {
	await page.evaluate(
		({ s, k }) => {
			const rows = document.querySelectorAll<HTMLElement>(`[data-testid="prisma-event-custom-prop-row-${s}"]`);
			for (const row of Array.from(rows)) {
				const input = row.querySelector<HTMLInputElement>(`[data-testid="prisma-event-custom-prop-key-${s}"]`);
				if (input?.value === k) {
					const btn = row.querySelector<HTMLButtonElement>(`[data-testid="prisma-event-btn-remove-custom-prop-${s}"]`);
					if (!btn) throw new Error(`row "${k}" has no remove button`);
					btn.click();
					return;
				}
			}
			throw new Error(`custom-prop row with key="${k}" not found in section="${s}"`);
		},
		{ s: section, k: key }
	);
}

test.describe("event modal — custom property delete", () => {
	test("removing an existing custom-property row deletes the key from frontmatter on save", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const seedPath = "Events/Project Planning-20250101000000.md";
		writeFileSync(
			join(calendar.vaultDir, seedPath),
			`---
Start Date: ${today}T09:00
End Date: ${today}T10:00
Priority: high
Project: Atlas
Already Notified: true
---

# Project Planning
`,
			"utf8"
		);
		await refreshCalendar(calendar.page);

		const evt = createEventHandle(calendar, seedPath, "Project Planning");
		await evt.expectVisible();

		const before = readEventFrontmatter(calendar.vaultDir, seedPath);
		expect(before["Priority"]).toBe("high");
		expect(before["Project"]).toBe("Atlas");

		await evt.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		const rows = calendar.page.locator('[data-testid="prisma-event-custom-prop-row-other"]');
		await expect(rows).toHaveCount(2);

		await removeCustomPropRowByKey(calendar.page, "other", "Project");

		await expect(rows).toHaveCount(1);

		await saveEventModal(calendar.page);

		expectFrontmatter(calendar.vaultDir, seedPath, {
			Priority: "high",
			"Start Date": `${today}T09:00:00.000Z`,
		});
		const after = readEventFrontmatter(calendar.vaultDir, seedPath);
		expect(after["Project"], "Project key must be removed from frontmatter").toBeUndefined();
	});

	test("adding a new property + removing an existing one are applied atomically", async ({ calendar }) => {
		const today = formatLocalDate(new Date());
		const seedPath = "Events/Atomic Diff-20250101000000.md";
		writeFileSync(
			join(calendar.vaultDir, seedPath),
			`---
Start Date: ${today}T11:00
End Date: ${today}T12:00
ToRemove: stale
Already Notified: true
---

# Atomic Diff
`,
			"utf8"
		);
		await refreshCalendar(calendar.page);

		const evt = createEventHandle(calendar, seedPath, "Atomic Diff");
		await evt.expectVisible();
		await evt.rightClick("editEvent");
		await calendar.page.locator(EVENT_MODAL_SELECTOR).waitFor({ state: "visible" });

		await removeCustomPropRowByKey(calendar.page, "other", "ToRemove");

		// The Add property button lives in the (currently collapsed) section
		// header — it remains clickable even when the body is hidden because
		// the header itself stays in flow. Use evaluate-based click for
		// symmetry with removeCustomPropRowByKey.
		await calendar.page.evaluate(() => {
			const btn = document.querySelector<HTMLButtonElement>('[data-testid="prisma-event-btn-add-custom-prop-other"]');
			if (!btn) throw new Error("add-custom-prop-other button missing");
			btn.click();
		});
		const keyInputs = calendar.page.locator('[data-testid="prisma-event-custom-prop-key-other"]');
		await expect(keyInputs).toHaveCount(1);
		// Fill via JS to bypass visibility (section may still be collapsed).
		await calendar.page.evaluate(() => {
			const key = document.querySelector<HTMLInputElement>('[data-testid="prisma-event-custom-prop-key-other"]');
			const val = document.querySelector<HTMLInputElement>('[data-testid="prisma-event-custom-prop-value-other"]');
			if (!key || !val) throw new Error("custom-prop inputs missing");
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
			setter.call(key, "ToAdd");
			key.dispatchEvent(new Event("input", { bubbles: true }));
			setter.call(val, "fresh");
			val.dispatchEvent(new Event("input", { bubbles: true }));
			val.dispatchEvent(new Event("blur", { bubbles: true }));
		});

		await saveEventModal(calendar.page);

		const after = readEventFrontmatter(calendar.vaultDir, seedPath);
		expect(after["ToRemove"], "removed key must be absent").toBeUndefined();
		expect(after["ToAdd"], "added key must be present").toBe("fresh");
	});
});
