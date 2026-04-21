import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { type Locator, type Page } from "@playwright/test";
import { listEventFiles as listAllMarkdownFiles } from "@real1ty-obsidian-plugins/testing/e2e";

import { ACTIVE_CALENDAR_LEAF, PLUGIN_ID } from "../../fixtures/constants";
import { sel, TID, UNTRACKED_BUTTON_TID, UNTRACKED_DROPDOWN_TID, UNTRACKED_ITEM_TID } from "../../fixtures/testids";
import { type EventModalInput, fillEventModal, saveEventModal } from "./fill-event-modal";

export { PLUGIN_ID };

// Prisma-Calendar seeds `Virtual Events.md` into every calendar directory on
// bundle init (via `VirtualEventStore` with `createIfMissing: true`). That
// sentinel is not a user event — counting it inflates absolute assertions
// (`.toBe(0)`, `.toBe(1)`) and silently breaks delta arithmetic when a new
// calendar is added mid-spec. Every event-listing call in this plugin's e2e
// suite must go through this filtered version instead of the raw shared
// helper, so the sentinel can never leak into assertions.
const VIRTUAL_EVENTS_FILE = "Virtual Events.md";

/**
 * List calendar event files under `subdir`, excluding the Virtual Events
 * sentinel. This is the default event-listing helper for Prisma-Calendar
 * e2e specs — prefer it over the shared `listEventFiles` primitive.
 */
export function listEventFiles(vaultDir: string, subdir = "Events"): string[] {
	return listAllMarkdownFiles(vaultDir, subdir).filter((p) => !p.endsWith(`/${VIRTUAL_EVENTS_FILE}`));
}

// Back-compat selector constants — every new `[data-testid="..."]` should go
// through `sel(TID.*)` directly, but these aliases let existing call sites
// keep working while they get migrated. All values derive from the TID
// registry so a plugin-side rename only needs one edit.
export const EVENT_MODAL_SELECTOR = sel(TID.event.field("title"));
export const TOOLBAR_CREATE_SELECTOR = sel(TID.toolbar("create"));
export const TOOLBAR_VIEW_MONTH_SELECTOR = sel(TID.toolbar("view-month"));
export const TOOLBAR_VIEW_WEEK_SELECTOR = sel(TID.toolbar("view-week"));
export const TOOLBAR_VIEW_DAY_SELECTOR = sel(TID.toolbar("view-day"));
export const TOOLBAR_NEXT_SELECTOR = sel(TID.toolbar("next"));
export const TOOLBAR_PREV_SELECTOR = sel(TID.toolbar("prev"));
export const UNTRACKED_BUTTON_SELECTOR = sel(UNTRACKED_BUTTON_TID);
export const UNTRACKED_DROPDOWN_SELECTOR = sel(UNTRACKED_DROPDOWN_TID);
export const UNTRACKED_ITEM_SELECTOR = sel(UNTRACKED_ITEM_TID);
export const CANCEL_BUTTON_SELECTOR = sel(TID.event.btn("cancel"));

const NEW_FILE_POLL_INTERVAL_MS = 100;
const NEW_FILE_TIMEOUT_MS = 10_000;
const MODAL_WAIT_TIMEOUT_MS = 15_000;
const MODAL_CLOSE_TIMEOUT_MS = 15_000;

/** Subset of the Playwright fixture we need to drive the event flows. */
export interface ObsidianHandle {
	page: Page;
	vaultDir: string;
}

/** Snapshot an events directory so we can diff the new files after a create. */
export function snapshotEventFiles(vaultDir: string, subdir = "Events"): Set<string> {
	return new Set(listEventFiles(vaultDir, subdir));
}

/**
 * Wait until `count` new files exist under the events subdir compared to the
 * baseline. Polling disk because the plugin's file creation is async — modal
 * close is not a signal that the file has been written and indexed.
 */
export async function waitForNewEventFiles(
	vaultDir: string,
	baseline: Set<string>,
	count = 1,
	timeoutMs = NEW_FILE_TIMEOUT_MS,
	subdir = "Events"
): Promise<string[]> {
	const deadline = Date.now() + timeoutMs;
	for (;;) {
		const current = listEventFiles(vaultDir, subdir);
		const added = current.filter((p) => !baseline.has(p));
		if (added.length >= count) {
			return added.map((absolute) => absolute.slice(vaultDir.length + 1));
		}
		if (Date.now() > deadline) {
			throw new Error(
				`timed out waiting for ${count} new event file(s) in ${subdir}; baseline=${baseline.size}, current=${current.length}, added=${added.length}`
			);
		}
		await new Promise((resolve) => setTimeout(resolve, NEW_FILE_POLL_INTERVAL_MS));
	}
}

