import type { App } from "obsidian";
import type { CalendarBundle } from "../calendar-bundle";
import { MacroCommand } from "./command";
import {
	AssignCategoriesCommand,
	CloneEventCommand,
	DeleteEventCommand,
	MarkAsDoneCommand,
	MarkAsUndoneCommand,
	MoveByCommand,
	MoveEventCommand,
	ToggleSkipCommand,
	UpdateFrontmatterCommand,
} from "./event-commands";

function createBatchDeleteCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const deleteCommands = filePaths.map((filePath) => new DeleteEventCommand(app, bundle, filePath));
	return new MacroCommand(deleteCommands);
}

function createBatchMoveCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	startOffset: number,
	endOffset: number
): MacroCommand {
	const moveCommands = filePaths.map((filePath) => new MoveEventCommand(app, bundle, filePath, startOffset, endOffset));
	return new MacroCommand(moveCommands);
}

function createBatchCloneCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	startOffset: number,
	endOffset: number
): MacroCommand {
	const cloneCommands = filePaths.map(
		(filePath) => new CloneEventCommand(app, bundle, filePath, startOffset, endOffset)
	);
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
	offsetMs: number
): MacroCommand {
	const moveByCommands = filePaths.map((filePath) => new MoveByCommand(app, bundle, filePath, offsetMs));
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

export function calculateWeekOffsets(weeks: number): [number, number] {
	const weekInMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
	const offset = weeks * weekInMs;
	return [offset, offset]; // Both start and end get the same offset
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
		const [startOffset, endOffset] = calculateWeekOffsets(weeks);
		return createBatchMoveCommand(this.app, this.bundle, filePaths, startOffset, endOffset);
	}

	createClone(filePaths: string[], weeks: number): MacroCommand {
		const [startOffset, endOffset] = calculateWeekOffsets(weeks);
		return createBatchCloneCommand(this.app, this.bundle, filePaths, startOffset, endOffset);
	}

	createSkip(filePaths: string[]): MacroCommand {
		return createBatchSkipCommand(this.app, this.bundle, filePaths);
	}

	createMoveBy(filePaths: string[], offsetMs: number): MacroCommand {
		return createBatchMoveByCommand(this.app, this.bundle, filePaths, offsetMs);
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
