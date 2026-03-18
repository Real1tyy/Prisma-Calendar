import type { Command } from "@real1ty-obsidian-plugins";
import type { App } from "obsidian";

import type CustomCalendarPlugin from "../../main";
import type { CalendarBundle } from "../calendar-bundle";
import {
	markAsDone as markAsDoneCmd,
	markAsUndone as markAsUndoneCmd,
	moveEvent as moveEventCmd,
	toggleSkip as toggleSkipCmd,
} from "../commands/frontmatter-update-command";
import { CloneEventCommand } from "../commands/lifecycle-commands";
import { resolveBundleOrNotice } from "./bundle-resolver";

type CommandFactory = (app: App, bundle: CalendarBundle, filePath: string) => Command;

function statusOp(factory: CommandFactory) {
	return async (plugin: CustomCalendarPlugin, input: { filePath: string; calendarId?: string }): Promise<boolean> => {
		const bundle = resolveBundleOrNotice(plugin, input.calendarId);
		if (!bundle) return false;
		await bundle.commandManager.executeCommand(factory(plugin.app, bundle, input.filePath));
		return true;
	};
}

export const markAsDone = statusOp(markAsDoneCmd);
export const markAsUndone = statusOp(markAsUndoneCmd);
export const toggleSkip = statusOp(toggleSkipCmd);

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
		moveEventCmd(plugin.app, bundle, input.filePath, input.offsetMs, input.offsetMs)
	);
	return true;
}
