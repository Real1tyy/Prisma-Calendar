import type { Locator, Page } from "@playwright/test";

const PLUGIN_ID = "prisma-calendar";
const DEFAULT_CALENDAR_ID = "default";

// ── Schema-field accessors ──────────────────────────────────────────────────
// Fields rendered via SchemaSection stamp the outer `.setting-item` wrapper
// with `data-testid="prisma-settings-field-<key>"` but not the inner control.
// These helpers drill into the wrapper and interact with the control directly.
// Controls rendered outside SchemaSection (e.g. in general-settings.tsx) DO
// get `prisma-settings-control-<key>` — for those, use `setToggle` /
// `setTextInput` / `setDropdown` from the shared `@real1ty-obsidian-plugins/testing/e2e` package.

function schemaField(page: Page, key: string): Locator {
	return page.locator(`[data-testid="prisma-settings-field-${key}"]`).first();
}

async function ensureVisible(locator: Locator): Promise<void> {
	await locator.waitFor({ state: "visible", timeout: 10_000 });
	await locator.scrollIntoViewIfNeeded();
}

export async function setSchemaToggle(page: Page, key: string, on: boolean): Promise<void> {
	const toggle = schemaField(page, key).locator(".checkbox-container").first();
	await ensureVisible(toggle);
	const cls = (await toggle.getAttribute("class")) ?? "";
	if (cls.includes("is-enabled") !== on) {
		await toggle.click();
	}
}

export async function setSchemaTextInput(page: Page, key: string, value: string): Promise<void> {
	const input = schemaField(page, key).locator('input[type="text"], textarea').first();
	await ensureVisible(input);
	await input.fill(value);
	await input.dispatchEvent("change");
	await input.blur();
}

export async function setSchemaNumberInput(page: Page, key: string, value: number): Promise<void> {
	// Bounded integer fields (`z.number().int().min().max()`) auto-infer to the
	// slider widget (`<input type="range">`). Unbounded fields render a native
	// `<input type="number">`. Accept either so specs don't need to know which
	// widget the schema resolved to.
	//
	// For number inputs, Playwright's `fill()` handles React's value tracker
	// correctly (it uses the native HTMLInputElement.value setter, which React
	// observes). For range inputs, `fill()` no-ops — we fall back to invoking
	// the native setter directly so React's onChange still fires.
	const field = schemaField(page, key);
	const input = field.locator('input[type="number"], input[type="range"]').first();
	await ensureVisible(input);
	const inputType = await input.getAttribute("type");
	if (inputType === "range") {
		await input.evaluate((el, v) => {
			const inp = el as HTMLInputElement;
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
			setter?.call(inp, String(v));
			inp.dispatchEvent(new Event("input", { bubbles: true }));
			inp.dispatchEvent(new Event("change", { bubbles: true }));
		}, value);
	} else {
		await input.fill(String(value));
		await input.dispatchEvent("change");
	}
	await input.blur();
}

export async function setSchemaDropdown(page: Page, key: string, value: string): Promise<void> {
	const select = schemaField(page, key).locator("select").first();
	await ensureVisible(select);
	await select.selectOption(value);
}

// ── UI-level navigation ─────────────────────────────────────────────────────
// Every helper below drives the plugin the same way a user does: clicking
// buttons, pressing keyboard shortcuts, right-clicking events. No `page.evaluate`
// into `app.*`, no `executeCommandById`. The point of E2E is to exercise real
// user interactions — API shortcuts belong in unit tests.

function isMac(): boolean {
	return process.platform === "darwin";
}

/**
 * Open Obsidian Settings via the user keyboard shortcut, then click the
 * "Prisma Calendar" entry in the settings-modal sidebar. Closes any existing
 * settings modal first so invocations are idempotent.
 */
export async function openPrismaSettings(page: Page): Promise<void> {
	if (await page.locator(".modal-container .mod-settings").count()) {
		await closeSettings(page);
	}
	await page.keyboard.press(isMac() ? "Meta+," : "Control+,");
	const sidebarTab = page.locator('.vertical-tab-nav-item:has-text("Prisma Calendar")').first();
	await sidebarTab.waitFor({ state: "visible", timeout: 10_000 });
	await sidebarTab.click();
}

/**
 * Dismiss the Obsidian settings modal by clicking its close (×) button.
 * Obsidian attaches this button itself; we rely on its stable class.
 */
export async function closeSettings(page: Page): Promise<void> {
	const closeBtn = page.locator(".modal-container .mod-settings .modal-close-button").first();
	if (await closeBtn.count()) {
		await closeBtn.click();
		await page.locator(".modal-container .mod-settings").waitFor({ state: "detached", timeout: 5_000 });
		return;
	}
	await page.keyboard.press("Escape");
}

/**
 * Click a tab inside the Prisma settings pane (general, properties, bases, …).
 * Waits until the tab is visible first — some tabs are below the fold on
 * smaller viewports and need scrolling.
 */
export async function switchSettingsTab(page: Page, tabId: string): Promise<void> {
	const tab = page.locator(`[data-testid="prisma-settings-tab-${tabId}"]`).first();
	await tab.waitFor({ state: "visible", timeout: 10_000 });
	await tab.click();
}

/**
 * Open a Prisma Calendar view by clicking the ribbon icon the plugin adds to
 * the left sidebar. Each calendar bundle stamps its ribbon entry with a
 * deterministic `prisma-ribbon-open-<calendarId>` testid. Exercises the real
 * user-click path; prefer this over the API-based `openCalendarView`.
 */
export async function openCalendarViewViaRibbon(page: Page, calendarId = DEFAULT_CALENDAR_ID): Promise<void> {
	const ribbon = page.locator(`[data-testid="prisma-ribbon-open-${calendarId}"]`).first();
	await ribbon.waitFor({ state: "visible", timeout: 10_000 });
	await ribbon.click();
	await page.locator(".fc-header-toolbar.fc-toolbar").first().waitFor({ state: "visible", timeout: 10_000 });
}

