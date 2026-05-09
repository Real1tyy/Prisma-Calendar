import { expect, type Locator, type Page } from "@playwright/test";

import { sel } from "../testids";

// Handles for the multi-tab EventsModal (`prisma-cal-toolbar-show-recurring`)
// and the EventSeriesModal it drills into. Both screens are saturated with
// repeating Locator boilerplate (`page.locator(".modal")…first()`, repeated
// SERIES_*_SEL constants, manual `allTextContents().every(...)` checks),
// which the handles collapse so analytics specs can read like a flow:
//
//     const events = await calendar.openEventsModal();
//     await events.switchTab("byCategory");
//     const series = await events.drillInto("Work");
//     await series.expectRowCount(2);
//
// Selectors live here once — every events-modal / series-modal class string
// in spec code is a smell.

const EVENTS_MODAL_BODY = ".prisma-events-modal-content";
const EVENTS_MODAL_GROUP_COUNT = `${EVENTS_MODAL_BODY} .prisma-generic-event-list-count`;
const EVENTS_MODAL_LIST_ITEM = `${EVENTS_MODAL_BODY} .prisma-generic-event-list .prisma-generic-event-list-item`;

const SERIES_MODAL = ".modal.prisma-recurring-events-list-modal";
const SERIES_ROW = ".prisma-recurring-event-row";
const SERIES_TITLE = ".prisma-recurring-event-title";
const SERIES_STATS = ".prisma-recurring-events-stats-text";
const SERIES_TAB_TESTID_PREFIX = "prisma-event-series-tab-";
const SERIES_PAST_ROW_CLASS = "prisma-recurring-event-past";
const SERIES_SKIPPED_ROW_CLASS = "prisma-recurring-event-skipped";
const PICKER_ROW = ".prisma-generic-event-list-item";
const PICKER_HEADING_TEXT = "Select a category";
const SERIES_BACK_BTN = ".prisma-event-series-back-btn";

async function clickWhenVisible(loc: Locator): Promise<void> {
	await loc.waitFor({ state: "visible" });
	await loc.click();
}

export type EventsModalTab = "recurring" | "byCategory" | "byName";
export type EventsModalSortMode = "count-desc" | "count-asc" | "name-asc" | "name-desc";
export type SeriesModalTab = "recurring" | "category" | "name";
export type RecurringTypeFilter =
	| "all"
	| "daily"
	| "bi-daily"
	| "weekdays"
	| "weekends"
	| "weekly"
	| "bi-weekly"
	| "monthly"
	| "bi-monthly"
	| "quarterly"
	| "semi-annual"
	| "yearly"
	| "custom";
export type SeriesBasesView = "table" | "list" | "cards" | "timeline" | "heatmap";

export interface EventsModalHandle {
	readonly modal: Locator;

	/** Click a tab and wait for it to become active. */
	switchTab(tab: EventsModalTab): Promise<void>;

	/** Assert the active tab and (optionally) pin its label text — e.g. `"Recurring (1)"`. */
	expectTabActive(tab: EventsModalTab, label?: string): Promise<void>;

	/** Assert the count chip text (`"2 category groups"`, `"1 event"`, …). */
	expectGroupCountText(text: string): Promise<void>;

	/** Locator for all top-level group items in the active tab. */
	groupItems(): Locator;

	/**
	 * Single group item by its title — uses the `prisma-event-list-item-{title}`
	 * testid stamped by `simple-event-group-list.tsx`. The Recurring tab does
	 * not stamp this testid; use `recurringRow(title)` there instead.
	 */
	groupItem(title: string): Locator;

	/** Locator for the generic list rows (used by the Recurring tab). */
	listRows(): Locator;

	/**
	 * Click a group item by title and resolve to a series-modal handle once
	 * the EventSeriesModal is visible. The drill-in path goes through the
	 * `prisma-event-list-item-{title}` testid.
	 */
	drillInto(title: string): Promise<SeriesModalHandle>;

