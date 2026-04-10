import { type ActionDefMap, ParamCoercion } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import type { SingleCalendarConfig } from "../../types";
import type { AIMode } from "../../types/ai";
import { aiQuery } from "./ai-operations";
import { batchDelete, batchMarkAsDone, batchMarkAsUndone, batchToggleSkip } from "./batch-operations";
import {
	getCalendarInfo,
	getSettings,
	getStatistics,
	listCalendars,
	refreshCalendar,
	updateSettings,
} from "./calendar-metadata";
import {
	convertFileToEvent,
	createEvent,
	createUntrackedEvent,
	deleteEvent,
	editEvent,
	makeEventReal,
	makeEventVirtual,
} from "./event-crud";
import {
	addZettelIdToActiveNote,
	duplicateCurrentEvent,
	openCreateEventModal,
	openEditActiveNoteModal,
} from "./modal-actions";
import { navigateToDate } from "./navigation";
import { getAllEvents, getCategories, getEventByPath, getEvents, getUntrackedEvents } from "./read-operations";
import { cloneEvent, markAsDone, markAsUndone, moveEvent, toggleSkip } from "./status-lifecycle";
import type {
	NavigateInput,
	PrismaAIQueryInput,
	PrismaConvertEventInput,
	PrismaCreateEventInput,
	PrismaDeleteEventInput,
	PrismaEditEventInput,
	PrismaMakeRealInput,
	PrismaMakeVirtualInput,
} from "./types";

