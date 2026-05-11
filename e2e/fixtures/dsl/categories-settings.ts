import { type Locator, type Page } from "@playwright/test";

import {
	CATEGORY_COUNT_CLASS,
	CATEGORY_DELETE_BTN_TID,
	CATEGORY_DELETE_PREFIX,
	CATEGORY_INCLUDE_UNTRACKED_TOGGLE_TID,
	CATEGORY_RENAME_BTN_TID,
	CATEGORY_RENAME_PREFIX,
	CATEGORY_ROW_TID,
	sel,
} from "../testids";
import {
	type ConfirmationModalHandle,
	expectConfirmationModal,
	expectRenameModal,
	type RenameModalHandle,
} from "./shared";

export interface CategoryRowHandle {
	readonly row: Locator;
	countText(): Promise<string>;
	openRename(): Promise<CategoryRenameModalHandle>;
	openDelete(): Promise<CategoryDeleteModalHandle>;
}

export interface CategoryRenameModalHandle extends RenameModalHandle {
	readonly toggleUntracked: Locator;
	setIncludeUntracked(checked: boolean): Promise<void>;
}

export interface CategoryDeleteModalHandle extends ConfirmationModalHandle {
	readonly toggleUntracked: Locator;
	setIncludeUntracked(checked: boolean): Promise<void>;
}

export function categoryRow(page: Page, category: string): CategoryRowHandle {
	const row = page.locator(`${sel(CATEGORY_ROW_TID)}[data-category="${category}"]`);
	const includeUntrackedLocator = page.locator(sel(CATEGORY_INCLUDE_UNTRACKED_TOGGLE_TID));

	return {
		row,
		async countText() {
			await row.waitFor({ state: "visible" });
			return (await row.locator(`.${CATEGORY_COUNT_CLASS}`).textContent()) ?? "";
		},
		async openRename() {
			await row.waitFor({ state: "visible" });
			await row.locator(sel(CATEGORY_RENAME_BTN_TID)).click();
			const modal = await expectRenameModal(page, { testIdPrefix: CATEGORY_RENAME_PREFIX });
			return decorateUntracked(modal, includeUntrackedLocator);
		},
		async openDelete() {
			await row.waitFor({ state: "visible" });
			await row.locator(sel(CATEGORY_DELETE_BTN_TID)).click();
			const modal = await expectConfirmationModal(page, { testIdPrefix: CATEGORY_DELETE_PREFIX });
			return decorateUntracked(modal, includeUntrackedLocator);
		},
	};
}

function decorateUntracked<T extends object>(
	modal: T,
	toggleUntracked: Locator
): T & {
	readonly toggleUntracked: Locator;
	setIncludeUntracked(checked: boolean): Promise<void>;
} {
	return {
		...modal,
		toggleUntracked,
		async setIncludeUntracked(checked: boolean) {
			if (checked) await toggleUntracked.check();
			else await toggleUntracked.uncheck();
		},
	};
}
