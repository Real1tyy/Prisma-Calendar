import type { Command } from "@real1ty-obsidian-plugins";

import type CustomCalendarPlugin from "../../main";
import type { CalendarBundle } from "../calendar-bundle";
import {
	createBatchDelete,
	createBatchMarkAsDone,
	createBatchMarkAsNotDone,
	createBatchSkip,
} from "../commands/batch-commands";
import { resolveBundleOrNotice } from "./bundle-resolver";
import type { PrismaBatchInput } from "./types";

function batchOp(getCommand: (bundle: CalendarBundle, filePaths: string[]) => Command) {
	return async (plugin: CustomCalendarPlugin, input: PrismaBatchInput): Promise<boolean> => {
		const bundle = resolveBundleOrNotice(plugin, input.calendarId);
		if (!bundle) return false;
		await bundle.commandManager.executeCommand(getCommand(bundle, input.filePaths));
		return true;
	};
}

export const batchMarkAsDone = batchOp(createBatchMarkAsDone);
export const batchMarkAsUndone = batchOp(createBatchMarkAsNotDone);
export const batchDelete = batchOp(createBatchDelete);
export const batchToggleSkip = batchOp(createBatchSkip);
