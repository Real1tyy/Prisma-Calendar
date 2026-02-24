import type CustomCalendarPlugin from "../../main";
import { CloneEventCommand } from "../commands/lifecycle-commands";
import { MarkAsDoneCommand, MarkAsUndoneCommand, ToggleSkipCommand } from "../commands/status-commands";
import { MoveEventCommand } from "../commands/update-commands";
import { resolveBundleOrNotice } from "./bundle-resolver";

export async function markAsDone(
	plugin: CustomCalendarPlugin,
	input: { filePath: string; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	const command = new MarkAsDoneCommand(plugin.app, bundle, input.filePath);
	await bundle.commandManager.executeCommand(command);
	return true;
}

export async function markAsUndone(
	plugin: CustomCalendarPlugin,
	input: { filePath: string; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	const command = new MarkAsUndoneCommand(plugin.app, bundle, input.filePath);
	await bundle.commandManager.executeCommand(command);
	return true;
}

export async function toggleSkip(
	plugin: CustomCalendarPlugin,
	input: { filePath: string; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	const command = new ToggleSkipCommand(plugin.app, bundle, input.filePath);
	await bundle.commandManager.executeCommand(command);
	return true;
}

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
	const command = new MoveEventCommand(plugin.app, bundle, input.filePath, input.offsetMs, input.offsetMs);
	await bundle.commandManager.executeCommand(command);
	return true;
}
