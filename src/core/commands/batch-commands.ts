import type { App } from "obsidian";
import type { CalendarBundle } from "../calendar-bundle";
import { MacroCommand } from "./command";
import { CloneEventCommand, DeleteEventCommand, MoveEventCommand } from "./event-commands";

/**
 * Utility functions for creating batch commands from calendar operations.
 * These functions group multiple individual commands into single undoable units.
 */

/**
 * Create a batch delete command for multiple events.
 * All deletions are grouped into a single undoable operation.
 */
export function createBatchDeleteCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[]
): MacroCommand {
	const deleteCommands = filePaths.map((filePath) => new DeleteEventCommand(app, bundle, filePath));

	return new MacroCommand(
		`Delete ${filePaths.length} Event${filePaths.length === 1 ? "" : "s"}`,
		deleteCommands
	);
}

/**
 * Create a batch move command for multiple events.
 * All moves are grouped into a single undoable operation.
 */
export function createBatchMoveCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	startOffset: number,
	endOffset: number,
	weeks: number
): MacroCommand {
	const direction = weeks > 0 ? "Next" : "Previous";
	const weekCount = Math.abs(weeks);
	const weekText = weekCount === 1 ? "Week" : `${weekCount} Weeks`;

	const moveCommands = filePaths.map(
		(filePath) =>
			new MoveEventCommand(
				app,
				bundle,
				filePath,
				startOffset,
				endOffset,
				`Move Event to ${direction} ${weekText}`
			)
	);

	return new MacroCommand(
		`Move ${filePaths.length} Event${filePaths.length === 1 ? "" : "s"} to ${direction} ${weekText}`,
		moveCommands
	);
}

/**
 * Create a batch clone command for multiple events.
 * All clones are grouped into a single undoable operation.
 */
export function createBatchCloneCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[],
	startOffset: number,
	endOffset: number,
	weeks: number
): MacroCommand {
	const direction = weeks > 0 ? "Next" : "Previous";
	const weekCount = Math.abs(weeks);
	const weekText = weekCount === 1 ? "Week" : `${weekCount} Weeks`;

	const cloneCommands = filePaths.map(
		(filePath) =>
			new CloneEventCommand(
				app,
				bundle,
				filePath,
				startOffset,
				endOffset,
				`Clone Event to ${direction} ${weekText}`
			)
	);

	return new MacroCommand(
		`Clone ${filePaths.length} Event${filePaths.length === 1 ? "" : "s"} to ${direction} ${weekText}`,
		cloneCommands
	);
}

/**
 * Create a batch duplicate command for multiple events.
 * Creates copies in the same location with modified filenames.
 */
export function createBatchDuplicateCommand(
	app: App,
	bundle: CalendarBundle,
	filePaths: string[]
): MacroCommand {
	// Duplicate means clone with no time offset (same time/date)
	const duplicateCommands = filePaths.map(
		(filePath) =>
			new CloneEventCommand(
				app,
				bundle,
				filePath,
				0, // No start offset
				0, // No end offset
				"Duplicate Event"
			)
	);

	return new MacroCommand(
		`Duplicate ${filePaths.length} Event${filePaths.length === 1 ? "" : "s"}`,
		duplicateCommands
	);
}

/**
 * Helper function to calculate time offsets for week-based operations.
 * Returns [startOffset, endOffset] in milliseconds.
 */
export function calculateWeekOffsets(weeks: number): [number, number] {
	const weekInMs = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
	const offset = weeks * weekInMs;
	return [offset, offset]; // Both start and end get the same offset
}

/**
 * Batch command factory that provides a unified interface for creating
 * batch operations from calendar views.
 */
export class BatchCommandFactory {
	constructor(
		private app: App,
		private bundle: CalendarBundle
	) {}

	/**
	 * Create a batch delete command.
	 */
	createDelete(filePaths: string[]): MacroCommand {
		return createBatchDeleteCommand(this.app, this.bundle, filePaths);
	}

	/**
	 * Create a batch duplicate command.
	 */
	createDuplicate(filePaths: string[]): MacroCommand {
		return createBatchDuplicateCommand(this.app, this.bundle, filePaths);
	}

	/**
	 * Create a batch move command.
	 */
	createMove(filePaths: string[], weeks: number): MacroCommand {
		const [startOffset, endOffset] = calculateWeekOffsets(weeks);
		return createBatchMoveCommand(this.app, this.bundle, filePaths, startOffset, endOffset, weeks);
	}

	/**
	 * Create a batch clone command.
	 */
	createClone(filePaths: string[], weeks: number): MacroCommand {
		const [startOffset, endOffset] = calculateWeekOffsets(weeks);
		return createBatchCloneCommand(this.app, this.bundle, filePaths, startOffset, endOffset, weeks);
	}
}
