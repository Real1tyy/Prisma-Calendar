import type { Command } from "@real1ty-obsidian-plugins";
import { type ActionDefMap, PluginApiGateway } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import type { SingleCalendarConfig } from "../../types";
import type { CalendarBundle } from "../calendar-bundle";
import { buildActions } from "./action-definitions";
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
import { buildCreateEventCommand, buildDeleteEventCommand, buildEditEventCommand } from "./command-builders";
import { convertFileToEvent, createEvent, createUntrackedEvent, deleteEvent, editEvent } from "./event-crud";
import {
	addZettelIdToActiveNote,
	openCreateEventModal,
	openCreateUntrackedEventModal,
	openEditActiveNoteModal,
} from "./modal-actions";
import { navigateToDate } from "./navigation";
import {
	getAllEvents,
	getCategories,
	getEventByPath,
	getEvents,
	getUntrackedEvents,
	redo,
	undo,
} from "./read-operations";
import { cloneEvent, markAsDone, markAsUndone, moveEvent, toggleSkip } from "./status-lifecycle";
import type {
	PrismaAIQueryInput,
	PrismaAIQueryResult,
	PrismaCalendarInfo,
	PrismaCategoryOutput,
	PrismaConvertEventInput,
	PrismaCreateEventInput,
	PrismaDeleteEventInput,
	PrismaEditEventInput,
	PrismaEventOutput,
	PrismaStatisticsOutput,
} from "./types";

export class PrismaCalendarApiManager {
	private static readonly GLOBAL_KEY = "PrismaCalendar";
	private readonly gateway: PluginApiGateway<ActionDefMap>;
	readonly plugin: CustomCalendarPlugin;

	constructor(plugin: CustomCalendarPlugin) {
		this.plugin = plugin;
		this.gateway = new PluginApiGateway({
			plugin: this.plugin,
			globalKey: PrismaCalendarApiManager.GLOBAL_KEY,
			protocolKey: "prisma-calendar",
			actions: buildActions(this),
		});
	}

	// ─── API Registration ─────────────────────────────────────────

	exposeFree(): void {
		(window as unknown as Record<string, unknown>)[PrismaCalendarApiManager.GLOBAL_KEY] = {
			isPro: () => this.isPro(),
		};
	}

	expose(): void {
		if (!this.plugin.isProEnabled) {
			return;
		}
		this.gateway.expose();
	}

	unexpose(): void {
		this.gateway.unexpose();
		this.exposeFree();
	}

	destroy(): void {
		this.gateway.unexpose();
	}

	// ─── License Status ───────────────────────────────────────────

	isPro(): boolean {
		return this.plugin.isProEnabled;
	}

	buildUrl(call: string, params?: Record<string, string | number | boolean>): string {
		return this.gateway.buildUrl(call, params);
	}

	// ─── Modal Actions ────────────────────────────────────────────

	openCreateUntrackedEventModal(): void {
		openCreateUntrackedEventModal(this.plugin);
	}

	async openCreateEventModal(
		calendarId?: string,
		autoStartStopwatch = false,
		openCreatedInNewTab = false
	): Promise<boolean> {
		return openCreateEventModal(this.plugin, calendarId, autoStartStopwatch, openCreatedInNewTab);
	}

	async openEditActiveNoteModal(calendarId?: string): Promise<boolean> {
		return openEditActiveNoteModal(this.plugin, calendarId);
	}

	async addZettelIdToActiveNote(calendarId?: string): Promise<boolean> {
		return addZettelIdToActiveNote(this.plugin, calendarId);
	}

	// ─── Event Creation ───────────────────────────────────────────

	async createUntrackedEvent(title: string, calendarId?: string): Promise<string | null> {
		return createUntrackedEvent(this.plugin, title, calendarId);
	}

	async createEvent(input: PrismaCreateEventInput): Promise<string | null> {
		return createEvent(this.plugin, input);
	}

	async editEvent(input: PrismaEditEventInput): Promise<boolean> {
		return editEvent(this.plugin, input);
	}

	async deleteEvent(input: PrismaDeleteEventInput): Promise<boolean> {
		return deleteEvent(this.plugin, input);
	}

	async convertFileToEvent(input: PrismaConvertEventInput): Promise<boolean> {
		return convertFileToEvent(this.plugin, input);
	}

	// ─── Undo / Redo ─────────────────────────────────────────────

	async undo(): Promise<boolean> {
		return undo(this.plugin);
	}

	async redo(): Promise<boolean> {
		return redo(this.plugin);
	}

