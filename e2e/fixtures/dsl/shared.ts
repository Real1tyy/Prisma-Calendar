import { expect, type Locator, type Page } from "@playwright/test";

import {
	ACTION_MANAGER_MODAL,
	ACTION_MANAGER_RESET_BTN,
	ASSIGN_MODAL_ROOT,
	CONFIRMATION_MODAL_CANCEL_TID,
	CONFIRMATION_MODAL_CONFIRM_TID,
	CONFIRMATION_MODAL_TID,
	ITEM_MANAGER_MODAL,
	ITEM_MANAGER_RESET_BTN,
	PAGE_HEADER_MANAGE_BTN,
	PROGRESS_DETAILS_TID,
	PROGRESS_MODAL_TID,
	PROGRESS_STATUS_TID,
	RENAME_CANCEL_TID,
	RENAME_INPUT_TID,
	RENAME_MODAL_TID,
	RENAME_SUBMIT_TID,
	RESET_CONFIRMATION_TID_PREFIX,
	sel,
	SHARED_ROW_PREFIX,
	sharedTID,
	TAB_MANAGER_MODAL,
	TAB_MANAGER_RESET_BTN,
	TABBED_CONTAINER_MANAGE_BTN,
} from "../testids";

// Handles for shared-library components (page-header action-manager,
// tabbed-container tab-manager, context-menu item-manager, assignment picker,
// confirmation modal, progress modal, collapsible section).
//
// These wrap the raw testids exposed by `shared/` so specs don't need to
// remember modal names or row-id conventions. Each handle represents "a
// modal/component that is currently on screen"; specs construct one via the
// corresponding `open...` function.

// ── Page header: action manager ────────────────────────────────────────────

export interface ActionManagerHandle {
	readonly modal: Locator;
	/** Reset-to-defaults button at the top of the modal. */
	readonly resetBtn: Locator;
	/** Row for an action id (e.g. `create-event`). */
	row(id: string): Locator;
	/** Click the chevron-up for `id` to move it one position up. */
	moveUp(id: string): Promise<void>;
	/** Click the visibility toggle for `id`. */
	toggle(id: string): Promise<void>;
	/** Click the Reset-to-defaults button (does NOT confirm — caller drives confirmation modal). */
	clickReset(): Promise<void>;
	/** Dismiss via Escape and wait for the modal to unmount. */
	close(): Promise<void>;
}

/** Open the page-header action manager modal. Requires a calendar view visible. */
export async function openActionManager(page: Page): Promise<ActionManagerHandle> {
	const manageBtn = page.locator(sel(PAGE_HEADER_MANAGE_BTN)).first();
	await manageBtn.waitFor({ state: "visible" });
	await manageBtn.click();
	const modal = page.locator(sel(ACTION_MANAGER_MODAL));
	await modal.waitFor({ state: "visible" });
	const resetBtn = modal.locator(sel(ACTION_MANAGER_RESET_BTN)).first();

	return {
		modal,
		resetBtn,
		row: (id) => modal.locator(sel(sharedTID.actionRow(id))).first(),
		async moveUp(id) {
			const btn = page.locator(sel(sharedTID.actionUp(id))).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},
		async toggle(id) {
			const btn = page.locator(sel(sharedTID.actionToggle(id))).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},
		async clickReset() {
			await resetBtn.waitFor({ state: "visible" });
			await resetBtn.click();
		},
		async close() {
			await page.keyboard.press("Escape");
			await modal.waitFor({ state: "hidden" });
		},
	};
}

// ── Tabbed container: tab manager ───────────────────────────────────────────

export interface TabManagerHandle {
	readonly modal: Locator;
	readonly resetBtn: Locator;
	moveUp(id: string): Promise<void>;
	toggle(id: string): Promise<void>;
	rename(id: string): Promise<void>;
	clickReset(): Promise<void>;
	close(): Promise<void>;
}

