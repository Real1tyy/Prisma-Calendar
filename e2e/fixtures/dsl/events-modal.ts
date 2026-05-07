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

export type EventsModalTab = "recurring" | "byCategory" | "byName";
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
	 * not stamp this testid; use `firstListRow()` there instead.
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
	 * per-row testid) and resolve to the resulting series-modal handle.
	 */
	drillIntoRow(row: Locator): Promise<SeriesModalHandle>;
}

export interface SeriesModalHandle {
	readonly modal: Locator;

	/** All event rows in the series modal. */
	rows(): Locator;

	/** Exact row-count assertion. */
	expectRowCount(n: number): Promise<void>;

	/** Stats-footer assertion: `Total: N`. */
	expectTotal(n: number): Promise<void>;

	/** Every visible row's title equals `title`. */
	expectAllTitles(title: string): Promise<void>;

	/** No tab bar rendered — `tabs.length < 2` in `event-series-modal-content.tsx`. */
	expectNoTabBar(): Promise<void>;

	/** A Bases-footer button for `view` is visible. */
	expectBasesAction(view: SeriesBasesView): Promise<void>;

	/** Click a Bases-footer button. Caller drives whatever child modal opens. */
	pickBasesView(view: SeriesBasesView): Promise<void>;
}

export function createEventsModalHandle(page: Page, modal: Locator): EventsModalHandle {
	const groupItem = (title: string): Locator => page.locator(sel(`prisma-event-list-item-${title}`)).first();

	const drillIntoLocator = async (target: Locator): Promise<SeriesModalHandle> => {
		await target.waitFor({ state: "visible" });
		await target.click();
		const seriesModal = page.locator(SERIES_MODAL).first();
		await expect(seriesModal).toBeVisible();
		return createSeriesModalHandle(page, seriesModal);
	};

	return {
		modal,

		async switchTab(tab) {
			const button = page.locator(sel(`prisma-events-modal-tab-${tab}`)).first();
			await button.waitFor({ state: "visible" });
			await button.click();
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
	};
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

		async expectAllTitles(title) {
			const titles = await modal.locator(SERIES_TITLE).allTextContents();
			expect(titles.every((t) => t === title)).toBe(true);
		},

		async expectNoTabBar() {
			await expect(modal.locator(`[data-testid^="${SERIES_TAB_TESTID_PREFIX}"]`)).toHaveCount(0);
		},

		async expectBasesAction(view) {
			await expect(modal.locator(sel(`prisma-event-series-bases-${view}`)).first()).toBeVisible();
		},

		async pickBasesView(view) {
			const btn = modal.locator(sel(`prisma-event-series-bases-${view}`)).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},
	};
}
