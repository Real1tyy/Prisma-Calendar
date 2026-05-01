import type { Locator, Page } from "@playwright/test";

import { ACTIVE_CALENDAR_LEAF, DEFAULT_CALENDAR_ID, PLUGIN_ID } from "./constants";

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
	await page
		.locator(".progress-bar-container")
		.waitFor({ state: "hidden" })
		.catch(() => {});
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
	const tab = page.locator(`[data-testid="prisma-settings-nav-${tabId}"]`).first();
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
 * Switch the calendar view mode by clicking the year/month/week/day/list toolbar
 * button. Pass "year" | "month" | "week" | "day" | "list".
 */
export async function switchCalendarViewMode(
	page: Page,
	mode: "year" | "month" | "week" | "day" | "list"
): Promise<void> {
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
 *
 * For group tabs (like `dashboard` which has `dashboard-by-name` etc. as
 * children), clicking the group button opens a dropdown but does NOT activate
 * any child panel. Use `switchToGroupChild` to drill in.
 */
export async function switchView(page: Page, viewId: string): Promise<void> {
	const tab = page.locator(`[data-testid="prisma-view-tab-${viewId}"]`).first();
	await tab.waitFor({ state: "visible", timeout: 10_000 });
	await tab.click();
}

/**
 * Activate a child tab inside a group tab (e.g. `dashboard` → `dashboard-by-name`).
 * Clicks the group's tab button, waits for the dropdown, clicks the child row.
 * The child rows are stamped with the same `prisma-view-tab-<childId>` testid
 * as leaf tabs, so the test locator is stable.
 */
export async function switchToGroupChild(page: Page, groupId: string, childId: string): Promise<void> {
	const group = page.locator(`[data-testid="prisma-view-tab-${groupId}"]`).first();
	await group.waitFor({ state: "visible", timeout: 10_000 });
	await group.click();
	const child = page.locator(`[data-testid="prisma-view-tab-${childId}"]`).first();
	await child.waitFor({ state: "visible", timeout: 5_000 });
	await child.click();
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

// ── Analytics helpers ───────────────────────────────────────────────────────
// Added for the analytics E2E suite. Extends the click-only contract above
// to page-header toolbar actions, the Pro-unlock test seam, and the Gantt
// renderer.

/**
 * Click a button in the Prisma page header toolbar. `actionId` matches an
 * entry in `buildPageHeaderActions()` (e.g. `create-event`, `daily-stats`,
 * `refresh`). Relies on `data-testid="prisma-toolbar-<id>"` stamped once
 * at the shared `createPageHeader` render site.
 *
 * If the button isn't currently visible in the toolbar (user has it stashed
 * behind the "+" overflow), this will fail — the bootstrap seed in
 * `electron.ts` pre-populates a visible set that covers every toolbar id
 * the analytics suite clicks.
 */
export async function clickToolbar(page: Page, actionId: string): Promise<void> {
	const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-toolbar-${actionId}"]`).first();
	await btn.waitFor({ state: "visible", timeout: 5_000 });
	await btn.click();
}

export interface CreateEventInput {
	title: string;
	/**
	 * For timed events: `YYYY-MM-DDTHH:mm` — typed into the Start Date
	 * datetime-local input. For all-day events: `YYYY-MM-DD` — typed into
	 * the Date input.
	 */
	start?: string;
	/** For timed events only: `YYYY-MM-DDTHH:mm` typed into the End Date input. */
	end?: string;
	allDay?: boolean;
	/**
	 * Category names to attach via the "Assign categories" picker modal. Each
	 * is created on the fly if it doesn't already exist in the vault.
	 */
	categories?: string[];
}

/**
 * End-to-end create flow: click `create-event` → fill modal → Save. Composes
 * the existing helpers (`createEventViaToolbar` + `fillEventModalMinimal` +
 * `saveEventModal`) with additional fields so analytics specs can seed
 * deterministic data through the real UI.
 *
 * Date-field routing matches the modal's mutually-exclusive containers:
 * - Timed events: Start Date + End Date datetime-local inputs are visible,
 *   the Date input is hidden behind `.prisma-hidden`.
 * - All-day events: the reverse — Date input is visible, Start/End aren't.
 */
export async function createEventViaUI(page: Page, input: CreateEventInput): Promise<void> {
	await createEventViaToolbar(page);
	await fillEventModalMinimal(page, { title: input.title });

	if (input.allDay) {
		const allDayToggle = page.locator('.modal [data-testid="prisma-event-control-allDay"]').first();
		await allDayToggle.check({ force: true });
		if (input.start) {
			const dateOnly = input.start.includes("T") ? input.start.slice(0, 10) : input.start;
			const dateControl = page.locator('.modal [data-testid="prisma-event-control-date"]').first();
			await dateControl.waitFor({ state: "visible", timeout: 5_000 });
			await dateControl.fill(dateOnly);
			await dateControl.dispatchEvent("change");
		}
	} else {
		if (input.start) {
			const startControl = page.locator('.modal [data-testid="prisma-event-control-start"]').first();
			await startControl.waitFor({ state: "visible", timeout: 5_000 });
			await startControl.fill(input.start);
			await startControl.dispatchEvent("change");
		}
		if (input.end) {
			const endControl = page.locator('.modal [data-testid="prisma-event-control-end"]').first();
			await endControl.waitFor({ state: "visible", timeout: 5_000 });
			await endControl.fill(input.end);
			await endControl.dispatchEvent("change");
		}
	}

	if (input.categories && input.categories.length > 0) {
		await assignCategoriesViaModal(page, input.categories);
	}

	await saveEventModal(page);
}

export async function seedEvents(page: Page, events: CreateEventInput[]): Promise<void> {
	for (const input of events) {
		await createEventViaUI(page, input);
	}
}

/**
 * Drive the full "assign prerequisite" flow through the calendar UI: right-click
 * the dependant, open its context menu, hit "Assign prerequisites", then click
 * the prerequisite tile in the calendar. Both tiles must be visible in the
 * current view at the same time, so the caller usually switches to month view
 * before calling.
 */
export async function assignPrerequisiteViaUI(page: Page, dependant: string, prerequisite: string): Promise<void> {
	await rightClickEvent(page, { title: dependant });
	await clickContextMenuItem(page, "assignPrerequisites");
	const prereqTile = page
		.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-cal-event"][data-event-title="${prerequisite}"]`)
		.first();
	await prereqTile.waitFor({ state: "visible", timeout: 5_000 });
	await prereqTile.click();
	await page
		.locator(".prisma-prereq-selection-banner")
		.first()
		.waitFor({ state: "detached", timeout: 5_000 })
		.catch(() => {});
}

/**
 * Flip the Prisma-Calendar license into Pro mode for the current session via
 * the license-manager's `__setProForTesting` public seam (guarded by
 * `window.E2E === true`, which the bootstrap sets). No user path for this —
 * license validation is network-backed.
 */
export async function unlockPro(page: Page): Promise<void> {
	await page.evaluate((pid) => {
		const w = window as unknown as {
			app: {
				plugins: {
					plugins: Record<
						string,
						{
							licenseManager?: {
								__setProForTesting?: (v: boolean) => void;
							};
						}
					>;
				};
			};
		};
		const lm = w.app.plugins.plugins[pid]?.licenseManager;
		if (!lm?.__setProForTesting) {
			throw new Error(`licenseManager.__setProForTesting missing on ${pid}`);
		}
		lm.__setProForTesting(true);
	}, PLUGIN_ID);
}

/** Locate a Gantt bar whose label matches `title`, scoped to the active calendar leaf. */
export function ganttBarLocator(page: Page, title: string): Locator {
	return page
		.locator(
			`${ACTIVE_CALENDAR_LEAF} .prisma-gantt-bar:has(.prisma-gantt-bar-label:text-is("${title.replace(/"/g, '\\"')}"))`
		)
		.first();
}

export async function rightClickGanttBar(page: Page, title: string): Promise<void> {
	const bar = ganttBarLocator(page, title);
	await bar.waitFor({ state: "visible", timeout: 5_000 });
	await bar.click({ button: "right" });
}

// ── Phase 2: category assignment + list modals + untracked dropdown ─────────

/**
 * Drive the "Assign categories" picker modal from inside the open event modal.
 * Clicks the Assign button, ticks each named category checkbox, and saves.
 * The picker is `openCategoryAssignModal` in `modals/category/assignment.ts`;
 * rows are stamped `data-testid="prisma-assign-item"` + `data-assign-name="<name>"`.
 */
export async function assignCategoriesViaModal(page: Page, categories: string[]): Promise<void> {
	const modalsBefore = await page.locator(".modal").count();
	await page.locator('.modal [data-testid="prisma-event-btn-assign-categories"]').first().click();
	await page.waitForFunction((n) => document.querySelectorAll(".modal").length > n, modalsBefore, { timeout: 5_000 });

	// The assign modal is the top one (highest index). Obsidian stacks them.
	const assignModalIdx = modalsBefore; // zero-based index of the new modal
	const assignModal = page.locator(".modal").nth(assignModalIdx);

	for (const name of categories) {
		const row = assignModal.locator(`[data-testid="prisma-assign-item"][data-assign-name="${name}"]`).first();
		if ((await row.count()) === 0) {
			// Category doesn't exist — type the name into the search input to
			// surface the "Create new" button, then click it. `createNewItem`
			// adds the entry AND checks it automatically (see assignment.ts).
			const searchInput = assignModal.locator('[data-testid="prisma-assign-search"]').first();
			await searchInput.fill(name);
			await searchInput.dispatchEvent("input");
			const createBtn = assignModal.locator('[data-testid="prisma-assign-create-new"]').first();
			await createBtn.waitFor({ state: "visible", timeout: 5_000 });
			await createBtn.click();
			await row.waitFor({ state: "visible", timeout: 5_000 });
		} else {
			const checkbox = row.locator('input[type="checkbox"]').first();
			if (!(await checkbox.isChecked())) await row.click();
		}
	}

	await assignModal.locator('[data-testid="prisma-assign-submit"]').first().click();
	await page.waitForFunction((n) => document.querySelectorAll(".modal").length <= n, modalsBefore, {
		timeout: 5_000,
	});
}

/**
 * Click the "Events" group button (recurring events list) via its toolbar
 * action id. Pairs with the `show-recurring` page-header action.
 */
export async function openEventsModal(page: Page): Promise<void> {
	await clickToolbar(page, "show-recurring");
	await page.locator(".modal").first().waitFor({ state: "visible", timeout: 5_000 });
}

/** Click a tab inside the multi-tab EventsModal (recurring / byCategory / byName). */
export async function switchEventsModalTab(page: Page, tabId: "recurring" | "byCategory" | "byName"): Promise<void> {
	const tab = page.locator(`[data-testid="prisma-events-modal-tab-${tabId}"]`).first();
	await tab.waitFor({ state: "visible", timeout: 5_000 });
	await tab.click();
}

/** Click a list item inside any event-list modal by its title. Drills into series/details. */
export async function clickEventListItem(page: Page, title: string): Promise<void> {
	const item = page.locator(`[data-testid="prisma-event-list-item-${title}"]`).first();
	await item.waitFor({ state: "visible", timeout: 5_000 });
	await item.click();
}

/**
 * Inside an event-series modal, click one of the Bases-footer visualisation
 * buttons: table / list / cards / timeline / heatmap. Each opens its own
 * visualisation modal on top of the series modal.
 */
export async function pickSeriesBasesView(
	page: Page,
	viewType: "table" | "list" | "cards" | "timeline" | "heatmap"
): Promise<void> {
	const btn = page.locator(`[data-testid="prisma-event-series-bases-${viewType}"]`).first();
	await btn.waitFor({ state: "visible", timeout: 5_000 });
	await btn.click();
}

/** Click the calendar toolbar's Untracked-events "⋮" button to open the dropdown. */
export async function openUntrackedDropdown(page: Page): Promise<void> {
	const toggle = page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-untracked-dropdown-button"]`).first();
	await toggle.waitFor({ state: "visible", timeout: 10_000 });
	await toggle.click();
}