/**
 * Activate Prisma-Calendar's calendar view for the given calendar ID. Uses the
 * runtime API instead of the command palette to avoid palette-UI races.
 * Preserved for pre-existing specs (events/*.spec.ts, events-helpers.ts).
 * New specs should prefer `openCalendarViewViaRibbon` to exercise the real
 * user interaction.
 */
export async function openCalendarView(page: Page, calendarId = DEFAULT_CALENDAR_ID): Promise<void> {
	await page.evaluate(
		async ({ id, pid }) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<
							string,
							{
								calendarBundles?: Array<{
									calendarId: string;
									activateCalendarView?: () => Promise<void>;
								}>;
							}
						>;
					};
				};
			};
			const plugin = w.app.plugins.plugins[pid];
			const bundle = plugin?.calendarBundles?.find((b) => b.calendarId === id) ?? plugin?.calendarBundles?.[0];
			if (!bundle || typeof bundle.activateCalendarView !== "function") {
				throw new Error(`No CalendarBundle for id=${id} (bundles: ${plugin?.calendarBundles?.length ?? 0})`);
			}
			await bundle.activateCalendarView();
		},
		{ id: calendarId, pid: PLUGIN_ID }
	);
}

/** Back-compat alias; older specs imported `openCalendar`. */
export const openCalendar = openCalendarView;

// Multiple calendar views can be open in parallel tabs. Obsidian renders the
// inactive leaves' DOM but keeps them visually hidden, so a bare `.first()`
// match can land on an inactive tab's button. Scoping the locator to the
// active workspace leaf keeps the click pointed at the view the user is
// looking at.
const ACTIVE_CALENDAR_LEAF = ".workspace-leaf.mod-active";

/**
 * Click the calendar toolbar's "Create Event" button and wait for the event
 * modal to appear. Requires the calendar view to be open first.
 */
export async function createEventViaToolbar(page: Page): Promise<void> {
	const createBtn = page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-toolbar-create"]`).first();
	await createBtn.waitFor({ state: "visible", timeout: 10_000 });
	await createBtn.click();
	await page.locator(".modal").first().waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Switch the calendar view mode by clicking the month/week/day/list toolbar
 * button. Pass "month" | "week" | "day" | "list".
 */
export async function switchCalendarViewMode(page: Page, mode: "month" | "week" | "day" | "list"): Promise<void> {
	const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-toolbar-view-${mode}"]`).first();
	await btn.waitFor({ state: "visible", timeout: 10_000 });
	await btn.click();
}

/**
 * Right-click the first rendered calendar event matching the given title to
 * open its context menu. If no title is passed, right-clicks whatever event
 * is first in the DOM. Scoped to the active leaf so parallel calendar tabs
 * don't steal the click.
 */
export async function rightClickEvent(page: Page, options: { title?: string } = {}): Promise<void> {
	const selector = options.title
		? `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-event"][data-event-title="${options.title}"]`
		: `${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-event"]`;
	const event = page.locator(selector).first();
	await event.waitFor({ state: "visible", timeout: 10_000 });
	await event.click({ button: "right" });
	await page.locator(".menu").first().waitFor({ state: "visible", timeout: 5_000 });
}

/**
 * Click an item in the currently-open context menu by its Prisma item id
 * (e.g. `editEvent`, `duplicateEvent`, `makeUntracked`). Relies on the testids
 * stamped by the shared `createContextMenu` wrapper.
 */
export async function clickContextMenuItem(page: Page, itemId: string): Promise<void> {
	const item = page.locator(`[data-testid="prisma-context-menu-item-${itemId}"]`).first();
	await item.waitFor({ state: "visible", timeout: 5_000 });
	await item.click();
}

interface EventModalMinimalValues {
	title?: string;
}

/**
 * Fill in the minimum required fields in the Create/Edit event modal so it
 * can be saved. Currently only the title — start/end fields auto-populate.
 */
export async function fillEventModalMinimal(page: Page, values: EventModalMinimalValues = {}): Promise<void> {
	if (values.title !== undefined) {
		const titleInput = page.locator('.modal [data-testid="prisma-event-control-title"]').first();
		await titleInput.waitFor({ state: "visible", timeout: 5_000 });
		await titleInput.fill(values.title);
		await titleInput.dispatchEvent("change");
	}
}

/** Click the Save button inside the open event modal and wait for it to close. */
export async function saveEventModal(page: Page): Promise<void> {
	await page.locator('.modal [data-testid="prisma-event-btn-save"]').first().click();
	await page.locator(".modal").first().waitFor({ state: "detached", timeout: 10_000 });
}

/**
 * Click a Prisma view tab. Supported ids: calendar, stats, timeline, heatmap,
 * gantt, dashboard — matches the `prisma-view-tab-<id>` testid stamped by the
 * view renderer.
 */
export async function switchView(page: Page, viewId: string): Promise<void> {
	const tab = page.locator(`[data-testid="prisma-view-tab-${viewId}"]`).first();
	await tab.waitFor({ state: "visible", timeout: 10_000 });
	await tab.click();
}

/**
 * After a `page.reload()` the plugin needs to boot again. The cleanest
 * user-visible signal that it's alive is the ribbon icon it installs in the
 * left sidebar — wait for that to reappear before driving the UI.
 */
export async function waitForPluginReady(page: Page, calendarId = DEFAULT_CALENDAR_ID): Promise<void> {
	await page
		.locator(`[data-testid="prisma-ribbon-open-${calendarId}"]`)
		.first()
		.waitFor({ state: "visible", timeout: 60_000 });
}
