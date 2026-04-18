import { expect, type Page } from "@playwright/test";
import type { BootstrappedObsidian } from "@real1ty-obsidian-plugins/testing/e2e";

import {
	listEventFiles,
	openCreateModal,
	snapshotEventFiles,
	waitForNewEventFiles,
} from "../../specs/events/events-helpers";
import { type EventModalInput, fillEventModal, saveEventModal } from "../../specs/events/fill-event-modal";
import { runCommand } from "../commands";
import { isoLocal } from "../dates";
import { type BatchHandle, openBatch } from "./batch";
import { createEventHandle, type EventHandle } from "./event";

// CalendarHandle — root of the E2E DSL. Represents "a live calendar view in
// an Obsidian session". Exposes every operation specs currently reach for
// via a grab-bag of page-level helpers: create + seed events, batch, undo /
// redo, disk assertions. Produced by the `calendar` Playwright fixture in
// `electron.ts` after the calendar view is open.
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

	batch(events: readonly EventHandle[]): Promise<BatchHandle>;

	undo(times?: number): Promise<void>;
	redo(times?: number): Promise<void>;

	/** Wait until the on-disk Events/ tree holds exactly `n` files. */
	expectEventCount(n: number): Promise<void>;
}

export interface EventCreate {
	title: string;
	start: string;
	end: string;
	allDay?: boolean;
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

export function createCalendarHandle(deps: CalendarHandleDeps): CalendarHandle {
	const page = deps.obsidian.page;
	const vaultDir = deps.obsidian.vaultDir;

	const createEvent: CalendarHandle["createEvent"] = async (input) => {
		const baseline = snapshotEventFiles(vaultDir);
		await openCreateModal(page);
		await fillEventModal(page, input as EventModalInput);
		await saveEventModal(page);
		const [newPath] = await waitForNewEventFiles(vaultDir, baseline);
		if (!newPath) throw new Error(`createEvent(${input.title}): no new event file appeared`);
		return createEventHandle({ page, vaultDir }, newPath, input.title);
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
	};
}
