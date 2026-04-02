import { type ActionDefMap, ParamCoercion } from "@real1ty-obsidian-plugins";

import type { SingleCalendarConfig } from "../../types";
import type { AIMode } from "../../types/ai";
import type { PrismaCalendarApiManager } from "./api-manager";
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

export function buildActions(manager: PrismaCalendarApiManager): ActionDefMap {
	return {
		isPro: {
			handler: () => {
				return manager.isPro();
			},
		},
		openCreateEventModal: {
			handler: (options?: { calendarId?: string; autoStartStopwatch?: boolean; openCreatedInNewTab?: boolean }) => {
				void manager.openCreateEventModal(
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
				await manager.openEditActiveNoteModal(options?.calendarId);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		createUntrackedEvent: {
			handler: async (input: { title: string; calendarId?: string }) => {
				await manager.createUntrackedEvent(input.title, input.calendarId);
			},
			parseParams: (raw: Record<string, string>) => ({
				title: ParamCoercion.required.string(raw, "title"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		createEvent: {
			handler: async (input: PrismaCreateEventInput) => {
				await manager.createEvent(input);
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
				await manager.editEvent(input);
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
				await manager.deleteEvent(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		convertFileToEvent: {
			handler: async (input: PrismaConvertEventInput) => {
				await manager.convertFileToEvent(input);
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
				await manager.makeEventVirtual(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		makeEventReal: {
			handler: async (input: PrismaMakeRealInput) => {
				await manager.makeEventReal(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				virtualEventId: ParamCoercion.required.string(raw, "virtualEventId"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		addZettelIdToActiveNote: {
			handler: async (options?: { calendarId?: string }) => {
				await manager.addZettelIdToActiveNote(options?.calendarId);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		navigateToDate: {
			handler: async (input: NavigateInput) => {
				await manager.navigateToDate(input);
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
				return await manager.getEvents(input);
			},
		},
		getEventByPath: {
			handler: (input: { filePath: string; calendarId?: string }) => {
				return manager.getEventByPath(input);
			},
		},
		getAllEvents: {
			handler: (input?: { calendarId?: string }) => {
				return manager.getAllEvents(input);
			},
		},
		getCategories: {
			handler: (input?: { calendarId?: string }) => {
				return manager.getCategories(input);
			},
		},
		getUntrackedEvents: {
			handler: (input?: { calendarId?: string }) => {
				return manager.getUntrackedEvents(input);
			},
		},

		// ── Status & Lifecycle Operations ────────────────────

		markAsDone: {
			handler: async (input: { filePath: string; calendarId?: string }) => {
				return await manager.markAsDone(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		markAsUndone: {
			handler: async (input: { filePath: string; calendarId?: string }) => {
				return await manager.markAsUndone(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		toggleSkip: {
			handler: async (input: { filePath: string; calendarId?: string }) => {
				return await manager.toggleSkip(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		cloneEvent: {
			handler: async (input: { filePath: string; offsetMs?: number; calendarId?: string }) => {
				return await manager.cloneEvent(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				filePath: ParamCoercion.required.string(raw, "filePath"),
				offsetMs: ParamCoercion.number(raw, "offsetMs"),
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		moveEvent: {
			handler: async (input: { filePath: string; offsetMs: number; calendarId?: string }) => {
				return await manager.moveEvent(input);
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
				return await manager.batchMarkAsDone(input);
			},
		},
		batchMarkAsUndone: {
			handler: async (input: { filePaths: string[]; calendarId?: string }) => {
				return await manager.batchMarkAsUndone(input);
			},
		},
		batchDelete: {
			handler: async (input: { filePaths: string[]; calendarId?: string }) => {
				return await manager.batchDelete(input);
			},
		},
		batchToggleSkip: {
			handler: async (input: { filePaths: string[]; calendarId?: string }) => {
				return await manager.batchToggleSkip(input);
			},
		},

		// ── Calendar Metadata & Control ──────────────────────

		refreshCalendar: {
			handler: (input?: { calendarId?: string }) => {
				manager.refreshCalendar(input);
			},
			parseParams: (raw: Record<string, string>) => ({
				calendarId: ParamCoercion.string(raw, "calendarId"),
			}),
		},
		getCalendarInfo: {
			handler: (input?: { calendarId?: string }) => {
				return manager.getCalendarInfo(input);
			},
		},
		listCalendars: {
			handler: () => {
				return manager.listCalendars();
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
				return await manager.getStatistics(input);
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
				return manager.getSettings(input);
			},
		},
		updateSettings: {
			handler: async (input: { settings: Partial<SingleCalendarConfig>; calendarId?: string }) => {
				return await manager.updateSettings(input);
			},
		},

		// ── AI Operations ─────────────────────────────────────

		aiQuery: {
			handler: async (input: PrismaAIQueryInput) => {
				return await manager.aiQuery(input);
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