export function buildActions(plugin: CustomCalendarPlugin): ActionDefMap {
	return {
		isPro: {
			handler: () => {
				return plugin.isProEnabled;
			},
		},
		openCreateEventModal: {
			handler: (options?: { calendarId?: string; autoStartStopwatch?: boolean; openCreatedInNewTab?: boolean }) => {
				void openCreateEventModal(
					plugin,
					options?.calendarId,
					options?.autoStartStopwatch ?? false,
					options?.openCreatedInNewTab ?? false
				);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
				autoStartStopwatch: ParamCoercion.boolean(raw, "autoStartStopwatch"),
				openCreatedInNewTab: ParamCoercion.boolean(raw, "openCreatedInNewTab"),
			}),
		},
		openEditActiveNoteModal: {
			handler: async (options?: { calendarId?: string }) => {
				await openEditActiveNoteModal(plugin, options?.calendarId);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		createUntrackedEvent: {
			handler: async (input: { title: string; calendarId?: string }) => {
				await createUntrackedEvent(plugin, input.title, input.calendarId);
			},
			parseParams: (raw: Record<string, string>) => ({
				title: ParamCoercion.required.string(raw, "title"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		createEvent: {
			handler: async (input: PrismaCreateEventInput) => {
				await createEvent(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				title: ParamCoercion.required.string(raw, "title"),
				start: ParamCoercion.string(raw, "start"),
				end: ParamCoercion.string(raw, "end"),
				allDay: ParamCoercion.boolean(raw, "allDay"),
				categories: ParamCoercion.stringArray(raw, "categories"),
				location: ParamCoercion.string(raw, "location"),
				participants: ParamCoercion.stringArray(raw, "participants"),
				markAsDone: ParamCoercion.boolean(raw, "markAsDone"),
				skip: ParamCoercion.boolean(raw, "skip"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		editEvent: {
			handler: async (input: PrismaEditEventInput) => {
				await editEvent(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				title: ParamCoercion.string(raw, "title"),
				start: ParamCoercion.string(raw, "start"),
				end: ParamCoercion.string(raw, "end"),
				allDay: ParamCoercion.boolean(raw, "allDay"),
				categories: ParamCoercion.stringArray(raw, "categories"),
				location: ParamCoercion.string(raw, "location"),
				participants: ParamCoercion.stringArray(raw, "participants"),
				markAsDone: ParamCoercion.boolean(raw, "markAsDone"),
				skip: ParamCoercion.boolean(raw, "skip"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		deleteEvent: {
			handler: async (input: PrismaDeleteEventInput) => {
				await deleteEvent(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		convertFileToEvent: {
			handler: async (input: PrismaConvertEventInput) => {
				await convertFileToEvent(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				title: ParamCoercion.string(raw, "title"),
				start: ParamCoercion.string(raw, "start"),
				end: ParamCoercion.string(raw, "end"),
				allDay: ParamCoercion.boolean(raw, "allDay"),
				categories: ParamCoercion.stringArray(raw, "categories"),
				location: ParamCoercion.string(raw, "location"),
				participants: ParamCoercion.stringArray(raw, "participants"),
				markAsDone: ParamCoercion.boolean(raw, "markAsDone"),
				skip: ParamCoercion.boolean(raw, "skip"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		makeEventVirtual: {
			handler: async (input: PrismaMakeVirtualInput) => {
				await makeEventVirtual(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		makeEventReal: {
			handler: async (input: PrismaMakeRealInput) => {
				await makeEventReal(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				virtualEventId: ParamCoercion.required.string(raw, "virtualEventId"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		addZettelIdToActiveNote: {
			handler: async (options?: { calendarId?: string }) => {
				await addZettelIdToActiveNote(plugin, options?.calendarId);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		duplicateCurrentEvent: {
			handler: async (options?: { calendarId?: string }) => {
				await duplicateCurrentEvent(plugin, options?.calendarId);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		navigateToDate: {
			handler: async (input: NavigateInput) => {
				await navigateToDate(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				date: ParamCoercion.string(raw, "date"),
				view: ParamCoercion.string(raw, "view"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},

		// ── Read Operations ──────────────────────────────────

		getEvents: {
			handler: async (input: { start: string; end: string; calendarId?: string }) => {
				return await getEvents(plugin, input);
			},
		},
		getEventByPath: {
			handler: (input: { filePath: string; calendarId?: string }) => {
				return getEventByPath(plugin, input);
			},
		},
		getAllEvents: {
			handler: (input?: { calendarId?: string }) => {
				return getAllEvents(plugin, input);
			},
		},
		getCategories: {
			handler: (input?: { calendarId?: string }) => {
				return getCategories(plugin, input);
			},
		},
		getUntrackedEvents: {
			handler: (input?: { calendarId?: string }) => {
				return getUntrackedEvents(plugin, input);
			},
		},

		// ── Status & Lifecycle Operations ────────────────────

		markAsDone: {
			handler: async (input: { filePath: string; calendarId?: string }) => {
				return await markAsDone(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		markAsUndone: {
			handler: async (input: { filePath: string; calendarId?: string }) => {
				return await markAsUndone(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		toggleSkip: {
			handler: async (input: { filePath: string; calendarId?: string }) => {
				return await toggleSkip(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		cloneEvent: {
			handler: async (input: { filePath: string; offsetMs?: number; calendarId?: string }) => {
				return await cloneEvent(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				offsetMs: ParamCoercion.number(raw, "offsetMs"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		moveEvent: {
			handler: async (input: { filePath: string; offsetMs: number; calendarId?: string }) => {
				return await moveEvent(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				offsetMs: ParamCoercion.required.number(raw, "offsetMs"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},

		// ── Batch Operations ─────────────────────────────────

		batchMarkAsDone: {
			handler: async (input: { filePaths: string[]; calendarId?: string }) => {
				return await batchMarkAsDone(plugin, input);
			},
		},
		batchMarkAsUndone: {
			handler: async (input: { filePaths: string[]; calendarId?: string }) => {
				return await batchMarkAsUndone(plugin, input);
			},
		},
		batchDelete: {
			handler: async (input: { filePaths: string[]; calendarId?: string }) => {
				return await batchDelete(plugin, input);
			},
		},
		batchToggleSkip: {
			handler: async (input: { filePaths: string[]; calendarId?: string }) => {
				return await batchToggleSkip(plugin, input);
			},
		},

		// ── Calendar Metadata & Control ──────────────────────

		refreshCalendar: {
			handler: (input?: { calendarId?: string }) => {
				refreshCalendar(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		getCalendarInfo: {
			handler: (input?: { calendarId?: string }) => {
				return getCalendarInfo(plugin, input);
			},
		},
		listCalendars: {
			handler: () => {
				return listCalendars(plugin);
			},
		},

		// ── Statistics ───────────────────────────────────────

		getStatistics: {
			handler: async (input?: {
				date?: string;
				interval?: "day" | "week" | "month";
				mode?: "name" | "category";
				calendarId?: string;
			}) => {
				return await getStatistics(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				date: ParamCoercion.string(raw, "date"),
				interval: ParamCoercion.string(raw, "interval") as "day" | "week" | "month" | undefined,
				mode: ParamCoercion.string(raw, "mode") as "name" | "category" | undefined,
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},

		// ── Settings ────────────────────────────────────────

		getSettings: {
			handler: (input?: { calendarId?: string }) => {
				return getSettings(plugin, input);
			},
		},
		updateSettings: {
			handler: async (input: { settings: Partial<SingleCalendarConfig>; calendarId?: string }) => {
				return await updateSettings(plugin, input);
			},
		},

		// ── AI Operations ─────────────────────────────────────

		aiQuery: {
			handler: async (input: PrismaAIQueryInput) => {
				return await aiQuery(plugin, input);
			},
			parseParams: (raw: Record<string, string>) => ({
				message: ParamCoercion.required.string(raw, "message"),
				mode: ParamCoercion.string(raw, "mode") as AIMode | undefined,
				execute: ParamCoercion.boolean(raw, "execute"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
	};
}
