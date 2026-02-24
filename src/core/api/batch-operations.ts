import type { Command } from "@real1ty-obsidian-plugins";
import type CustomCalendarPlugin from "../../main";
import type { CalendarBundle } from "../calendar-bundle";
import { resolveBundleOrNotice } from "./bundle-resolver";

function batchOp(getCommand: (bundle: CalendarBundle, filePaths: string[]) => Command) {
	return async (
		plugin: CustomCalendarPlugin,
		input: { filePaths: string[]; calendarId?: string }
	): Promise<boolean> => {
		const bundle = resolveBundleOrNotice(plugin, input.calendarId);
		if (!bundle) return false;
		await bundle.commandManager.executeCommand(getCommand(bundle, input.filePaths));
		return true;
	};
}

export const batchMarkAsDone = batchOp((b, paths) => b.batchCommandFactory.createMarkAsDone(paths));
export const batchMarkAsUndone = batchOp((b, paths) => b.batchCommandFactory.createMarkAsNotDone(paths));
export const batchDelete = batchOp((b, paths) => b.batchCommandFactory.createDelete(paths));
export const batchToggleSkip = batchOp((b, paths) => b.batchCommandFactory.createSkip(paths));