	// ─── Read Operations ─────────────────────────────────────────

	async getEvents(input: { start: string; end: string; calendarId?: string }): Promise<PrismaEventOutput[]> {
		return getEvents(this.plugin, input);
	}

	getEventByPath(input: { filePath: string; calendarId?: string }): PrismaEventOutput | null {
		return getEventByPath(this.plugin, input);
	}

	getAllEvents(input?: { calendarId?: string }): PrismaEventOutput[] {
		return getAllEvents(this.plugin, input);
	}

	getCategories(input?: { calendarId?: string }): PrismaCategoryOutput[] {
		return getCategories(this.plugin, input);
	}

	getUntrackedEvents(input?: { calendarId?: string }): PrismaEventOutput[] {
		return getUntrackedEvents(this.plugin, input);
	}

	// ─── Status & Lifecycle Operations ───────────────────────────

	async markAsDone(input: { filePath: string; calendarId?: string }): Promise<boolean> {
		return markAsDone(this.plugin, input);
	}

	async markAsUndone(input: { filePath: string; calendarId?: string }): Promise<boolean> {
		return markAsUndone(this.plugin, input);
	}

	async toggleSkip(input: { filePath: string; calendarId?: string }): Promise<boolean> {
		return toggleSkip(this.plugin, input);
	}

	async cloneEvent(input: { filePath: string; offsetMs?: number; calendarId?: string }): Promise<string | null> {
		return cloneEvent(this.plugin, input);
	}

	async moveEvent(input: { filePath: string; offsetMs: number; calendarId?: string }): Promise<boolean> {
		return moveEvent(this.plugin, input);
	}

	// ─── Batch Operations ────────────────────────────────────────

	async batchMarkAsDone(input: { filePaths: string[]; calendarId?: string }): Promise<boolean> {
		return batchMarkAsDone(this.plugin, input);
	}

	async batchMarkAsUndone(input: { filePaths: string[]; calendarId?: string }): Promise<boolean> {
		return batchMarkAsUndone(this.plugin, input);
	}

	async batchDelete(input: { filePaths: string[]; calendarId?: string }): Promise<boolean> {
		return batchDelete(this.plugin, input);
	}

	async batchToggleSkip(input: { filePaths: string[]; calendarId?: string }): Promise<boolean> {
		return batchToggleSkip(this.plugin, input);
	}

	// ─── Calendar Metadata & Control ─────────────────────────────

	refreshCalendar(input?: { calendarId?: string }): void {
		refreshCalendar(this.plugin, input);
	}

	getCalendarInfo(input?: { calendarId?: string }): PrismaCalendarInfo | null {
		return getCalendarInfo(this.plugin, input);
	}

	listCalendars(): PrismaCalendarInfo[] {
		return listCalendars(this.plugin);
	}

	// ─── Statistics ──────────────────────────────────────────────

	async getStatistics(input?: {
		date?: string;
		interval?: "day" | "week" | "month";
		mode?: "name" | "category";
		calendarId?: string;
	}): Promise<PrismaStatisticsOutput | null> {
		return getStatistics(this.plugin, input);
	}

	// ─── Settings ────────────────────────────────────────────────

	getSettings(input?: { calendarId?: string }): SingleCalendarConfig | null {
		return getSettings(this.plugin, input);
	}

	async updateSettings(input: { settings: Partial<SingleCalendarConfig>; calendarId?: string }): Promise<boolean> {
		return updateSettings(this.plugin, input);
	}

	// ─── Navigation ──────────────────────────────────────────────

	async navigateToDate(input: { date?: string; view?: string; calendarId?: string }): Promise<boolean> {
		return navigateToDate(this.plugin, input);
	}

	// ─── AI Operations ──────────────────────────────────────────

	async aiQuery(input: PrismaAIQueryInput): Promise<PrismaAIQueryResult> {
		return aiQuery(this.plugin, input);
	}

	// ─── Command Builders (for batch execution) ─────────────────

	buildCreateEventCommand(input: PrismaCreateEventInput): { command: Command; bundle: CalendarBundle } | null {
		return buildCreateEventCommand(this.plugin, input);
	}

	buildEditEventCommand(input: PrismaEditEventInput): { command: Command; bundle: CalendarBundle } | null {
		return buildEditEventCommand(this.plugin, input);
	}

	buildDeleteEventCommand(input: PrismaDeleteEventInput): { command: Command; bundle: CalendarBundle } | null {
		return buildDeleteEventCommand(this.plugin, input);
	}
}