export async function openTabManager(page: Page): Promise<TabManagerHandle> {
	const manageBtn = page.locator(sel(TABBED_CONTAINER_MANAGE_BTN)).first();
	await manageBtn.waitFor({ state: "visible" });
	await manageBtn.click();
	const modal = page.locator(sel(TAB_MANAGER_MODAL));
	await modal.waitFor({ state: "visible" });
	const resetBtn = modal.locator(sel(TAB_MANAGER_RESET_BTN)).first();

	return {
		modal,
		resetBtn,
		async moveUp(id) {
			const srcRow = modal.locator(sel(sharedTID.tabManagerRow(id))).first();
			await srcRow.waitFor({ state: "visible" });
			const allRows = modal.locator(`[data-testid^="${SHARED_ROW_PREFIX.tabManagerRow}"]`);
			const count = await allRows.count();
			let targetRow: typeof srcRow | null = null;
			for (let i = 1; i < count; i++) {
				const row = allRows.nth(i);
				const tid = await row.getAttribute("data-testid");
				if (tid === `${SHARED_ROW_PREFIX.tabManagerRow}${id}`) {
					targetRow = allRows.nth(i - 1);
					break;
				}
			}
			if (!targetRow) throw new Error(`moveUp: cannot find row above ${id}`);
			await srcRow.dragTo(targetRow);
		},
		async toggle(id) {
			const btn = page.locator(sel(sharedTID.tabManagerToggle(id))).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},
		async rename(id) {
			const editBtn = page.locator(sel(sharedTID.tabManagerEdit(id))).first();
			await editBtn.waitFor({ state: "visible" });
			await editBtn.click();
		},
		async clickReset() {
			await resetBtn.waitFor({ state: "visible" });
			await resetBtn.click();
		},
		async close() {
			await page.keyboard.press("Escape");
			await modal.waitFor({ state: "hidden" });
		},
	};
}

// ── Context-menu item manager ───────────────────────────────────────────────

export interface ItemManagerHandle {
	readonly modal: Locator;
	readonly resetBtn: Locator;
	toggle(id: string): Promise<void>;
	clickReset(): Promise<void>;
	close(): Promise<void>;
}

/**
 * Assumes the context menu is already open and the caller will click the
 * `__manage` entry to reach the manager. Returns a handle for interacting with
 * the modal rows.
 */
export async function expectItemManagerOpen(page: Page): Promise<ItemManagerHandle> {
	const modal = page.locator(sel(ITEM_MANAGER_MODAL));
	await modal.waitFor({ state: "visible" });
	const resetBtn = modal.locator(sel(ITEM_MANAGER_RESET_BTN)).first();
	return {
		modal,
		resetBtn,
		async toggle(id) {
			const btn = modal.locator(sel(sharedTID.itemManagerToggle(id))).first();
			await btn.waitFor({ state: "visible" });
			await btn.click();
		},
		async clickReset() {
			await resetBtn.waitFor({ state: "visible" });
			await resetBtn.click();
		},
		async close() {
			await page.keyboard.press("Escape");
			await modal.waitFor({ state: "hidden" });
		},
	};
}

// ── Confirmation modal ──────────────────────────────────────────────────────

export interface ConfirmationModalHandle {
	readonly root: Locator;
	readonly confirmBtn: Locator;
	readonly cancelBtn: Locator;
	confirm(): Promise<void>;
	cancel(): Promise<void>;
}

/**
 * Wait for the shared confirmation modal to appear and return a handle.
 *
 * Pass `testIdPrefix` for prefixed instances (e.g. `"prisma-delete-recurring-"`
 * for the recurring-delete modal opened via `openConfirmation({ testIdPrefix })`)
 * — the prefix is concatenated with the standard `confirmation-modal-*` suffixes.
 */
export async function expectConfirmationModal(
	page: Page,
	options: { testIdPrefix?: string } = {}
): Promise<ConfirmationModalHandle> {
	const prefix = options.testIdPrefix ?? "";
	const root = page.locator(sel(`${prefix}${CONFIRMATION_MODAL_TID}`)).first();
	await root.waitFor({ state: "visible" });
	const confirmBtn = root.locator(sel(`${prefix}${CONFIRMATION_MODAL_CONFIRM_TID}`));
	const cancelBtn = root.locator(sel(`${prefix}${CONFIRMATION_MODAL_CANCEL_TID}`));
	return {
		root,
		confirmBtn,
		cancelBtn,
		async confirm() {
			await confirmBtn.click();
			await root.waitFor({ state: "detached" });
		},
		async cancel() {
			await cancelBtn.click();
			await root.waitFor({ state: "detached" });
		},
	};
}

// ── Rename modal ────────────────────────────────────────────────────────────

export interface RenameModalHandle {
	readonly root: Locator;
	readonly input: Locator;
	readonly submitBtn: Locator;
	readonly cancelBtn: Locator;
	fill(value: string): Promise<void>;
	submit(): Promise<void>;
	cancel(): Promise<void>;
}

/**
 * Wait for the shared rename modal to appear and return a handle.
 *
 * Pass `testIdPrefix` for prefixed instances (e.g. `"prisma-category-"` for the
 * category rename modal opened via `openRenameModal({ testIdPrefix })`) — the
 * prefix is concatenated with the standard `rename-*` suffixes.
 */
