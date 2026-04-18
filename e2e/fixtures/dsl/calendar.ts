import { expect, type Locator, type Page } from "@playwright/test";
import type { BootstrappedObsidian } from "@real1ty-obsidian-plugins/testing/e2e";

import {
	listEventFiles,
	openCreateModal,
	seedEventFile,
	snapshotEventFiles,
	waitForNewEventFiles,
} from "../../specs/events/events-helpers";
import { type EventModalInput, fillEventModal, saveEventModal } from "../../specs/events/fill-event-modal";
import { runCommand } from "../commands";
import { ACTIVE_CALENDAR_LEAF, PLUGIN_ID } from "../constants";
import { isoLocal } from "../dates";
import { refreshCalendar } from "../seed-events";
import { sel, TID, type ToolbarActionKey, type ViewMode, type ViewTabKey } from "../testids";
import { type BatchHandle, openBatch } from "./batch";
import { createEventHandle, type EventHandle } from "./event";

// CalendarHandle — root of the E2E DSL. Represents "a live calendar view in
// an Obsidian session". Exposes every operation specs currently reach for
// via a grab-bag of page-level helpers: create + seed events, batch, undo /
// redo, toolbar buttons, view switches, disk assertions. Produced by the
// `calendar` Playwright fixture in `electron.ts` after the calendar view is
// open.
//
// The handle closes over `page` + `vaultDir`; calls always re-query the
// renderer / disk. Dropping the handle between specs is safe — state lives
// in the DOM / vault, not on the handle.

export interface CalendarHandle {
	readonly page: Page;
	readonly vaultDir: string;

	/** Create a timed event via the toolbar → modal flow. Returns a handle pinned to the new path. */
	createEvent(input: EventCreate): Promise<EventHandle>;

	/** Seed N events with auto-generated titles. Stable titles: `<prefix> 1` … `<prefix> N`. */
	seedEvents(count: number, options?: SeedOptions): Promise<EventHandle[]>;

	/** Seed arbitrary-titled events via the UI and drain the success-notice stack. */
	seedMany(inputs: readonly EventCreate[]): Promise<EventHandle[]>;

	/**
	 * Write an event directly to disk (bypassing the create modal) and refresh
	 * the indexer so the plugin picks it up. Prefer this over hand-rolled
	 * `writeFileSync` + `openCalendarReady` sequences — the refresh step is
	 * required for the file to appear in the calendar view.
	 */
	seedOnDisk(title: string, frontmatter: Record<string, string | boolean>): Promise<EventHandle>;

	batch(events: readonly EventHandle[]): Promise<BatchHandle>;

	undo(times?: number): Promise<void>;
	redo(times?: number): Promise<void>;

	/** Wait until the on-disk Events/ tree holds exactly `n` files. */
	expectEventCount(n: number): Promise<void>;

	/**
	 * Pin a handle on an already-rendered event by title. The underlying file
	 * is resolved lazily from the block's `data-event-file-path` attribute.
	 * Use this to right-click / assert on events seeded outside the DSL.
	 */
	eventByTitle(title: string): Promise<EventHandle>;

	/** Click a page-header toolbar action (create-event / daily-stats / refresh / …). */
	clickToolbar(action: ToolbarActionKey): Promise<void>;

	/** Switch the analytics view tab. For group tabs use `switchToGroupChild`. */
	switchView(tab: ViewTabKey): Promise<void>;

	/** Drill into a child inside a group tab (e.g. dashboard → dashboard-by-name). */
	switchToGroupChild(group: ViewTabKey, child: ViewTabKey): Promise<void>;

	/** Click the FullCalendar view-mode button (month/week/day/list). */
	switchMode(mode: ViewMode): Promise<void>;

	/** Flip the license to Pro via the `__setProForTesting` seam (guarded by `window.E2E`). */
	unlockPro(): Promise<void>;

	/** Wait for stacked success/error `.notice` overlays to clear so they stop intercepting clicks. */
	waitForNoticesClear(): Promise<void>;

	/** Click the untracked-events dropdown toggle in the toolbar. */
	openUntrackedDropdown(): Promise<void>;

	/** Fire a registered Obsidian command via the command palette. */
	runCommand(name: string): Promise<void>;
}

/**
 * Shape accepted by `createEvent` / `seedMany`. A direct subset of
 * `EventModalInput` — every field is typed into the modal via `fillEventModal`.
 * `start` / `end` are `YYYY-MM-DDTHH:mm`; `date` is `YYYY-MM-DD` for all-day.
 */
