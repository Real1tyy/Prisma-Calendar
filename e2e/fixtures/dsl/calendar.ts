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
import { anchorDate, anchorISO, isoLocal } from "../dates";
import { getEventCount, refreshCalendar, type SeedEventInput, waitForEventCount } from "../seed-events";
import { sel, TID, type ToolbarActionKey, type ViewMode, type ViewTabKey } from "../testids";
import { type BatchHandle, openBatch } from "./batch";
import { createEventHandle, type EventHandle } from "./event";
import { createEventsModalHandle, type EventsModalHandle } from "./events-modal";
import { expectConfirmationModal } from "./shared";

// `dashboard-by-name` slugifies titles to sentence-case, so specs that assert
// on rankings need the same transform — `Renamed Event` becomes `Renamed event`.
function dashboardItemSelector(title: string): string {
	return `[data-item-title="${title}"]`;
}

const TIMELINE_CONTAINER_TID = "prisma-timeline-container";
const TIMELINE_ITEM_CLASS = ".prisma-timeline-item";
const HEATMAP_CONTAINER_TID = "prisma-heatmap-container";
const HEATMAP_CELL_TID = "prisma-heatmap-cell";
const DASHBOARD_RANKING_TID = "prisma-dashboard-cell-ranking";

type DashboardGroup = "dashboard-by-name" | "dashboard-by-category";

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

	/**
	 * Create a timed event via the toolbar → modal flow. Returns a handle
	 * pinned to the new path.
	 *
	 * Pass `subdir` when driving a calendar whose bundle writes to a directory
	 * other than the default `Events/` — multi-calendar specs need this so
	 * the snapshot / wait-for-new-file loop looks in the right folder.
	 */
	createEvent(input: EventCreate, options?: { subdir?: string }): Promise<EventHandle>;

	/** Seed N events with auto-generated titles. Stable titles: `<prefix> 1` … `<prefix> N`. */
	seedEvents(count: number, options?: SeedOptions): Promise<EventHandle[]>;

	/** Seed arbitrary-titled events via the UI and drain the success-notice stack. */
	seedMany(inputs: readonly EventCreate[]): Promise<EventHandle[]>;

	/**
	 * Write an event directly to disk (bypassing the create modal) and refresh
	 * the indexer so the plugin picks it up. Prefer this over hand-rolled
	 * `writeFileSync` + `openCalendarReady` sequences — the refresh step is
	 * required for the file to appear in the calendar view.
	 *
	 * Pass `awaitRender: true` to wait for the seeded block to paint in the
	 * active calendar leaf before returning — only safe when the seeded date
	 * is actually inside the currently-visible FC viewport.
	 */
	seedOnDisk(
		title: string,
		frontmatter: Record<string, string | boolean>,
		options?: { awaitRender?: boolean }
	): Promise<EventHandle>;

	/**
	 * Bulk version of `seedOnDisk` for the common "seed N events, assert on
	 * downstream rendering" shape (analytics tabs, stats modals, search, etc.).
	 * Writes every markdown file, then refreshes the indexer **once** at the
	 * end — the singular `seedOnDisk` refreshes per call (~500ms each), so
	 * looping it over N events is wasteful. Input mirrors `seedMany`'s
	 * `{title, start, end, allDay, date, category}` shape so specs don't have
	 * to spell out `"Start Date"` / `"End Date"` frontmatter keys. Richer
	 * fields (prerequisites, participants, recurring, custom properties) still
	 * require the full modal flow — use `seedMany` for those. Duplicate titles
	 * within a single batch are safe — each gets a unique zettel-ID suffix.
	 *
	 * Like `seedOnDisk`, pass `awaitRender: true` to wait for every seeded
	 * tile to paint in the active calendar leaf — only safe when every
	 * seeded date sits inside the currently-visible FC viewport.
	 */
	seedOnDiskMany(events: readonly EventOnDisk[], options?: { awaitRender?: boolean }): Promise<EventHandle[]>;

	/**
	 * Bulk-seed events to disk with a double-refresh to flush reactive trackers
	 * (name series, category, etc.). Use this instead of raw `seedEvent` loops
	 * when the spec opens a modal that reads tracker data (e.g. Event Series Modal).
	 */
	seedAndStabilize(events: readonly SeedEventInput[]): Promise<void>;

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

	/**
	 * Click the toolbar "show-recurring" button and resolve to a handle on the
	 * resulting EventsModal (Recurring / By Category / By Name tabs). Wraps
	 * the toolbar click + modal-visible wait that every analytics spec repeats.
	 */
	openEventsModal(): Promise<EventsModalHandle>;

	/** Switch the analytics view tab. For group tabs use `switchToGroupChild`. */
	switchView(tab: ViewTabKey): Promise<void>;

	/** Drill into a child inside a group tab (e.g. dashboard → dashboard-by-name). */
	switchToGroupChild(group: ViewTabKey, child: ViewTabKey): Promise<void>;

	/** Click the FullCalendar view-mode button (month/week/day/list). */
	switchMode(mode: ViewMode): Promise<void>;

	/**
	 * Navigate the active calendar view to `iso` (`YYYY-MM-DD`) via
	 * FullCalendar's `gotoDate`. Boot-time viewport is whatever FC picks
	 * from `new Date()` at mount — specs that seed relative to a fixed
	 * reference should call this to pin the viewport.
	 */
	goToDate(iso: string): Promise<void>;

	/**
	 * Shorthand for `goToDate(anchorISO())`. Non-recurring specs should call
	 * this after `switchMode(...)` so the rendered week contains the
	 * `fromAnchor(...)` seeds regardless of what day-of-week the suite runs
	 * on — see `docs/specs/e2e-date-anchor-robustness.md`.
	 */
	goToAnchor(): Promise<void>;

	/**
	 * Navigate an embedded FullCalendar (e.g. inside monthly-calendar-stats) to
	 * the anchor month. `goToAnchor()` drives the main calendar component —
	 * this method clicks the embedded calendar's own prev button to reach the
	 * anchor month, then asserts the stats date label updated.
	 *
	 * @param gridCellSelector CSS selector for the grid cell that contains the embedded calendar.
	 */
	goToEmbeddedAnchor(gridCellSelector: string): Promise<void>;

	/** Flip the license to Pro via the `__setProForTesting` seam (guarded by `window.E2E`). */
	unlockPro(): Promise<void>;

	/** Click the untracked-events dropdown toggle in the toolbar. */
	openUntrackedDropdown(): Promise<void>;

	/** Fire a registered Obsidian command via the command palette. */
	runCommand(name: string): Promise<void>;

	/** Wait for the shared confirmation modal and click Confirm. Used by destructive flows. */
	confirmDeletion(): Promise<void>;

	/**
	 * Path of the currently-active workspace file, or `null` if no markdown leaf
	 * is focused. Use with `expect.poll` to assert which file an action opened —
	 * Obsidian's link-open APIs don't bubble through DOM, so workspace state is
	 * the only reliable probe.
	 */
	activeFilePath(): Promise<string | null>;

	/** Assert a timeline item rendering `title` is present (or absent) in the timeline view. */
	expectTimelineItem(title: string, present?: boolean): Promise<void>;

	/** Assert the heatmap cell for `iso` carries `data-count="<count>"`. */
	expectHeatmapCount(iso: string, count: number): Promise<void>;

	/** Assert a dashboard ranking row for `title` is present (or absent) in the active group. */
	expectDashboardItem(group: DashboardGroup, title: string, present?: boolean): Promise<void>;
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

