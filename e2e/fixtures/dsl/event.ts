import { expect, type Locator, type Page } from "@playwright/test";
import { readEventFrontmatter } from "@real1ty-obsidian-plugins/testing/e2e";

import { listEventFiles } from "../../specs/events/events-helpers";
import type { EventModalInput } from "../../specs/events/fill-event-modal";
import { fillEventModal, saveEventModal } from "../../specs/events/fill-event-modal";
import { ACTIVE_CALENDAR_LEAF } from "../constants";
import { type ContextMenuItemKey, EVENT_BLOCK_TID, sel, TID } from "../testids";

// EventHandle — an on-disk event pinned by vault-relative path, with fluent
// methods for the operations every history / events spec performs: right-
// click → context menu, edit via modal, expect frontmatter, expect existence.
//
// The handle remembers the original path and title from creation. Operations
// that rename the underlying file (title change + zettel regen on redo) are
// out of scope — specs that exercise those paths should drop to the page-level
// helpers. For the common case where the path is stable, this surface
// eliminates the "lookup-file, compare, assert" boilerplate that saturates
// every undo/redo spec.

export interface EventHandle {
	readonly path: string;
	readonly title: string;

	edit(changes: EventModalInput): Promise<void>;
	rightClick(item: ContextMenuItemKey): Promise<void>;

	readFrontmatter<T = unknown>(key: string): T;

	expectExists(yes: boolean): Promise<void>;
	expectFrontmatter(key: string, matcher: (v: unknown) => boolean, message?: string): Promise<void>;
}

interface EventHandleDeps {
	page: Page;
	vaultDir: string;
}

/**
 * Pin an on-disk event to a handle so later calls don't need to rethread path
 * / title / vaultDir. The handle is stateless beyond the stored path — disk
 * reads and DOM operations always re-query.
 */
export function createEventHandle(deps: EventHandleDeps, path: string, title: string): EventHandle {
	const { page, vaultDir } = deps;

	const block = (): Locator =>
		page.locator(`${ACTIVE_CALENDAR_LEAF} ${sel(EVENT_BLOCK_TID)}[data-event-title="${title}"]`).first();

	return {
		path,
		title,

		async edit(changes) {
			await this.rightClick("editEvent");
			await fillEventModal(page, changes);
			await saveEventModal(page);
		},

		async rightClick(item) {
			const el = block();
			await el.waitFor({ state: "visible" });
			await el.click({ button: "right" });
			const menuItem = page.locator(sel(TID.ctxMenu(item))).first();
			await menuItem.waitFor({ state: "visible" });
			await menuItem.click();
		},

		readFrontmatter<T>(key: string): T {
			return readEventFrontmatter(vaultDir, path)[key] as T;
		},

		async expectExists(yes) {
			await expect
				.poll(() => listEventFiles(vaultDir).some((abs) => abs.endsWith(`/${path}`)), {
					message: `${path} existence != ${yes}`,
				})
				.toBe(yes);
		},

		async expectFrontmatter(key, matcher, message) {
			await expect
				.poll(() => matcher(readEventFrontmatter(vaultDir, path)[key]), {
					message: message ?? `frontmatter ${key} did not match in ${path}`,
				})
				.toBe(true);
		},
	};
}