	/**
	 * Click an already-resolved row locator (Recurring tab uses this — no
	 * per-row testid path) and resolve to the resulting series-modal handle.
	 */
	drillIntoRow(row: Locator): Promise<SeriesModalHandle>;

	/** Type into the events-modal search input (filters group items by title). */
	search(query: string): Promise<void>;

	/** Set the sort dropdown to one of the four supported modes. */
	setSort(mode: EventsModalSortMode): Promise<void>;

	/** Recurring-tab only: set the type filter dropdown. */
	setRecurringTypeFilter(filter: RecurringTypeFilter): Promise<void>;

	/**
	 * Recurring-tab only: toggle the "Show disabled only" checkbox. The toggle
	 * is only rendered when at least one disabled recurring event exists, so
	 * this throws if the toggle isn't visible.
	 */
	toggleShowDisabledOnly(): Promise<void>;

	/** Whether the "Show disabled only" toggle is currently rendered. */
	hasShowDisabledOnlyToggle(): Promise<boolean>;

	/** Locator pinned to a recurring row by its title — uses the testid stamped on the row. */
	recurringRow(title: string): RecurringRowHandle;
}

/** Per-row affordances on the Recurring tab — Category / Nav / Disable. */
export interface RecurringRowHandle {
	readonly row: Locator;

	/** Open the category-assign modal. Caller drives the modal afterwards. */
	clickCategory(): Promise<void>;

	/** Trigger the Nav button — modal closes, calendar navigates to source. */
	clickNav(): Promise<void>;

	/**
	 * Click the disable/enable toggle. Same button regardless of pool — its
	 * label flips between "Disable" and "Enable" based on the active pool.
	 */
	clickToggle(): Promise<void>;

	/** Ctrl/Cmd+click the row to open the source file in a new workspace tab. */
	openInNewTab(): Promise<void>;

	/** Plain click — opens the EventSeriesModal for this recurring source. */
	open(): Promise<SeriesModalHandle>;

	/** Pin the recurrence type stamped on `data-recurring-type`. */
	expectType(type: string): Promise<void>;

	/** Pin the visible badge text (e.g. "Weekly", "Daily", "Custom Interval"). */
	expectBadgeLabel(label: string): Promise<void>;

	/** Pin the "N instance(s)" subtitle. */
	expectInstanceCountText(count: number): Promise<void>;
}

export interface SeriesModalHandle {
	readonly modal: Locator;

	/** All event rows in the series modal. */
	rows(): Locator;

	/** Exact row-count assertion. */
	expectRowCount(n: number): Promise<void>;

	/** Stats-footer assertion: `Total: N`. */
	expectTotal(n: number): Promise<void>;

	/**
	 * Pin specific fields of the primary stats line. Any omitted field is
	 * skipped — useful for asserting only what the spec cares about.
	 */
	expectStats(parts: { total?: number; past?: number; skipped?: number; completedPercent?: number }): Promise<void>;

	/** Pin the recurrence "extra info" banner text (only present on the recurring tab). */
	expectRecurrenceInfo(text: string | RegExp): Promise<void>;

	/** Every visible row's title equals `title`. */
	expectAllTitles(title: string): Promise<void>;

	/** No tab bar rendered — `tabs.length < 2` in `event-series-modal-content.tsx`. */
	expectNoTabBar(): Promise<void>;

	/** Pin a series-modal tab as visible and active (carries `is-active`). */
	expectTabActive(tab: SeriesModalTab): Promise<void>;

	/** Pin a series-modal tab as visible but not active. */
	expectTabInactive(tab: SeriesModalTab): Promise<void>;

	/** Pin the modal root's `--source-category-color` CSS var (set when drilling a colored category). */
	expectCategoryColorVar(color: string): Promise<void>;

	/** A Bases-footer button for `view` is visible. */
	expectBasesAction(view: SeriesBasesView): Promise<void>;

	/** Click a Bases-footer button. Caller drives whatever child modal opens. */
	pickBasesView(view: SeriesBasesView): Promise<void>;

