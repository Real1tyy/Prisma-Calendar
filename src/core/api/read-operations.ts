import type CustomCalendarPlugin from "../../main";
import type { CalendarBundle } from "../calendar-bundle";
import { resolveBundle } from "./bundle-resolver";
import {
	serializeEvent,
	type PrismaCalendarIdInput,
	type PrismaCategoryOutput,
	type PrismaEventOutput,
	type PrismaFilePathInput,
	type PrismaGetEventsInput,
} from "./types";

export async function getEvents(
	plugin: CustomCalendarPlugin,
	input: PrismaGetEventsInput
): Promise<PrismaEventOutput[]> {
	const bundle = resolveBundle(plugin, input.calendarId);
	if (!bundle) return [];
	const events = await bundle.eventStore.getEvents({ start: input.start, end: input.end });
	return events.map(serializeEvent);
}

export function getEventByPath(plugin: CustomCalendarPlugin, input: PrismaFilePathInput): PrismaEventOutput | null {
	const bundle = resolveBundle(plugin, input.calendarId);
	if (!bundle) return null;

	const event = bundle.eventStore.getEventByPath(input.filePath);
	if (event) return serializeEvent(event);

	const untracked = bundle.untrackedEventStore.getEventByPath(input.filePath);
	if (untracked) return serializeEvent(untracked);

	return null;
}

export function getAllEvents(plugin: CustomCalendarPlugin, input?: PrismaCalendarIdInput): PrismaEventOutput[] {
	const bundle = resolveBundle(plugin, input?.calendarId);
	if (!bundle) return [];
	const tracked = bundle.eventStore.getAllEvents().map(serializeEvent);
	const untracked = bundle.untrackedEventStore.getUntrackedEvents().map(serializeEvent);
	return [...tracked, ...untracked];
}

export function getCategories(plugin: CustomCalendarPlugin, input?: PrismaCalendarIdInput): PrismaCategoryOutput[] {
	const bundle = resolveBundle(plugin, input?.calendarId);
	if (!bundle) return [];
	return bundle.categoryTracker.getCategoriesWithColors().map((c) => ({
		name: c.name,
		color: c.color,
	}));
}

export function getUntrackedEvents(plugin: CustomCalendarPlugin, input?: PrismaCalendarIdInput): PrismaEventOutput[] {
	const bundle = resolveBundle(plugin, input?.calendarId);
	if (!bundle) return [];
	return bundle.untrackedEventStore.getUntrackedEvents().map(serializeEvent);
}

/**
 * Picks which calendar's history to undo/redo against. Each calendar owns its
 * own command stack, so "undo" must target the calendar the user last acted in
 * — not whichever calendar is "last used" for creation. Moving an event between
 * planning systems records the command on the SOURCE calendar but flips the
 * last-used calendar to the destination; resolving by last-used alone would hit
 * the destination's empty stack and report "Nothing to undo". We resolve by the
 * most recently mutated stack instead, tie-breaking toward the last-used one.
 */
function resolveHistoryBundle(
	plugin: CustomCalendarPlugin,
	canApply: (bundle: CalendarBundle) => boolean
): CalendarBundle | null {
	const candidates = plugin.calendarBundles.filter(canApply);
	if (candidates.length === 0) return null;
	if (candidates.length === 1) return candidates[0];

	const lastUsedId = plugin.lastUsedCalendarId;
	return candidates.reduce((best, bundle) => {
		const order = bundle.commandManager.lastActivityOrder;
		const bestOrder = best.commandManager.lastActivityOrder;
		if (order !== bestOrder) return order > bestOrder ? bundle : best;
		return bundle.calendarId === lastUsedId ? bundle : best;
	});
}

export async function undo(plugin: CustomCalendarPlugin): Promise<boolean> {
	const bundle = resolveHistoryBundle(plugin, (b) => b.commandManager.canUndo());
	if (!bundle) return false;
	return await bundle.undo();
}

export async function redo(plugin: CustomCalendarPlugin): Promise<boolean> {
	const bundle = resolveHistoryBundle(plugin, (b) => b.commandManager.canRedo());
	if (!bundle) return false;
	return await bundle.redo();
}
