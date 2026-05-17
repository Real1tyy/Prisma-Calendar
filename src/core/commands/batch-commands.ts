import { batchCommand, type MacroCommand } from "@real1ty-obsidian-plugins";
import type { DurationLike } from "luxon";
import type { App } from "obsidian";

import type { CalendarBundle } from "../calendar-bundle";
import {
	assignCategories,
	markAsDone,
	markAsUndone,
	moveEvent,
	toggleSkip,
	updateFrontmatter,
} from "./frontmatter-update-command";
import { CloneEventCommand, DeleteEventCommand } from "./lifecycle-commands";
import { ConvertToRealCommand, ConvertToVirtualCommand } from "./virtual-event-commands";

export function createBatchDelete(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => new DeleteEventCommand(bundle.fileRepository, fp));
}

export function createBatchDuplicate(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => new CloneEventCommand(app, bundle, fp));
}

export function createBatchMove(bundle: CalendarBundle, filePaths: string[], weeks: number): MacroCommand {
	const d: DurationLike = { weeks };
	return batchCommand(filePaths, (fp) => moveEvent(bundle, fp, d, d));
}

export function createBatchClone(app: App, bundle: CalendarBundle, filePaths: string[], weeks: number): MacroCommand {
	const d: DurationLike = { weeks };
	return batchCommand(filePaths, (fp) => new CloneEventCommand(app, bundle, fp, d, d));
}

export function createBatchSkip(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => toggleSkip(bundle, fp));
}

export function createBatchMoveBy(bundle: CalendarBundle, filePaths: string[], offset: DurationLike): MacroCommand {
	return batchCommand(filePaths, (fp) => moveEvent(bundle, fp, offset, offset));
}

export function createBatchMarkAsDone(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => markAsDone(bundle, fp));
}

export function createBatchMarkAsNotDone(bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => markAsUndone(bundle, fp));
}

export function createBatchAssignCategories(
	bundle: CalendarBundle,
	filePaths: string[],
	categories: string[]
): MacroCommand {
	return batchCommand(filePaths, (fp) => assignCategories(bundle, fp, categories));
}

export function createBatchUpdateFrontmatter(
	bundle: CalendarBundle,
	filePaths: string[],
	propertyUpdates: Map<string, string | null>
): MacroCommand {
	return batchCommand(filePaths, (fp) => updateFrontmatter(bundle, fp, propertyUpdates));
}

export function createBatchMakeVirtual(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	return batchCommand(filePaths, (fp) => new ConvertToVirtualCommand(app, bundle, fp));
}

export function createBatchMakeReal(app: App, bundle: CalendarBundle, virtualEventIds: string[]): MacroCommand {
	return batchCommand(virtualEventIds, (id) => new ConvertToRealCommand(app, bundle, id));
}
