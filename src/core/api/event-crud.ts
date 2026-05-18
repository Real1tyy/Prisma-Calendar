import { ensureISOSuffix, type Command } from "@real1ty-obsidian-plugins";
import { Notice, TFile } from "obsidian";

import type CustomCalendarPlugin from "../../main";
import { setUntrackedEventBasics } from "../../utils/frontmatter/basics";
import type { CalendarBundle } from "../calendar-bundle";
import { MoveEventToCalendarCommand } from "../commands/lifecycle-commands";
import { ConvertFileToEventCommand } from "../commands/update-commands";
import { withBundle } from "./bundle-resolver";
import { buildDeleteEventCommand, buildEditEventCommand } from "./command-builders";
import { buildFrontmatterFromInput } from "./frontmatter-helpers";
import type {
	PrismaConvertEventInput,
	PrismaCreateEventInput,
	PrismaDeleteEventInput,
	PrismaEditEventInput,
	PrismaMakeRealInput,
	PrismaMakeVirtualInput,
	PrismaMoveEventToCalendarInput,
	PrismaMoveEventToCalendarResult,
} from "./types";

async function executeBuiltCommand(result: { command: Command; bundle: CalendarBundle } | null): Promise<boolean> {
	if (!result) return false;
	await result.bundle.commandManager.executeCommand(result.command);
	return true;
}

export async function createUntrackedEvent(
	plugin: CustomCalendarPlugin,
	title: string,
	calendarId?: string
): Promise<string | null> {
	return withBundle(plugin, calendarId, null, async (bundle) => {
		const settings = bundle.settingsStore.currentSettings;
		const preservedFrontmatter: Record<string, unknown> = {};
		setUntrackedEventBasics(preservedFrontmatter, settings);

		const filePath = await bundle.createEvent({
			title,
			start: "",
			end: null,
			allDay: false,
			virtual: false,
			preservedFrontmatter,
		});

		if (filePath) {
			void plugin.rememberLastUsedCalendar(bundle.calendarId);
		}
		return filePath;
	});
}

export async function createEvent(plugin: CustomCalendarPlugin, input: PrismaCreateEventInput): Promise<string | null> {
	return withBundle(plugin, input.calendarId, null, async (bundle) => {
		const frontmatter = buildFrontmatterFromInput(bundle, input);
		const normalizedStart = input.start ? ensureISOSuffix(input.start) : "";
		const normalizedEnd = input.end ? ensureISOSuffix(input.end) : null;
		const filePath = await bundle.createEvent({
			title: input.title,
			start: normalizedStart,
			end: normalizedEnd,
			allDay: input.allDay ?? false,
			virtual: false,
			preservedFrontmatter: frontmatter,
		});
		if (filePath) {
			void plugin.rememberLastUsedCalendar(bundle.calendarId);
		}
		return filePath;
	});
}

export async function editEvent(plugin: CustomCalendarPlugin, input: PrismaEditEventInput): Promise<boolean> {
	return executeBuiltCommand(buildEditEventCommand(plugin, input));
}

export async function deleteEvent(plugin: CustomCalendarPlugin, input: PrismaDeleteEventInput): Promise<boolean> {
	return executeBuiltCommand(buildDeleteEventCommand(plugin, input));
}

export async function convertFileToEvent(
	plugin: CustomCalendarPlugin,
	input: PrismaConvertEventInput
): Promise<boolean> {
	return withBundle(plugin, input.calendarId, false, async (bundle) => {
		const file = plugin.app.vault.getAbstractFileByPath(input.filePath);
		if (!(file instanceof TFile)) {
			new Notice(`File not found: ${input.filePath}`);
			return false;
		}

		const frontmatter = buildFrontmatterFromInput(bundle, input);
		const command = new ConvertFileToEventCommand(plugin.app, bundle, file.path, frontmatter);
		await bundle.commandManager.executeCommand(command);
		void plugin.rememberLastUsedCalendar(bundle.calendarId);
		return true;
	});
}

export async function makeEventVirtual(plugin: CustomCalendarPlugin, input: PrismaMakeVirtualInput): Promise<boolean> {
	return withBundle(plugin, input.calendarId, false, async (bundle) => {
		return await bundle.convertToVirtual(input.filePath);
	});
}

export async function moveEventToCalendar(
	plugin: CustomCalendarPlugin,
	input: PrismaMoveEventToCalendarInput
): Promise<PrismaMoveEventToCalendarResult> {
	return withBundle<PrismaMoveEventToCalendarResult>(
		plugin,
		input.calendarId,
		{ success: false, error: "No source planning system available" },
		async (sourceBundle) => {
			if (input.targetCalendarId === sourceBundle.calendarId) {
				return { success: false, error: "Source and destination planning systems must differ" };
			}

			const target = plugin.calendarBundles.find((b) => b.calendarId === input.targetCalendarId);
			if (!target) {
				new Notice(`Destination planning system not found: ${input.targetCalendarId}`);
				return { success: false, error: `Destination planning system not found: ${input.targetCalendarId}` };
			}

			const file = plugin.app.vault.getAbstractFileByPath(input.filePath);
			if (!(file instanceof TFile)) {
				new Notice(`File not found: ${input.filePath}`);
				return { success: false, error: `File not found: ${input.filePath}` };
			}

			const command = new MoveEventToCalendarCommand(
				plugin.app,
				sourceBundle.settingsStore.currentSettings,
				target.settingsStore.currentSettings,
				input.filePath
			);
			await sourceBundle.commandManager.executeCommand(command);

			void plugin.rememberLastUsedCalendar(target.calendarId);
			const movedPath = command.getMovedFilePath();
			return movedPath ? { success: true, movedFilePath: movedPath } : { success: true };
		}
	);
}

export async function makeEventReal(plugin: CustomCalendarPlugin, input: PrismaMakeRealInput): Promise<boolean> {
	return withBundle(plugin, input.calendarId, false, async (bundle) => {
		const virtualData = bundle.virtualEventStore.getById(input.virtualEventId);
		if (!virtualData) {
			new Notice("Virtual event not found");
			return false;
		}
		return await bundle.convertToReal(input.virtualEventId);
	});
}