/** Wait for Obsidian's workspace to be layout-ready. */
export async function waitForWorkspaceReady(page: Page): Promise<void> {
	await page.evaluate(
		() =>
			new Promise<void>((resolve) => {
				const w = window as unknown as {
					app: {
						workspace: {
							layoutReady?: boolean;
							onLayoutReady: (cb: () => void) => void;
						};
					};
				};
				if (w.app.workspace.layoutReady) {
					resolve();
					return;
				}
				w.app.workspace.onLayoutReady(() => resolve());
			})
	);
}

/**
 * Open the calendar view by clicking Obsidian's ribbon / activating the
 * calendar leaf. The fixture initializes bundles but doesn't activate a view —
 * specs opt in by calling this and then clicking around.
 */
export async function openCalendarView(page: Page, calendarId = "default"): Promise<void> {
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
	// Scope the post-reveal waits to the active leaf so multi-calendar specs
	// (with two tabs mounted) don't trip Playwright's strict-mode multi-match.
	await page
		.locator(".workspace-leaf.mod-active .fc")
		.first()
		.waitFor({ state: "visible", timeout: MODAL_WAIT_TIMEOUT_MS });
	await page
		.locator(`.workspace-leaf.mod-active ${TOOLBAR_CREATE_SELECTOR}`)
		.first()
		.waitFor({ state: "visible", timeout: MODAL_WAIT_TIMEOUT_MS });
}

/** Open the calendar and wait for the toolbar to be interactive. */
export async function openCalendarReady(page: Page): Promise<void> {
	await waitForWorkspaceReady(page);
	await openCalendarView(page);
}

/** Switch to the FullCalendar week time-grid by clicking the toolbar button. */
export async function switchToWeekView(page: Page): Promise<void> {
	await page.locator(TOOLBAR_VIEW_WEEK_SELECTOR).click();
	await page.locator(".fc-timegrid").waitFor({ state: "visible", timeout: 10_000 });
}

/** Switch to the FullCalendar month grid by clicking the toolbar button. */
export async function switchToMonthView(page: Page): Promise<void> {
	await page.locator(TOOLBAR_VIEW_MONTH_SELECTOR).click();
	await page.locator(".fc-daygrid").waitFor({ state: "visible", timeout: 10_000 });
}

/** Wait for at least one `.fc-event` block whose label contains `title` to be visible. */
export async function expectEventVisible(page: Page, title: string, timeoutMs = 15_000): Promise<void> {
	await page.locator(".fc-event", { hasText: title }).first().waitFor({ state: "visible", timeout: timeoutMs });
}

/**
 * Locator for all event blocks rendered in the calendar grid matching a title.
 * Scope is explicitly `.fc-view-harness .fc-event` so the match excludes items
 * in the untracked dropdown, which reuses the `.fc-event` class for FC's
 * external draggable contract.
 */
export function eventBlockLocator(page: Page, title: string): Locator {
	return page.locator(".fc-view-harness .fc-event", { hasText: title });
}

const SEED_ZETTEL_ID = "20250101000000";

/**
 * Write a minimal event markdown file under `Events/` with the given
 * frontmatter. The filename embeds a fixed ZettelID so tests can predict
 * the path, and the H1 mirrors the title so calendar-block text matching
 * works the same way the real plugin produces files.
 */
export function seedEventFile(
	vaultDir: string,
	title: string,
	frontmatter: Record<string, string | boolean | string[]>
): string {
	const relativePath = `Events/${title}-${SEED_ZETTEL_ID}.md`;
	const fmBody = Object.entries(frontmatter)
		.map(([key, value]) => {
			if (Array.isArray(value)) {
				if (value.length === 0) return `${key}: []`;
				return `${key}:\n${value.map((v) => `  - ${v}`).join("\n")}`;
			}
			return `${key}: ${value}`;
		})
		.join("\n");
	writeFileSync(join(vaultDir, relativePath), `---\n${fmBody}\n---\n\n# ${title}\n`, "utf8");
	return relativePath;
}

/**
 * Click the toolbar prev/next button to advance the view by `monthDiff`
 * "pages". In month view each click is ±1 month; in week/day views the
 * semantics follow whatever the view advances by. Negative = back.
 */
export async function navigateCalendar(page: Page, monthDiff: number): Promise<void> {
	if (monthDiff === 0) return;
	const selector = monthDiff > 0 ? TOOLBAR_NEXT_SELECTOR : TOOLBAR_PREV_SELECTOR;
	for (let i = 0; i < Math.abs(monthDiff); i++) {
		await page.locator(selector).click();
	}
}

