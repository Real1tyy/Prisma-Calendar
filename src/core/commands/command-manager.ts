import { COMMANDS_HISTORY_LIMIT } from "src/types/settings-schemas";
import type { Command } from "./command";

/**
 * Manages command history and provides undo/redo functionality for a calendar.
 *
 * Each CalendarBundle gets its own CommandManager to maintain separate
 * undo/redo stacks per calendar.
 */
export class CommandManager {
	private undoStack: Command[] = [];
	private redoStack: Command[] = [];
	private maxHistorySize: number;

	constructor(maxHistorySize = COMMANDS_HISTORY_LIMIT) {
		this.maxHistorySize = maxHistorySize;
	}

	/**
	 * Execute a command and add it to the undo stack.
	 * Clears the redo stack since we're creating a new branch of history.
	 */
	async executeCommand(command: Command): Promise<void> {
		try {
			await command.execute();

			this.undoStack.push(command);

			// Clear redo stack - we've created a new branch
			this.redoStack = [];

			if (this.undoStack.length > this.maxHistorySize) {
				this.undoStack.shift();
			}
		} catch (error) {
			console.error(`Failed to execute command: ${command.getType()}`, error);
			throw error;
		}
	}

	async undo(): Promise<boolean> {
		const command = this.undoStack.pop();
		if (!command) return false;

		try {
			if (command.canUndo && !(await command.canUndo())) {
				console.warn(`Cannot undo command: ${command.getType()} - referenced resources no longer exist`);
				return false;
			}

			await command.undo();
			this.redoStack.push(command);
			return true;
		} catch (error) {
			console.error(`Failed to undo command: ${command.getType()}`, error);
			return false;
		}
	}

	async redo(): Promise<boolean> {
		const command = this.redoStack.pop();
		if (!command) return false;

		try {
			await command.execute();
			this.undoStack.push(command);
			return true;
		} catch (error) {
			console.error(`Failed to redo command: ${command.getType()}`, error);
			return false;
		}
	}

	clearHistory(): void {
		this.undoStack = [];
		this.redoStack = [];
	}
}
