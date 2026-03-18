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

export function weekDuration(weeks: number): DurationLike {
	return { weeks };
}

export class BatchCommandFactory {
	constructor(
		private app: App,
		private bundle: CalendarBundle
	) {}

	createDelete(filePaths: string[]): MacroCommand {
		return batchCommand(filePaths, (fp) => new DeleteEventCommand(this.app, this.bundle, fp));
	}

	createDuplicate(filePaths: string[]): MacroCommand {
		return batchCommand(filePaths, (fp) => new CloneEventCommand(this.app, this.bundle, fp));
	}

	createMove(filePaths: string[], weeks: number): MacroCommand {
		const d = weekDuration(weeks);
		return batchCommand(filePaths, (fp) => moveEvent(this.app, this.bundle, fp, d, d));
	}

	createClone(filePaths: string[], weeks: number): MacroCommand {
		const d = weekDuration(weeks);
		return batchCommand(filePaths, (fp) => new CloneEventCommand(this.app, this.bundle, fp, d, d));
	}

	createSkip(filePaths: string[]): MacroCommand {
		return batchCommand(filePaths, (fp) => toggleSkip(this.app, this.bundle, fp));
	}

	createMoveBy(filePaths: string[], offset: DurationLike): MacroCommand {
		return batchCommand(filePaths, (fp) => moveEvent(this.app, this.bundle, fp, offset, offset));
	}

	createMarkAsDone(filePaths: string[]): MacroCommand {
		return batchCommand(filePaths, (fp) => markAsDone(this.app, this.bundle, fp));
	}

	createMarkAsNotDone(filePaths: string[]): MacroCommand {
		return batchCommand(filePaths, (fp) => markAsUndone(this.app, this.bundle, fp));
	}

	createAssignCategories(filePaths: string[], categories: string[]): MacroCommand {
		return batchCommand(filePaths, (fp) => assignCategories(this.app, this.bundle, fp, categories));
	}

	createUpdateFrontmatter(filePaths: string[], propertyUpdates: Map<string, string | null>): MacroCommand {
		return batchCommand(filePaths, (fp) => updateFrontmatter(this.app, fp, propertyUpdates));
	}
}