/** Months between today and an ISO-ish date string (YYYY-MM-DD or YYYY-MM-DDTHH:MM). */
export function monthsFromTodayTo(isoDate: string): number {
	const today = new Date();
	const target = new Date(isoDate);
	return (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
}

/**
 * Click the toolbar "Create" button and wait for the event modal to open.
 * Dumps the open-modal HTML into the error on attach-timeout so DOM churn is
 * diagnosable from the failure log alone.
 */
export async function openCreateModal(page: Page): Promise<void> {
	// Scoped to the active leaf so multi-calendar specs (which mount two
	// toolbars, both carrying the same `prisma-cal-toolbar-create` testid)
	// don't trip Playwright's strict-mode ambiguity check. `openCalendarView`
	// activates the target leaf before creates, so `.mod-active` resolves to
	// the intended calendar.
	await page.locator(`${ACTIVE_CALENDAR_LEAF} ${TOOLBAR_CREATE_SELECTOR}`).first().click();
	const title = page.locator(EVENT_MODAL_SELECTOR);
	try {
		await title.waitFor({ state: "attached", timeout: MODAL_WAIT_TIMEOUT_MS });
	} catch (err) {
		const modalHtml = await page
			.locator(".modal")
			.first()
			.evaluate((el) => (el as HTMLElement).outerHTML.slice(0, 2_000))
			.catch(() => "<no .modal element>");
		throw new Error(`event modal never attached. Modal DOM:\n${modalHtml}\n\nOriginal: ${String(err)}`);
	}
	await title.waitFor({ state: "visible", timeout: MODAL_WAIT_TIMEOUT_MS });
}

/**
 * Right-click a calendar event by its title text, then click the context-menu
 * entry by id (e.g. `editEvent`, `deleteEvent`, `skipEvent`). Stable against
 * label localisation/renames because menu items are stamped with testids
 * derived from their id.
 */
export async function rightClickEventMenu(page: Page, eventTitle: string, menuItemId: string): Promise<void> {
	const eventBlock = page.locator(".fc-event", { hasText: eventTitle }).first();
	await eventBlock.waitFor({ state: "visible" });
	await eventBlock.click({ button: "right" });
	// `menuItemId` is typed as plain string here because this helper is a
	// legacy entry point for specs that pass both registry-valid ids and
	// out-of-registry ones (e.g. `__manage`). The full typed path is
	// `calendar.eventByTitle(...).rightClick(key)` in the DSL.
	const menuItem = page.locator(`[data-testid="prisma-context-menu-item-${menuItemId}"]`);
	await menuItem.waitFor({ state: "visible" });
	await menuItem.click();
}

/** Wait for the event modal to close. */
export async function waitForModalClosed(page: Page, timeoutMs = MODAL_CLOSE_TIMEOUT_MS): Promise<void> {
	await page.waitForFunction((selector) => document.querySelectorAll(selector).length === 0, EVENT_MODAL_SELECTOR, {
		timeout: timeoutMs,
	});
}

export function readRawFrontmatter(absolutePath: string): string {
	const raw = readFileSync(absolutePath, "utf8");
	const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	return match ? match[1]! : "";
}

export function readRawFrontmatterFromVault(vaultDir: string, relativePath: string): string {
	return readRawFrontmatter(join(vaultDir, relativePath));
}

/** Format a Date as `YYYY-MM-DD` in local time (matches the modal's date input). */
export function formatLocalDate(date: Date): string {
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

/**
 * Full UI-driven create flow: snapshot baseline → toolbar Create → fill →
 * save → wait for the new file on disk. Returns the relative vault path.
 */
export async function createEventViaModal(obsidian: ObsidianHandle, input: EventModalInput): Promise<string> {
	const baseline = snapshotEventFiles(obsidian.vaultDir);
	await openCreateModal(obsidian.page);
	await fillEventModal(obsidian.page, input);
	await saveEventModal(obsidian.page);
	const [relativePath] = await waitForNewEventFiles(obsidian.vaultDir, baseline, 1);
	if (!relativePath) throw new Error("createEventViaModal: no new event file appeared");
	return relativePath;
}

/** Locator for all chip items in a given event-modal field (categories, participants, …). */
export function chipsForField(page: Page, fieldTestId: string): Locator {
	return page.locator(`[data-testid="${fieldTestId}"] [data-testid="prisma-chip-item"]`);
}

/** Click the × on a chip identified by its parent field testid + chip value. */
export async function removeChip(page: Page, fieldTestId: string, chipValue: string): Promise<void> {
	await page
		.locator(`[data-testid="${fieldTestId}"] [data-chip-value="${chipValue}"] [data-testid="prisma-chip-remove"]`)
		.click();
}
