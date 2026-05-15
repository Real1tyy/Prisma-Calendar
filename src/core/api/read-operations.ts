import type CustomCalendarPlugin from "../../main";
import { resolveBundle } from "./bundle-resolver";
import {
	type PrismaCalendarIdInput,
	type PrismaCategoryOutput,
	type PrismaEventOutput,
	type PrismaFilePathInput,
	type PrismaGetEventsInput,
	serializeEvent,
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

export async function undo(plugin: CustomCalendarPlugin): Promise<boolean> {
	const bundle = resolveBundle(plugin);
	if (!bundle) return false;
	return await bundle.undo();
}

export async function redo(plugin: CustomCalendarPlugin): Promise<boolean> {
	const bundle = resolveBundle(plugin);
	if (!bundle) return false;
	return await bundle.redo();
}
