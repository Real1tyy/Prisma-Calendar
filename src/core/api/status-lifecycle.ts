import type { Command } from "@real1ty-obsidian-plugins";
import { Notice, TFile } from "obsidian";

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
import type { PrismaCloneEventInput, PrismaFilePathInput, PrismaMoveEventInput } from "./types";

type CommandFactory = (bundle: CalendarBundle, filePath: string) => Command;

// Guard against missing-file inputs at the API boundary. Without this, the
// underlying commands raise an exception that propagates out of the gateway
// — consumers expect a structured failure value (`false`/`null`), not a
// thrown error.
function requireEventFile(plugin: CustomCalendarPlugin, filePath: string): TFile | null {
	const file = plugin.app.vault.getAbstractFileByPath(filePath);
	if (file instanceof TFile) return file;
	new Notice(`Event file not found: ${filePath}`);
	return null;
}

function statusOp(factory: CommandFactory) {
	return async (plugin: CustomCalendarPlugin, input: PrismaFilePathInput): Promise<boolean> => {
		const bundle = resolveBundleOrNotice(plugin, input.calendarId);
		if (!bundle) return false;
		if (!requireEventFile(plugin, input.filePath)) return false;
		await bundle.commandManager.executeCommand(factory(bundle, input.filePath));
		return true;
	};
}

export const markAsDone = statusOp(markAsDoneCmd);
export const markAsUndone = statusOp(markAsUndoneCmd);
export const toggleSkip = statusOp(toggleSkipCmd);

export async function cloneEvent(plugin: CustomCalendarPlugin, input: PrismaCloneEventInput): Promise<string | null> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return null;
	if (!requireEventFile(plugin, input.filePath)) return null;
	const offset = input.offsetMs ?? 0;
	const command = new CloneEventCommand(plugin.app, bundle, input.filePath, offset, offset);
	await bundle.commandManager.executeCommand(command);
	return command.getCreatedFilePath();
}

export async function moveEvent(plugin: CustomCalendarPlugin, input: PrismaMoveEventInput): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	if (!requireEventFile(plugin, input.filePath)) return false;
	await bundle.commandManager.executeCommand(moveEventCmd(bundle, input.filePath, input.offsetMs, input.offsetMs));
	return true;
}