	/** Click the source-title heading — opens the source markdown file. */
	clickTitle(): Promise<void>;

	/** Toggle the "Hide past events" checkbox. */
	toggleHidePast(): Promise<void>;

	/** Toggle the "Hide skipped events" checkbox. */
	toggleHideSkipped(): Promise<void>;

	/** Type into the per-tab search input (only rendered on tabs that pass `showSearch`). */
	search(query: string): Promise<void>;

	/** Pin a row by its zero-based index in the rendered list (post-filter, post-sort). */
	row(index: number): SeriesRowHandle;

	/** Pin a row by its `data-event-date` (`YYYY-MM-DD`). */
	rowByDate(iso: string): SeriesRowHandle;

	/** Assert no row exists for the given `data-event-date`. */
	expectRowAbsent(iso: string): Promise<void>;

	/** Visible row titles in document order — useful when asserting a `startsWith` set. */
	titles(): Promise<string[]>;

	/** Locator for picker rows shown when a multi-category event drills in. */
	pickerRows(): Locator;

	/** Assert the picker heading ("Select a category") is visible. */
	expectPickerVisible(): Promise<void>;

	/** Multi-category picker: click the option for `value`. */
	pickCategory(value: string): Promise<void>;

	/** "← Back to categories" returns to the picker. */
	backToCategories(): Promise<void>;
}

/** Per-row affordances inside the EventSeriesModal — past/skipped probes, click-to-open. */
export interface SeriesRowHandle {
	readonly row: Locator;

	/** Click the row to open its underlying file. */
	click(): Promise<void>;

	/** Assert the row carries (or does not carry) the `prisma-recurring-event-past` class. */
	expectPast(yes?: boolean): Promise<void>;

	/** Assert the row carries (or does not carry) the `prisma-recurring-event-skipped` class. */
	expectSkipped(yes?: boolean): Promise<void>;

	/** Pin the row's `data-event-file-path` attribute. */
	expectFilePath(path: string | RegExp): Promise<void>;

	/** Pin the row's title text. */
	expectTitle(title: string): Promise<void>;
}

export function createEventsModalHandle(page: Page, modal: Locator): EventsModalHandle {
	const groupItem = (title: string): Locator => page.locator(sel(`prisma-event-list-item-${title}`)).first();

	const drillIntoLocator = async (target: Locator): Promise<SeriesModalHandle> => {
		await clickWhenVisible(target);
		const seriesModal = page.locator(SERIES_MODAL).first();
		await expect(seriesModal).toBeVisible();
		return createSeriesModalHandle(page, seriesModal);
	};

	const showDisabledToggle = (): Locator => page.locator(sel("prisma-recurring-show-disabled")).first();

	return {
		modal,

		async switchTab(tab) {
			const button = page.locator(sel(`prisma-events-modal-tab-${tab}`)).first();
			await clickWhenVisible(button);
			await expect(button).toHaveClass(/is-active/);
		},

		async expectTabActive(tab, label) {
			const button = page.locator(sel(`prisma-events-modal-tab-${tab}`)).first();
			await expect(button).toHaveClass(/is-active/);
			if (label !== undefined) await expect(button).toContainText(label);
		},

		async expectGroupCountText(text) {
			await expect(page.locator(EVENTS_MODAL_GROUP_COUNT).first()).toHaveText(text);
		},

		groupItems() {
			return page.locator('[data-testid^="prisma-event-list-item-"]');
		},

		groupItem,

		listRows() {
			return page.locator(EVENTS_MODAL_LIST_ITEM);
		},

		async drillInto(title) {
			return drillIntoLocator(groupItem(title));
		},

		async drillIntoRow(row) {
			return drillIntoLocator(row);
		},

		async search(query) {
			const input = page.locator(sel("prisma-events-modal-search")).first();
			await input.waitFor({ state: "visible" });
			await input.fill(query);
		},

		async setSort(mode) {
			const select = page.locator(sel("prisma-events-modal-sort")).first();
			await select.waitFor({ state: "visible" });
			await select.selectOption(mode);
		},

		async setRecurringTypeFilter(filter) {
			const select = page.locator(sel("prisma-recurring-type-filter")).first();
			await select.waitFor({ state: "visible" });
			await select.selectOption(filter);
		},

		async toggleShowDisabledOnly() {
			await clickWhenVisible(showDisabledToggle());
		},

		async hasShowDisabledOnlyToggle() {
			return (await showDisabledToggle().count()) > 0;
		},

		recurringRow(title) {
			const row = page.locator(sel(`prisma-recurring-row-${title}`)).first();
			return createRecurringRowHandle(page, row);
		},
	};
}