/**
 * Minimal event shape supported by `seedOnDiskMany`. Maps straight onto
 * Prisma's frontmatter keys — nothing goes through the modal or Zod roundtrip.
 * Use `seedMany` (which accepts the full `EventCreate`) for events that need
 * prerequisites, participants, or recurring rules.
 */
export interface EventOnDisk {
	title: string;
	/** Timed start — `YYYY-MM-DDTHH:mm`. Maps to the `Start Date` frontmatter key. */
	start?: string;
	/** Timed end — `YYYY-MM-DDTHH:mm`. Maps to the `End Date` frontmatter key. */
	end?: string;
	/** All-day date — `YYYY-MM-DD`. Maps to the `Date` frontmatter key. */
	date?: string;
	/** Maps to the `All Day` frontmatter key. */
	allDay?: boolean;
	/** Single-category assignment — maps to the `Category` frontmatter key. */
	category?: string;
	/** Multi-category assignment — maps to the `Category` frontmatter key as a YAML list. */
	categories?: string[];
}

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

/**
 * Drive FullCalendar's `gotoDate(iso)` on every registered calendar bundle.
 * Reaches the FC instance through `plugin.calendarBundles[].viewRef.calendarComponent.calendar`
 * — the old `leaf.view.calendar` path broke when the CalendarView was wrapped
 * in a tabbed ComponentView (see `prisma-view.ts`). Throws if no bundle has a
 * live calendar component.
 */
