import type { App } from "obsidian";
import type { CalendarBundle } from "../calendar-bundle";
import { MacroCommand } from "./command";
import { CloneEventCommand, DeleteEventCommand, MoveEventCommand } from "./event-commands";

export function createBatchDeleteCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const deleteCommands = filePaths.map((filePath) => new DeleteEventCommand(app, bundle, filePath));

	return new MacroCommand(deleteCommands);
}

export function createBatchMoveCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	startOffset: number,
	endOffset: number
): MacroCommand {
	const moveCommands = filePaths.map((filePath) => new MoveEventCommand(app, bundle, filePath, startOffset, endOffset));

	return new MacroCommand(moveCommands);
}

export function createBatchCloneCommand(
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

export function createBatchDuplicateCommand(app: App, bundle: CalendarBundle, filePaths: string[]): MacroCommand {
	const duplicateCommands = filePaths.map((filePath) => new CloneEventCommand(app, bundle, filePath));

	return new MacroCommand(duplicateCommands);
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
}
