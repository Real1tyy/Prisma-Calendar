import type { Command } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type CustomCalendarPlugin from "../../main";
import type { CalendarBundle } from "../calendar-bundle";
import { CloneEventCommand } from "../commands/lifecycle-commands";
import { MarkAsDoneCommand, MarkAsUndoneCommand, ToggleSkipCommand } from "../commands/status-commands";
import { MoveEventCommand } from "../commands/update-commands";
import { resolveBundleOrNotice } from "./bundle-resolver";

type StatusCommandCtor = new (app: App, bundle: CalendarBundle, filePath: string) => Command;

function statusOp(Ctor: StatusCommandCtor) {
	return async (plugin: CustomCalendarPlugin, input: { filePath: string; calendarId?: string }): Promise<boolean> => {
		const bundle = resolveBundleOrNotice(plugin, input.calendarId);
		if (!bundle) return false;
		await bundle.commandManager.executeCommand(new Ctor(plugin.app, bundle, input.filePath));
		return true;
	};
}

export const markAsDone = statusOp(MarkAsDoneCommand);
export const markAsUndone = statusOp(MarkAsUndoneCommand);
export const toggleSkip = statusOp(ToggleSkipCommand);

export async function cloneEvent(
	plugin: CustomCalendarPlugin,
	input: { filePath: string; offsetMs?: number; calendarId?: string }
): Promise<string | null> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return null;
	const offset = input.offsetMs ?? 0;
	const command = new CloneEventCommand(plugin.app, bundle, input.filePath, offset, offset);
	await bundle.commandManager.executeCommand(command);
	return command.getCreatedFilePath();
}

export async function moveEvent(
	plugin: CustomCalendarPlugin,
	input: { filePath: string; offsetMs: number; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	await bundle.commandManager.executeCommand(
		new MoveEventCommand(plugin.app, bundle, input.filePath, input.offsetMs, input.offsetMs)
	);
	return true;
}