async function navigateCalendarTo(page: Page, iso: string): Promise<void> {
	await page.evaluate(
		({ dateIso, pid }) => {
			const w = window as unknown as {
				app: {
					plugins: {
						plugins: Record<
							string,
							{
								calendarBundles?: Array<{
									viewRef?: {
										calendarComponent?: { calendar?: { gotoDate: (d: string) => void } } | null;
									};
								}>;
							}
						>;
					};
				};
			};
			const bundles = w.app.plugins.plugins[pid]?.calendarBundles ?? [];
			let navigated = false;
			for (const bundle of bundles) {
				const cal = bundle.viewRef?.calendarComponent?.calendar;
				if (cal) {
					cal.gotoDate(dateIso);
					navigated = true;
				}
			}
			if (!navigated) throw new Error("goToDate: no active calendar component to navigate");
		},
		{ dateIso: iso, pid: PLUGIN_ID }
	);
}

export function createCalendarHandle(deps: CalendarHandleDeps): CalendarHandle {
	const page = deps.obsidian.page;
	const vaultDir = deps.obsidian.vaultDir;

	const createEvent: CalendarHandle["createEvent"] = async (input, options = {}) => {
		const subdir = options.subdir ?? "Events";
		const baseline = snapshotEventFiles(vaultDir, subdir);
		await openCreateModal(page);
		await fillEventModal(page, input);
		await saveEventModal(page);
		const [newPath] = await waitForNewEventFiles(vaultDir, baseline, 1, undefined, subdir);
		if (!newPath) throw new Error(`createEvent(${input.title}): no new event file appeared in ${subdir}`);
		return createEventHandle({ page, vaultDir }, newPath, input.title);
	};

	const switchToGroupChild: CalendarHandle["switchToGroupChild"] = async (group, child) => {
		const groupTab = page.locator(sel(TID.viewTab(group))).first();
		await groupTab.waitFor({ state: "visible" });
		await groupTab.click();
		const childTab = page.locator(sel(TID.viewTab(child))).first();
		await childTab.waitFor({ state: "visible" });
		await childTab.click();
	};

	return {
		page,
		vaultDir,

		createEvent,

		async seedEvents(count, options = {}) {
			const prefix = options.prefix ?? "Event";
			const startHour = options.startHour ?? 8;
			const days = options.daysFromToday ?? 0;
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
			return out;
		},

		async seedOnDisk(title, frontmatter, options = {}) {
			const relPath = seedEventFile(vaultDir, title, frontmatter);
			await refreshCalendar(page);
			const handle = createEventHandle({ page, vaultDir }, relPath, title);
			if (options.awaitRender === true) await handle.expectVisible();
			return handle;
		},

		async seedOnDiskMany(events, options = {}) {
			const out: EventHandle[] = [];
			const titleCounts = new Map<string, number>();
			const baseline = await getEventCount(page);
			for (const input of events) {
				const fm: Record<string, string | boolean | string[]> = {};
				if (input.start !== undefined) fm["Start Date"] = input.start;
				if (input.end !== undefined) fm["End Date"] = input.end;
				if (input.date !== undefined) fm["Date"] = input.date;
				if (input.allDay !== undefined) fm["All Day"] = input.allDay;
				if (input.categories !== undefined) fm["Category"] = input.categories;
				else if (input.category !== undefined) fm["Category"] = input.category;
				const count = titleCounts.get(input.title) ?? 0;
				titleCounts.set(input.title, count + 1);
				const suffix = count === 0 ? "" : String(count).padStart(2, "0");
				const relPath = seedEventFile(vaultDir, input.title, fm, suffix);
				out.push(createEventHandle({ page, vaultDir }, relPath, input.title));
			}
			await refreshCalendar(page);
			await waitForEventCount(page, baseline + events.length);
			if (options.awaitRender === true) {
				for (const handle of out) await handle.expectVisible();
			}
			return out;
		},

		async seedAndStabilize(events) {
			const baseline = await getEventCount(page);
			// Build file content from SeedEventInput, then create via Obsidian's
			// vault API so the metadata cache fires events and downstream reactive
			// trackers (name series, category) pick up the new rows. Raw
			// writeFileSync bypasses the cache → trackers stay empty.
			const files = events.map((event) => {
				const subdir = event.subdir ?? "Events";
				const filename = `${event.title.replace(/[/\\:*?"<>|]/g, "-")}.md`;
				const fm: Record<string, unknown> = {};
				if (event.startDate) fm["Start Date"] = event.startDate;
				if (event.endDate) fm["End Date"] = event.endDate;
				if (event.date) fm["Date"] = event.date;
				if (event.allDay) fm["All Day"] = true;
				if (event.category) fm["Category"] = event.category;
				if (event.location) fm["Location"] = event.location;
				if (event.participants?.length) fm["Participants"] = event.participants;
				if (event.rrule) fm["RRule"] = event.rrule;
				if (event.rruleSpec) fm["RRuleSpec"] = event.rruleSpec;
				if (event.extra) {
					for (const [k, v] of Object.entries(event.extra)) fm[k] = v;
				}
				const fmLines = Object.entries(fm)
					.map(([k, v]) => {
						if (Array.isArray(v))
							return v.length === 0 ? `${k}: []` : `${k}:\n${v.map((item) => `  - ${String(item)}`).join("\n")}`;
						if (typeof v === "string" && (v.includes(":") || v.includes("#")))
							return `${k}: "${v.replace(/"/g, '\\"')}"`;
						return `${k}: ${String(v)}`;
					})
					.join("\n");
				return { path: `${subdir}/${filename}`, content: `---\n${fmLines}\n---\n\n# ${event.title}\n` };
			});
			await page.evaluate(async (fileList) => {
				const vault = (window as unknown as { app: { vault: { create: (p: string, c: string) => Promise<unknown> } } })
					.app.vault;
				for (const f of fileList) await vault.create(f.path, f.content);
			}, files);
			await refreshCalendar(page);
			await waitForEventCount(page, baseline + events.length);
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

		async openEventsModal() {
			const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.pageHeader("show-recurring"))}`).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
			const modal = page.locator(".modal").first();
			await modal.waitFor({ state: "visible" });
			return createEventsModalHandle(page, modal);
		},

		async switchView(tab) {
			const el = page.locator(sel(TID.viewTab(tab))).first();
			await el.waitFor({ state: "visible" });
			await el.click();
		},

		switchToGroupChild,

		async switchMode(mode) {
			const btn = page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(TID.toolbar(`view-${mode}`))}`).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},

		async goToDate(iso) {
			await navigateCalendarTo(page, iso);
		},

		async goToAnchor() {
			await navigateCalendarTo(page, anchorISO());
		},

		async goToEmbeddedAnchor(gridCellSelector) {
			const anchor = anchorDate();
			const now = new Date();
			const monthDiff = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth());
			if (monthDiff === 0) return;
			const cell = page.locator(gridCellSelector).first();
			for (let i = 0; i < monthDiff; i++) {
				await cell.locator(".fc-prev-button").click();
			}
			const targetLabel = anchor.toLocaleDateString("en-US", { month: "long", year: "numeric" });
			await expect(page.locator(sel("prisma-stats-date-label")).first()).toHaveText(targetLabel);
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

		async openUntrackedDropdown() {
			const toggle = page.locator(`${ACTIVE_CALENDAR_LEAF} [data-testid="prisma-untracked-dropdown-button"]`).first();
			await toggle.waitFor({ state: "visible" });
			await toggle.click();
		},

		async runCommand(name) {
			await runCommand(page, name);
		},

		async confirmDeletion() {
			const modal = await expectConfirmationModal(page);
			await modal.confirm();
		},

		async activeFilePath() {
			return page.evaluate(() => {
				const w = window as unknown as {
					app: { workspace: { getActiveFile: () => { path: string } | null } };
				};
				return w.app.workspace.getActiveFile()?.path ?? null;
			});
		},

		async expectTimelineItem(title, present = true) {
			const container = page.locator(sel(TIMELINE_CONTAINER_TID)).first();
			await container.waitFor({ state: "visible" });
			const item = container.locator(TIMELINE_ITEM_CLASS).filter({ hasText: title });
			if (present) await expect(item.first()).toBeVisible();
			else await expect(item).toHaveCount(0);
		},

		async expectHeatmapCount(iso, count) {
			const container = page.locator(sel(HEATMAP_CONTAINER_TID)).first();
			await container.waitFor({ state: "visible" });
			const cell = container.locator(`${sel(HEATMAP_CELL_TID)}[data-date="${iso}"]`).first();
			await expect(cell).toHaveAttribute("data-count", String(count));
		},

		async expectDashboardItem(group, title, present = true) {
			await switchToGroupChild("dashboard", group);
			const ranking = page.locator(`${sel(DASHBOARD_RANKING_TID)}:visible`).first();
			const item = ranking.locator(dashboardItemSelector(title));
			if (present) await expect(item).toBeVisible();
			else await expect(item).toHaveCount(0);
		},
	};
}