export type EventCreate = Pick<
	EventModalInput,
	| "title"
	| "start"
	| "end"
	| "allDay"
	| "date"
	| "categories"
	| "prerequisites"
	| "participants"
	| "location"
	| "icon"
	| "skip"
	| "breakMinutes"
	| "minutesBefore"
	| "daysBefore"
	| "customProperties"
	| "recurring"
> & {
	title: string;
};

export interface SeedOptions {
	prefix?: string;
	/** First event's start hour (defaults to 8). Each subsequent event +1h. */
	startHour?: number;
	/** Days from today for the seeded events (defaults to 1). */
	daysFromToday?: number;
}

interface CalendarHandleDeps {
	obsidian: BootstrappedObsidian;
}

/**
 * Locate the block for `title` in the active calendar leaf. Used by handle
 * methods that don't have a cached path (e.g. `eventByTitle`).
 */
function blockByTitle(page: Page, title: string): Locator {
	return page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.block)}[data-event-title="${title}"]`).first();
}

export function createCalendarHandle(deps: CalendarHandleDeps): CalendarHandle {
	const page = deps.obsidian.page;
	const vaultDir = deps.obsidian.vaultDir;

	const createEvent: CalendarHandle["createEvent"] = async (input) => {
		const baseline = snapshotEventFiles(vaultDir);
		await openCreateModal(page);
		await fillEventModal(page, input);
		await saveEventModal(page);
		const [newPath] = await waitForNewEventFiles(vaultDir, baseline);
		if (!newPath) throw new Error(`createEvent(${input.title}): no new event file appeared`);
		return createEventHandle({ page, vaultDir }, newPath, input.title);
	};

	const waitForNoticesClear: CalendarHandle["waitForNoticesClear"] = async () => {
		await page
			.locator(".notice-container .notice")
			.first()
			.waitFor({ state: "detached", timeout: 10_000 })
			.catch(() => {
				// nothing to drain
			});
	};

	return {
		page,
		vaultDir,

		createEvent,

		async seedEvents(count, options = {}) {
			const prefix = options.prefix ?? "Event";
			const startHour = options.startHour ?? 8;
			const days = options.daysFromToday ?? 1;
			const out: EventHandle[] = [];
			for (let i = 0; i < count; i++) {
				const handle = await createEvent({
					title: `${prefix} ${i + 1}`,
					start: isoLocal(days, startHour + i),
					end: isoLocal(days, startHour + i + 1),
				});
				out.push(handle);
			}
			return out;
		},

		async seedMany(inputs) {
			const out: EventHandle[] = [];
			for (const input of inputs) out.push(await createEvent(input));
			await waitForNoticesClear();
			return out;
		},

		async seedOnDisk(title, frontmatter) {
			const relPath = seedEventFile(vaultDir, title, frontmatter);
			await refreshCalendar(page);
			return createEventHandle({ page, vaultDir }, relPath, title);
		},

		async batch(events) {
			return openBatch(page, events);
		},

		async undo(times = 1) {
			for (let i = 0; i < times; i++) await runCommand(page, "Prisma Calendar: Undo");
		},

		async redo(times = 1) {
			for (let i = 0; i < times; i++) await runCommand(page, "Prisma Calendar: Redo");
		},

		async expectEventCount(n) {
			await expect.poll(() => listEventFiles(vaultDir).length, { message: `expected ${n} event files` }).toBe(n);
		},

		async eventByTitle(title) {
			const block = blockByTitle(page, title);
			await block.waitFor({ state: "visible" });
			const relPath = await block.getAttribute("data-event-file-path");
			if (!relPath) throw new Error(`eventByTitle("${title}"): block has no data-event-file-path`);
			return createEventHandle({ page, vaultDir }, relPath, title);
		},

		async clickToolbar(action) {
			const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.pageHeader(action))}`).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},

		async switchView(tab) {
			const el = page.locator(sel(TID.viewTab(tab))).first();
			await el.waitFor({ state: "visible" });
			await el.click();
		},

		async switchToGroupChild(group, child) {
			const groupTab = page.locator(sel(TID.viewTab(group))).first();
			await groupTab.waitFor({ state: "visible" });
			await groupTab.click();
			const childTab = page.locator(sel(TID.viewTab(child))).first();
			await childTab.waitFor({ state: "visible" });
			await childTab.click();
		},

		async switchMode(mode) {
			const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.toolbar(`view-${mode}`))}`).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},

		async unlockPro() {
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
		},

		waitForNoticesClear,

		async openUntrackedDropdown() {
			const toggle = page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-untracked-dropdown-button"]`).first();
			await toggle.waitFor({ state: "visible" });
			await toggle.click();
		},

		async runCommand(name) {
			await runCommand(page, name);
		},
	};
}
