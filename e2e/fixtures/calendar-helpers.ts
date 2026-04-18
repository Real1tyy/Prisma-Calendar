import type { Locator, Page } from "@playwright/test";

import { ACTIVE_CALENDAR_LEAF } from "./constants";
import { todayISO } from "./dates";
import type { SeedEventInput } from "./seed-events";
import { sel, TID, type ViewMode } from "./testids";

// Prisma-calendar-specific helpers — thin UI wrappers that don't belong in the
// generic `helpers.ts`. Disk-level event seeding + refresh live in
// `seed-events.ts`; this file only adds helpers that touch the rendered
// FullCalendar DOM or drive vault-backed APIs.

const EVENT_IN_LEAF = `${ACTIVE_CALENDAR_LEAF} ${sel(TID.block)}`;

// Re-exported from `./dates` (single source of truth for local-TZ builders)
// so existing consumers importing `todayISO` from here keep working.
export { todayISO };

/**
 * Convenience builder for seeding a timed event anchored to today. Produces a
 * `SeedEventInput` compatible with `seedEvent()` from `seed-events.ts`.
 */
export function todayTimedEvent(title: string, startHour: number, endHour: number): SeedEventInput {
	const date = todayISO();
	return {
		title,
		startDate: `${date}T${String(startHour).padStart(2, "0")}:00`,
		endDate: `${date}T${String(endHour).padStart(2, "0")}:00`,
	};
}

/**
 * Create an event through Obsidian's own vault API so `app.vault` and the
 * metadataCache treat it as a first-class file. Use this instead of
 * `seedEvent` (which writes to disk directly) whenever a command needs the
 * TFile handle — notably `batch-duplicate-selection` and `batch-clone-*`,
 * which call `getTFileOrThrow` on the source path.
 */
export async function seedEventViaVault(
	page: Page,
	event: { title: string; date: string; startTime?: string; endTime?: string; subdir?: string }
): Promise<string> {
	const subdir = event.subdir ?? "Events";
	const relativePath = `${subdir}/${event.title}.md`;
	const contents =
		`---\n` +
		`Start Date: ${event.date}T${event.startTime ?? "10:00"}\n` +
		`End Date: ${event.date}T${event.endTime ?? "11:00"}\n` +
		`---\n\n# ${event.title}\n`;
	await page.evaluate(
		async ({ path, body }) => {
			const w = window as unknown as {
				app: {
					vault: {
						adapter: { exists: (p: string) => Promise<boolean> };
						createFolder: (p: string) => Promise<void>;
						create: (p: string, content: string) => Promise<unknown>;
						getAbstractFileByPath: (p: string) => unknown;
						modify: (file: unknown, content: string) => Promise<void>;
					};
				};
			};
			const parts = path.split("/");
			parts.pop();
			if (parts.length > 0) {
				const folderPath = parts.join("/");
				if (!(await w.app.vault.adapter.exists(folderPath))) {
					await w.app.vault.createFolder(folderPath).catch(() => {});
				}
			}
			const existing = w.app.vault.getAbstractFileByPath(path);
			if (existing) await w.app.vault.modify(existing, body);
			else await w.app.vault.create(path, body);
		},
		{ path: relativePath, body: contents }
	);
	return relativePath;
}

/** Locator for a calendar event in the active leaf, matched by its title. */
export function eventByTitle(page: Page, title: string): Locator {
	return page.locator(`${EVENT_IN_LEAF}[data-event-title="${title}"]`).first();
}

/** Wait for an event with the given title to render in the active leaf. */
export async function waitForEvent(page: Page, title: string, timeout = 10_000): Promise<void> {
	await eventByTitle(page, title).waitFor({ state: "visible", timeout });
}

// Re-exported from the canonical location in `fixtures/dsl/drag.ts`.
export { dragByDelta } from "./dsl/drag";

/**
 * Click the Day view button in the calendar toolbar so events seeded for today
 * are on screen. FullCalendar auto-disables Today when the visible date is
 * already today, so we only click it when it's enabled.
 */
export async function gotoToday(page: Page): Promise<void> {
	const dayBtn = page.locator(sel(TID.toolbar("view-day"))).first();
	await dayBtn.waitFor({ state: "visible" });
	await dayBtn.click();
	await page.locator(".fc-timegrid").first().waitFor({ state: "visible" });
	const todayBtn = page.locator(sel(TID.toolbar("today"))).first();
	if (await todayBtn.isEnabled().catch(() => false)) {
		await todayBtn.click();
	}
}

/** Right-click an event by title and return the opened menu locator. */
export async function rightClickEventByTitle(page: Page, title: string): Promise<Locator> {
	const block = eventByTitle(page, title);
	await block.waitFor({ state: "visible" });
	await block.click({ button: "right" });
	return page.locator(".menu").last();
}

// FullCalendar applies `.fc-{viewType}-view` on the outer view container. We
// also accept the generic `.fc-timegrid` / `.fc-daygrid` / `.fc-list` fallback
// because the specific class isn't always stamped until the first paint cycle.
const VIEW_READY_SELECTOR: Record<ViewMode, string> = {
	day: ".fc-timeGridDay-view, .fc-timegrid",
	week: ".fc-timeGridWeek-view, .fc-timegrid",
	month: ".fc-dayGridMonth-view, .fc-daygrid",
	list: ".fc-listWeek-view, .fc-list",
};

/**
 * Click the toolbar button for the given FullCalendar view and wait for the
 * view container to render. Mirrors the four registered view types in
 * `calendar-view.ts` (`dayGridMonth`, `timeGridWeek`, `timeGridDay`, `listWeek`).
 */
export async function switchToView(page: Page, view: ViewMode): Promise<void> {
	const btn = page.locator(sel(TID.toolbar(`view-${view}`))).first();
	await btn.waitFor({ state: "visible" });
	await btn.click();
	await page.locator(VIEW_READY_SELECTOR[view]).first().waitFor({ state: "visible" });
}

/**
 * Locator for a list-view row matched by its title. FullCalendar renders list
 * events as `.fc-list-event` rows with a `.fc-list-event-title` cell; the row
 * itself (not the title cell) is what `hasText` filters.
 */
export function listEventRow(page: Page, title: string): Locator {
	return page.locator(`${ACTIVE_CALENDAR_LEAF} .fc-list-event`).filter({ hasText: title }).first();
}

/** Locator for a `dayGridMonth` cell keyed by ISO date (`YYYY-MM-DD`). */
export function monthCellForDate(page: Page, isoDate: string): Locator {
	return page.locator(`${ACTIVE_CALENDAR_LEAF} .fc-daygrid-day[data-date="${isoDate}"]`).first();
}