function createRecurringRowHandle(page: Page, row: Locator): RecurringRowHandle {
	const buttonByAction = (action: "category" | "nav" | "toggle"): Locator =>
		row.locator(sel(`prisma-recurring-row-${action}`)).first();

	return {
		row,

		async clickCategory() {
			await clickWhenVisible(buttonByAction("category"));
		},

		async clickNav() {
			await clickWhenVisible(buttonByAction("nav"));
		},

		async clickToggle() {
			await clickWhenVisible(buttonByAction("toggle"));
		},

		async openInNewTab() {
			await row.waitFor({ state: "visible" });
			const modifier = process.platform === "darwin" ? "Meta" : "Control";
			await row.click({ modifiers: [modifier] });
		},

		async open() {
			await clickWhenVisible(row);
			const seriesModal = page.locator(SERIES_MODAL).first();
			await expect(seriesModal).toBeVisible();
			return createSeriesModalHandle(page, seriesModal);
		},

		async expectType(type) {
			await expect(row).toHaveAttribute("data-recurring-type", type);
		},

		async expectBadgeLabel(label) {
			await expect(row.locator(sel("prisma-recurring-type-badge")).first()).toHaveText(label);
		},

		async expectInstanceCountText(count) {
			const subtitle = row.locator(".prisma-generic-event-subtitle").first();
			await expect(subtitle).toHaveText(`${count} instance${count === 1 ? "" : "s"}`);
		},
	};
}

/**
 * Pin a `SeriesModalHandle` to whichever EventSeriesModal is currently open.
 * Use this when the modal was spawned by something other than
 * `EventsModalHandle.drillInto` — e.g. a context-menu shortcut
 * (`viewNameSeries` / `viewCategorySeries` / `viewRecurringSeries`).
 */
export async function expectSeriesModalOpen(page: Page): Promise<SeriesModalHandle> {
	const modal = page.locator(SERIES_MODAL).first();
	await expect(modal).toBeVisible();
	return createSeriesModalHandle(page, modal);
}

