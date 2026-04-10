import { type Command, MacroCommand, toLocalISOString } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import { type AIOperation, AIOperationsSchema } from "../../types/ai-operation-schemas";
import { buildCreateEventCommand, buildDeleteEventCommand, buildEditEventCommand } from "../api/command-builders";
import type { PrismaCreateEventInput, PrismaEditEventInput, PrismaEventInput } from "../api/types";
import type { CalendarBundle } from "../calendar-bundle";
import {
	buildCalendarContext,
	buildManipulationContext,
	buildPlanningContext,
	type CalendarContext,
	type CategoryContext,
	getViewLabel,
	type ManipulationContext,
	type PlanningContext,
} from "./ai-context-builder";

// ─── View Context Resolution ────────────────────────────────

export interface ActiveViewContext {
	viewType: string;
	currentStart: Date;
	currentEnd: Date;
}

export function resolveActiveViewContext(
	_plugin: CustomCalendarPlugin,
	bundle: CalendarBundle
): ActiveViewContext | null {
	const component = bundle.viewRef.calendarComponent;
	if (!component) return null;

	return component.getViewContext() ?? null;
}

export function getActiveCalendarInfo(
	plugin: CustomCalendarPlugin
): { calendarName: string; viewLabel: string } | null {
	const lastUsedCalendarId = plugin.syncStore.data.lastUsedCalendarId;
	if (!lastUsedCalendarId) return null;

	const bundle = plugin.calendarBundles.find((b) => b.calendarId === lastUsedCalendarId);
	if (!bundle) return null;

	const viewContext = resolveActiveViewContext(plugin, bundle);
	if (!viewContext) return null;

	return {
		calendarName: bundle.settingsStore.currentSettings.name,
		viewLabel: getViewLabel(viewContext.viewType),
	};
}

// ─── Context Gathering ──────────────────────────────────────

export function gatherCategoryContext(bundle: CalendarBundle): CategoryContext | null {
	const availableCategories = bundle.categoryTracker.getCategories();
	const presets = bundle.settingsStore.currentSettings.categoryAssignmentPresets ?? [];

	if (availableCategories.length === 0 && presets.length === 0) return null;

	return { availableCategories, presets };
}

export async function gatherCalendarContext(
	bundle: CalendarBundle,
	viewContext: ActiveViewContext
): Promise<CalendarContext> {
	const start = toLocalISOString(viewContext.currentStart);
	const end = toLocalISOString(viewContext.currentEnd);
	const events = await bundle.eventStore.getEvents({ start, end });
	const calendarName = bundle.settingsStore.currentSettings.name;
	const categoryProp = bundle.settingsStore.currentSettings.categoryProp;

	return buildCalendarContext(
		calendarName,
		viewContext.viewType,
		viewContext.currentStart,
		viewContext.currentEnd,
		events,
		categoryProp
	);
}

export async function gatherManipulationContext(
	bundle: CalendarBundle,
	viewContext: ActiveViewContext
): Promise<ManipulationContext> {
	const start = toLocalISOString(viewContext.currentStart);
	const end = toLocalISOString(viewContext.currentEnd);
	const events = await bundle.eventStore.getEvents({ start, end });
	const calendarName = bundle.settingsStore.currentSettings.name;

	return buildManipulationContext(calendarName, viewContext.currentStart, viewContext.currentEnd, events);
}

export async function gatherPlanningContext(
	bundle: CalendarBundle,
	viewContext: ActiveViewContext
): Promise<PlanningContext> {
	const currentStart = viewContext.currentStart;
	const currentEnd = viewContext.currentEnd;

	let previousStart: Date;
	let previousEnd: Date;

	if (viewContext.viewType === "dayGridMonth") {
		previousStart = new Date(currentStart);
		previousStart.setMonth(previousStart.getMonth() - 1);
		previousEnd = new Date(currentStart);
	} else {
		const duration = currentEnd.getTime() - currentStart.getTime();
		previousEnd = new Date(currentStart);
		previousStart = new Date(currentStart.getTime() - duration);
	}

	const currentEvents = await bundle.eventStore.getEvents({
		start: toLocalISOString(currentStart),
		end: toLocalISOString(currentEnd),
	});
	const previousEvents = await bundle.eventStore.getEvents({
		start: toLocalISOString(previousStart),
		end: toLocalISOString(previousEnd),
	});

	const calendarName = bundle.settingsStore.currentSettings.name;

	return buildPlanningContext(
		calendarName,
		currentStart,
		currentEnd,
		currentEvents,
		previousStart,
		previousEnd,
		previousEvents
	);
}

