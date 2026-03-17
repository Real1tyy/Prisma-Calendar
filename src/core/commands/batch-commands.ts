import { MacroCommand } from "@real1ty-obsidian-plugins";
import type { DurationLike } from "luxon";
import type { App } from "obsidian";

import type { CalendarBundle } from "../calendar-bundle";
import { CloneEventCommand, DeleteEventCommand } from "./lifecycle-commands";
import { AssignCategoriesCommand, MarkAsDoneCommand, MarkAsUndoneCommand, ToggleSkipCommand } from "./status-commands";
import { MoveEventCommand, UpdateFrontmatterCommand } from "./update-commands";

function createBatchDeleteCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const deleteCommands = filePaths.map((filePath) => new DeleteEventCommand(app, bundle, filePath));
	return new MacroCommand(deleteCommands);
}

function createBatchMoveCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	offset: DurationLike
): MacroCommand {
	const moveCommands = filePaths.map((filePath) => new MoveEventCommand(app, bundle, filePath, offset, offset));
	return new MacroCommand(moveCommands);
}

function createBatchCloneCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	offset: DurationLike
): MacroCommand {
	const cloneCommands = filePaths.map((filePath) => new CloneEventCommand(app, bundle, filePath, offset, offset));
	return new MacroCommand(cloneCommands);
}

function createBatchDuplicateCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const duplicateCommands = filePaths.map((filePath) => new CloneEventCommand(app, bundle, filePath));
	return new MacroCommand(duplicateCommands);
}

function createBatchSkipCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const skipCommands = filePaths.map((filePath) => new ToggleSkipCommand(app, bundle, filePath));
	return new MacroCommand(skipCommands);
}

function createBatchMoveByCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	offset: DurationLike
): MacroCommand {
	const moveByCommands = filePaths.map((filePath) => new MoveEventCommand(app, bundle, filePath, offset, offset));
	return new MacroCommand(moveByCommands);
}

function createBatchMarkAsDoneCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const markAsDoneCommands = filePaths.map((filePath) => new MarkAsDoneCommand(app, bundle, filePath));
	return new MacroCommand(markAsDoneCommands);
}

function createBatchMarkAsNotDoneCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const markAsNotDoneCommands = filePaths.map((filePath) => new MarkAsUndoneCommand(app, bundle, filePath));
	return new MacroCommand(markAsNotDoneCommands);
}

function createBatchAssignCategoriesCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	categories: string[]
): MacroCommand {
	const assignCategoriesCommands = filePaths.map(
		(filePath) => new AssignCategoriesCommand(app, bundle, filePath, categories)
	);
	return new MacroCommand(assignCategoriesCommands);
}

function createBatchUpdateFrontmatterCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	propertyUpdates: Map<string, string | null>
): MacroCommand {
	const updateCommands = filePaths.map(
		(filePath) => new UpdateFrontmatterCommand(app, bundle, filePath, propertyUpdates)
	);
	return new MacroCommand(updateCommands);
}

export function weekDuration(weeks: number): DurationLike {
	return { weeks };
}

export class BatchCommandFactory {
	constructor(
		private app: App,
		private bundle: CalendarBundle
	) {}

	createDelete(filePaths: string[]): MacroCommand {
		return createBatchDeleteCommand(this.app, this.bundle, filePaths);
	}

	createDuplicate(filePaths: string[]): MacroCommand {
		return createBatchDuplicateCommand(this.app, this.bundle, filePaths);
	}

	createMove(filePaths: string[], weeks: number): MacroCommand {
		return createBatchMoveCommand(this.app, this.bundle, filePaths, weekDuration(weeks));
	}

	createClone(filePaths: string[], weeks: number): MacroCommand {
		return createBatchCloneCommand(this.app, this.bundle, filePaths, weekDuration(weeks));
	}

	createSkip(filePaths: string[]): MacroCommand {
		return createBatchSkipCommand(this.app, this.bundle, filePaths);
	}

	createMoveBy(filePaths: string[], offset: DurationLike): MacroCommand {
		return createBatchMoveByCommand(this.app, this.bundle, filePaths, offset);
	}

	createMarkAsDone(filePaths: string[]): MacroCommand {
		return createBatchMarkAsDoneCommand(this.app, this.bundle, filePaths);
	}

	createMarkAsNotDone(filePaths: string[]): MacroCommand {
		return createBatchMarkAsNotDoneCommand(this.app, this.bundle, filePaths);
	}

	createAssignCategories(filePaths: string[], categories: string[]): MacroCommand {
		return createBatchAssignCategoriesCommand(this.app, this.bundle, filePaths, categories);
	}

	createUpdateFrontmatter(filePaths: string[], propertyUpdates: Map<string, string | null>): MacroCommand {
		return createBatchUpdateFrontmatterCommand(this.app, this.bundle, filePaths, propertyUpdates);
	}
}
