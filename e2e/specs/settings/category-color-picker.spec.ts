import { expect } from "@playwright/test";

import { fromAnchor } from "../../fixtures/dates";
import { test } from "../../fixtures/electron";
import { closeSettings, openPrismaSettings, switchSettingsTab } from "../../fixtures/helpers";
import { sel } from "../../fixtures/testids";

// Picking a color in the Categories settings tab is the only documented way
// for a user to assign a colour to a category — internally it writes a
// `colorRules` entry whose expression is `<categoryProp>.includes('<name>')`
// (categories-settings.tsx:156-167). The reactivity from there is the same
// path covered by `cross-view/settings-to-view-reactivity.spec.ts`, but the
// UI flow itself was untested. A regression in the color picker UI (event
// not firing, store not committing, or initial-color mismatch) wouldn't be
// caught by the programmatic-mutation reactivity tests.

const CATEGORY = "Picker";
const PICKED_COLOR = "#00aaff";
const CATEGORY_ITEM_TID = "prisma-category-settings-item";
const CATEGORY_COLOR_INPUT_TID = "prisma-category-settings-color-input";

test.describe("settings: category color picker → tile repaint", () => {
	test("picking a color in the Categories tab repaints calendar tiles for that category", async ({
		calendar,
		obsidian,
	}) => {
		await calendar.switchMode("week");
		await calendar.goToAnchor();

		const evt = await calendar.seedOnDisk("Picker Target", {
			"Start Date": fromAnchor(0, 9, 0),
			"End Date": fromAnchor(0, 10, 0),
			Category: CATEGORY,
		});
		await evt.expectVisible();

		await openPrismaSettings(obsidian.page);
		await switchSettingsTab(obsidian.page, "categories");

		const row = obsidian.page.locator(`${sel(CATEGORY_ITEM_TID)}[data-category="${CATEGORY}"]`);
		await expect(row).toBeVisible();

		// `<input type="color">` is a native picker — the OS dialog can't be
		// driven from Playwright. React intercepts `value` setters on controlled
		// inputs; we have to call the native setter so React's synthetic event
		// path observes the change. Without this, dispatchEvent fires but
		// `e.target.value` reads the stale value React last rendered.
		const colorInput = row.locator(sel(CATEGORY_COLOR_INPUT_TID));
		await colorInput.evaluate((el, color) => {
			const input = el as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
			if (!setter) throw new Error("HTMLInputElement.value setter missing");
			setter.call(input, color);
			input.dispatchEvent(new Event("input", { bubbles: true }));
			input.dispatchEvent(new Event("change", { bubbles: true }));
		}, PICKED_COLOR);

		await closeSettings(obsidian.page);

		// The calendar tile must now carry the picked colour. If the picker
		// failed to write a color rule, --event-color falls back to default.
		await evt.expectColor(PICKED_COLOR);
	});
});
