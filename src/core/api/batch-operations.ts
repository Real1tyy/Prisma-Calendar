import type CustomCalendarPlugin from "../../main";
import { resolveBundleOrNotice } from "./bundle-resolver";

export async function batchMarkAsDone(
	plugin: CustomCalendarPlugin,
	input: { filePaths: string[]; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	const command = bundle.batchCommandFactory.createMarkAsDone(input.filePaths);
	await bundle.commandManager.executeCommand(command);
	return true;
}

export async function batchMarkAsUndone(
	plugin: CustomCalendarPlugin,
	input: { filePaths: string[]; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	const command = bundle.batchCommandFactory.createMarkAsNotDone(input.filePaths);
	await bundle.commandManager.executeCommand(command);
	return true;
}

export async function batchDelete(
	plugin: CustomCalendarPlugin,
	input: { filePaths: string[]; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	const command = bundle.batchCommandFactory.createDelete(input.filePaths);
	await bundle.commandManager.executeCommand(command);
	return true;
}

export async function batchToggleSkip(
	plugin: CustomCalendarPlugin,
	input: { filePaths: string[]; calendarId?: string }
): Promise<boolean> {
	const bundle = resolveBundleOrNotice(plugin, input.calendarId);
	if (!bundle) return false;
	const command = bundle.batchCommandFactory.createSkip(input.filePaths);
	await bundle.commandManager.executeCommand(command);
	return true;
}