export async function expectRenameModal(
	page: Page,
	options: { testIdPrefix?: string } = {}
): Promise<RenameModalHandle> {
	const prefix = options.testIdPrefix ?? "";
	const root = page.locator(sel(`${prefix}${RENAME_MODAL_TID}`)).first();
	await root.waitFor({ state: "visible" });
	const input = page.locator(sel(`${prefix}${RENAME_INPUT_TID}`));
	const submitBtn = page.locator(sel(`${prefix}${RENAME_SUBMIT_TID}`));
	const cancelBtn = page.locator(sel(`${prefix}${RENAME_CANCEL_TID}`));
	return {
		root,
		input,
		submitBtn,
		cancelBtn,
		async fill(value) {
			await input.fill(value);
		},
		async submit() {
			await submitBtn.click();
			await root.waitFor({ state: "detached" });
		},
		async cancel() {
			await cancelBtn.click();
			await root.waitFor({ state: "detached" });
		},
	};
}

// ── Progress modal ──────────────────────────────────────────────────────────

export interface ProgressModalHandle {
	readonly modal: Locator;
	readonly status: Locator;
	readonly details: Locator;
	/** Wait for the modal to auto-close on success (via `successCloseDelay`). */
	waitForClose(): Promise<void>;
}

export async function expectProgressModal(page: Page): Promise<ProgressModalHandle> {
	const modal = page.locator(sel(PROGRESS_MODAL_TID)).first();
	await modal.waitFor({ state: "visible" });
	return {
		modal,
		status: page.locator(sel(PROGRESS_STATUS_TID)).first(),
		details: page.locator(sel(PROGRESS_DETAILS_TID)).first(),
		async waitForClose() {
			await modal.waitFor({ state: "detached" });
		},
	};
}

// ── Assignment picker (categories / prerequisites) ──────────────────────────

export interface AssignmentModalHandle {
	readonly modal: Locator;
	pick(value: string, options?: { createIfMissing?: boolean }): Promise<void>;
	submit(): Promise<void>;
}

/**
 * Wait for the shared assignment picker (categories / prerequisites /
 * Bases search) to appear and return a handle. The caller is expected to have
 * just clicked the button that opens it (Assign Categories, etc.).
 */
export async function expectAssignmentModal(page: Page): Promise<AssignmentModalHandle> {
	const modal = page.locator(ASSIGN_MODAL_ROOT).first();
	await modal.locator(sel(sharedTID.assignSearch())).waitFor({ state: "visible" });

	return {
		modal,
		async pick(value, options = {}) {
			const createIfMissing = options.createIfMissing ?? true;
			const search = modal.locator(sel(sharedTID.assignSearch()));
			await search.fill(value);
			const existing = modal.locator(`${sel(sharedTID.assignItem())}[data-assign-name="${value}"]`).first();
			if ((await existing.count()) > 0) {
				await existing.click();
			} else if (createIfMissing) {
				const create = modal.locator(sel(sharedTID.assignCreateNew())).first();
				await create.waitFor({ state: "visible" });
				await create.click();
			} else {
				throw new Error(`assignment modal: "${value}" not found and createIfMissing is false`);
			}
			await search.fill("");
		},
		async submit() {
			await modal.locator(sel(sharedTID.assignSubmit())).click();
			await modal.waitFor({ state: "hidden" });
		},
	};
}

// ── Collapsible section ─────────────────────────────────────────────────────

export interface CollapsibleSectionHandle {
	readonly header: Locator;
	readonly body: Locator;
	readonly toggle: Locator;
	isExpanded(): Promise<boolean>;
	expand(): Promise<void>;
	collapse(): Promise<void>;
	expectExpanded(yes: boolean): Promise<void>;
}

/** Handle on a shared `renderCollapsibleSection` instance identified by `id`. */
export function collapsibleSection(page: Page, id: string): CollapsibleSectionHandle {
	const header = page.locator(sel(sharedTID.collapsibleHeader(id))).first();
	const body = page.locator(sel(sharedTID.collapsibleBody(id))).first();
	const toggle = page.locator(sel(sharedTID.collapsibleToggle(id))).first();

	const isExpanded = async (): Promise<boolean> => {
		const cls = (await body.getAttribute("class")) ?? "";
		return !cls.includes("prisma-collapsible-hidden");
	};

	return {
		header,
		body,
		toggle,
		isExpanded,
		async expand() {
			if (!(await isExpanded())) await header.click();
		},
		async collapse() {
			if (await isExpanded()) await header.click();
		},
		async expectExpanded(yes) {
			await expect.poll(isExpanded).toBe(yes);
		},
	};
}