export function createSeriesModalHandle(page: Page, modal: Locator): SeriesModalHandle {
	const rows = (): Locator => modal.locator(SERIES_ROW);

	return {
		modal,

		rows,

		async expectRowCount(n) {
			await expect(rows()).toHaveCount(n);
		},

		async expectTotal(n) {
			await expect(modal.locator(SERIES_STATS).first()).toContainText(`Total: ${n}`);
		},

		async expectStats(parts) {
			const stats = modal.locator(sel("prisma-series-stats-primary")).first();
			await expect(stats).toBeVisible();
			if (parts.total !== undefined) await expect(stats).toContainText(`Total: ${parts.total}`);
			if (parts.past !== undefined) await expect(stats).toContainText(`Past: ${parts.past}`);
			if (parts.skipped !== undefined) await expect(stats).toContainText(`Skipped: ${parts.skipped}`);
			if (parts.completedPercent !== undefined)
				await expect(stats).toContainText(`Completed: ${parts.completedPercent}%`);
		},

		async expectRecurrenceInfo(text) {
			const banner = modal.locator(".prisma-recurring-events-info-text").first();
			await expect(banner).toBeVisible();
			if (typeof text === "string") await expect(banner).toContainText(text);
			else await expect(banner).toHaveText(text);
		},

		async expectAllTitles(title) {
			const titles = await modal.locator(SERIES_TITLE).allTextContents();
			expect(titles.every((t) => t === title)).toBe(true);
		},

		async expectNoTabBar() {
			await expect(modal.locator(`[data-testid^="${SERIES_TAB_TESTID_PREFIX}"]`)).toHaveCount(0);
		},

		async expectTabActive(tab) {
			const button = modal.locator(sel(`${SERIES_TAB_TESTID_PREFIX}${tab}`)).first();
			await expect(button).toBeVisible();
			await expect(button).toHaveClass(/is-active/);
		},

		async expectTabInactive(tab) {
			const button = modal.locator(sel(`${SERIES_TAB_TESTID_PREFIX}${tab}`)).first();
			await expect(button).toBeVisible();
			await expect(button).not.toHaveClass(/is-active/);
		},

		async expectCategoryColorVar(color) {
			const actual = await modal.evaluate((el) =>
				(el as HTMLElement).style.getPropertyValue("--source-category-color").trim()
			);
			expect(actual).toBe(color);
		},

		async expectBasesAction(view) {
			await expect(modal.locator(sel(`prisma-event-series-bases-${view}`)).first()).toBeVisible();
		},

		async pickBasesView(view) {
			await clickWhenVisible(modal.locator(sel(`prisma-event-series-bases-${view}`)).first());
		},

		async clickTitle() {
			await clickWhenVisible(modal.locator(sel("prisma-series-title")).first());
		},

		async toggleHidePast() {
			await clickWhenVisible(modal.locator(sel("prisma-series-hide-past")).first());
		},

		async toggleHideSkipped() {
			await clickWhenVisible(modal.locator(sel("prisma-series-hide-skipped")).first());
		},

		async search(query) {
			const input = modal.locator(sel("prisma-series-search")).first();
			await input.waitFor({ state: "visible" });
			await input.fill(query);
		},

		row(index) {
			return createSeriesRowHandle(rows().nth(index));
		},

		rowByDate(iso) {
			return createSeriesRowHandle(modal.locator(`${SERIES_ROW}[data-event-date="${iso}"]`).first());
		},

		async expectRowAbsent(iso) {
			await expect(modal.locator(`${SERIES_ROW}[data-event-date="${iso}"]`)).toHaveCount(0);
		},

		async titles() {
			return modal.locator(SERIES_TITLE).allTextContents();
		},

		pickerRows() {
			return modal.locator(PICKER_ROW);
		},

		async expectPickerVisible() {
			await expect(modal.locator("h3", { hasText: PICKER_HEADING_TEXT })).toBeVisible();
		},

		async pickCategory(value) {
			const item = modal.locator(`${PICKER_ROW}:has(.prisma-generic-event-title:text-is("${value}"))`).first();
			await clickWhenVisible(item);
		},

		async backToCategories() {
			await clickWhenVisible(modal.locator(SERIES_BACK_BTN).first());
		},
	};
}

function createSeriesRowHandle(row: Locator): SeriesRowHandle {
	return {
		row,

		async click() {
			await clickWhenVisible(row);
		},

		async expectPast(yes = true) {
			const matcher = new RegExp(`(?:^|\\s)${SERIES_PAST_ROW_CLASS}(?:\\s|$)`);
			if (yes) await expect(row).toHaveClass(matcher);
			else await expect(row).not.toHaveClass(matcher);
		},

		async expectSkipped(yes = true) {
			await expect(row).toHaveAttribute("data-event-skipped", yes ? "true" : "false");
			const titleMatcher = new RegExp(`(?:^|\\s)${SERIES_SKIPPED_ROW_CLASS}(?:\\s|$)`);
			const title = row.locator(SERIES_TITLE).first();
			if (yes) await expect(title).toHaveClass(titleMatcher);
			else await expect(title).not.toHaveClass(titleMatcher);
		},

		async expectFilePath(path) {
			await expect(row).toHaveAttribute("data-event-file-path", path);
		},

		async expectTitle(title) {
			await expect(row.locator(SERIES_TITLE).first()).toHaveText(title);
		},
	};
}