// ─── Operation Parsing ──────────────────────────────────────

export function parseOperations(response: string): AIOperation[] | null {
	const codeBlockMatch = response.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
	const jsonStr = codeBlockMatch ? codeBlockMatch[1] : response.trim();

	try {
		const parsed = JSON.parse(jsonStr) as unknown;
		const result = AIOperationsSchema.safeParse(parsed);
		if (!result.success) return null;
		return result.data;
	} catch {
		return null;
	}
}

// ─── Command Building ───────────────────────────────────────

function applyOptionalFields(
	input: PrismaEventInput,
	op: {
		allDay?: boolean | undefined;
		categories?: string[] | undefined;
		location?: string | undefined;
		participants?: string[] | undefined;
	}
): void {
	if (op.allDay !== undefined) input.allDay = op.allDay;
	if (op.categories !== undefined) input.categories = op.categories;
	if (op.location !== undefined) input.location = op.location;
	if (op.participants !== undefined) input.participants = op.participants;
}

export function buildCommandForOperation(
	plugin: CustomCalendarPlugin,
	op: AIOperation
): { command: Command; bundle: CalendarBundle } | null {
	if (op.type === "create") {
		const input: PrismaCreateEventInput = { title: op.title, start: op.start, end: op.end };
		applyOptionalFields(input, op);
		return buildCreateEventCommand(plugin, input);
	} else if (op.type === "edit") {
		const input: PrismaEditEventInput = { filePath: op.filePath };
		if (op.title !== undefined) input.title = op.title;
		if (op.start !== undefined) input.start = op.start;
		if (op.end !== undefined) input.end = op.end;
		applyOptionalFields(input, op);
		return buildEditEventCommand(plugin, input);
	} else {
		return buildDeleteEventCommand(plugin, { filePath: op.filePath });
	}
}

// ─── Operation Execution ────────────────────────────────────

export interface ExecutionResult {
	succeeded: number;
	failed: number;
	total: number;
}

export async function executeOperations(
	plugin: CustomCalendarPlugin,
	operations: AIOperation[]
): Promise<ExecutionResult> {
	const batchExecution = plugin.settingsStore.currentSettings.ai.aiBatchExecution;

	if (batchExecution) {
		return executeBatch(plugin, operations);
	}
	return executeIndividually(plugin, operations);
}

async function executeBatch(plugin: CustomCalendarPlugin, operations: AIOperation[]): Promise<ExecutionResult> {
	const commands: Command[] = [];
	let bundle: CalendarBundle | null = null;
	let failed = 0;

	for (const op of operations) {
		const result = buildCommandForOperation(plugin, op);
		if (result) {
			commands.push(result.command);
			bundle = result.bundle;
		} else {
			failed++;
		}
	}

	if (commands.length > 0 && bundle) {
		try {
			const macro = new MacroCommand(commands);
			await bundle.commandManager.executeCommand(macro);
		} catch {
			return { succeeded: 0, failed: operations.length, total: operations.length };
		}
	}

	return { succeeded: commands.length, failed, total: operations.length };
}

async function executeIndividually(plugin: CustomCalendarPlugin, operations: AIOperation[]): Promise<ExecutionResult> {
	let succeeded = 0;
	let failed = 0;

	for (const op of operations) {
		try {
			const result = buildCommandForOperation(plugin, op);
			if (result) {
				await result.bundle.commandManager.executeCommand(result.command);
				succeeded++;
			} else {
				failed++;
			}
		} catch {
			failed++;
		}
	}

	return { succeeded, failed, total: operations.length };
}
