import type { Locator, Page } from "@playwright/test";

// Generic form-filling helpers against Obsidian Setting DOM. Each helper
// locates by `data-testid` first and scrolls the target into view before
// interacting — long settings pages and FullCalendar overflow their parents,
// so without the scroll the click lands on nothing. Interactions dispatch
// native `input` / `change` events so Zod-backed store subscriptions fire.

function fieldLocator(page: Page, testId: string): Locator {
	return page.locator(`[data-testid="${testId}"]`).first();
}

async function ensureVisible(locator: Locator): Promise<void> {
	await locator.waitFor({ state: "visible", timeout: 10_000 });
	await locator.scrollIntoViewIfNeeded();
}

/** Flip a toggle to the requested state. No-op if already there. */
export async function setToggle(page: Page, testId: string, on: boolean): Promise<void> {
	const locator = fieldLocator(page, testId);
	await ensureVisible(locator);
	const current = (await locator.getAttribute("class")) ?? "";
	const isEnabled = current.includes("is-enabled");
	if (isEnabled !== on) {
		await locator.click();
	}
}

/**
 * Replace the contents of a text input / textarea. Blurs after filling so the
 * `useDebouncedCommit`-backed `TextInput`/`TextareaInput` controls flush their
 * pending draft to the store — those controls only commit on blur, Enter, or
 * after 300ms of inactivity, so a `change` event alone is swallowed.
 */
export async function setTextInput(page: Page, testId: string, value: string): Promise<void> {
	const locator = fieldLocator(page, testId);
	await ensureVisible(locator);
	await locator.fill(value);
	await locator.blur();
}

/**
 * Replace the contents of a numeric input. Obsidian reads `valueAsNumber`.
 * Blurs after filling for the same debounced-commit reason as `setTextInput`.
 */
export async function setNumberInput(page: Page, testId: string, value: number): Promise<void> {
	const locator = fieldLocator(page, testId);
	await ensureVisible(locator);
	await locator.fill(String(value));
	await locator.blur();
}

/** Select an option in a native `<select>`. Value must be the option value, not the label. */
export async function setDropdown(page: Page, testId: string, value: string): Promise<void> {
	const locator = fieldLocator(page, testId);
	await ensureVisible(locator);
	await locator.selectOption(value);
}

/**
 * Fill a chip-list widget. Types each value, confirms with Enter, and waits
 * briefly for the chip to materialise. Values already present are left alone.
 */
export async function setChipList(page: Page, testId: string, values: string[]): Promise<void> {
	const root = fieldLocator(page, testId);
	await ensureVisible(root);
	const input = root.locator("input").first();
	for (const value of values) {
		const already = root.locator(`.prisma-chip:has-text("${value}"), [data-chip="${value}"]`);
		if ((await already.count()) > 0) continue;
		await input.fill(value);
		await input.press("Enter");
	}
}

/** Set an `<input type="datetime-local">` or `<input type="date">` field. */
export async function setDateTimeInput(page: Page, testId: string, isoString: string): Promise<void> {
	const locator = fieldLocator(page, testId);
	await ensureVisible(locator);
	await locator.fill(isoString);
	await locator.dispatchEvent("change");
}

/** Click a stamped button. Waits for visibility + scroll. */
export async function clickButton(page: Page, testId: string): Promise<void> {
	const locator = fieldLocator(page, testId);
	await ensureVisible(locator);
	await locator.click();
}

/**
 * Read the current value of any stamped input / toggle / select. Returns the
 * string representation so callers can `expect(...).toBe("42")` uniformly.
 * Toggles read as `"true"` / `"false"`.
 */
export async function expectFieldValue(page: Page, testId: string): Promise<string> {
	const locator = fieldLocator(page, testId);
	await locator.waitFor({ state: "attached", timeout: 5_000 });
	return locator.evaluate((el) => {
		if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
			return el.value;
		}
		if (el.classList.contains("checkbox-container")) {
			return String(el.classList.contains("is-enabled"));
		}
		return el.textContent?.trim() ?? "";
	});
}

export type SettleOptions = {
	/** If provided, force-flush the plugin's pending saveData(). Skips the debounce wait entirely. */
	pluginId?: string;
	/** Milliseconds to wait for the debounce to fire. Defaults to 500. Ignored when `pluginId` is set. */
	ms?: number;
};

/**
 * Wait for settings autosave to hit disk. Two modes:
 *
 * - `pluginId` supplied (preferred): calls `plugin.saveData(plugin.settings)`
 *   synchronously, bypassing the store's ~300ms debounce. Input helpers now
 *   commit into the store synchronously (`setTextInput` blurs, `setDropdown`
 *   fires `change`), so the in-memory settings always reflect the intended
 *   state by the time we get here — no wait needed.
 * - No `pluginId` (legacy): falls back to a blind `ms`-millisecond wait for
 *   the debounce to fire naturally. Always pass `pluginId` in new code.
 */
export async function settleSettings(page: Page, options: SettleOptions = {}): Promise<void> {
	if (options.pluginId) {
		await page.evaluate(async (id) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<string, { saveData?: (data: unknown) => Promise<void>; settings?: unknown }>;
					};
				};
			};
			const plugin = w.app.plugins.plugins[id];
			if (plugin && typeof plugin.saveData === "function") {
				await plugin.saveData(plugin.settings).catch(() => {});
			}
		}, options.pluginId);
		return;
	}
	const ms = options.ms ?? 500;
	await new Promise((resolve) => setTimeout(resolve, ms));
}
