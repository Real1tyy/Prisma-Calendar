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

	constructor(maxHistorySize = 50) {
		this.maxHistorySize = maxHistorySize;
	}

	/**
	 * Execute a command and add it to the undo stack.
	 * Clears the redo stack since we're creating a new branch of history.
	 */
	async executeCommand(command: Command): Promise<void> {
		try {
			await command.execute();

			// Add to undo stack
			this.undoStack.push(command);

			// Clear redo stack - we've created a new branch
			this.redoStack = [];

			// Maintain max history size
			if (this.undoStack.length > this.maxHistorySize) {
				this.undoStack.shift();
			}

			this.notifyHistoryChanged();
		} catch (error) {
			console.error(`Failed to execute command: ${command.getDescription()}`, error);
			throw error;
		}
	}

	/**
	 * Undo the most recent command.
	 * Moves the command from undo stack to redo stack.
	 */
	async undo(): Promise<boolean> {
		const command = this.undoStack.pop();
		if (!command) return false;

		try {
			// Check if command can still be undone
			if (command.canUndo && !(await command.canUndo())) {
				console.warn(
					`Cannot undo command: ${command.getDescription()} - referenced resources no longer exist`
				);
				this.notifyHistoryChanged();
				return false;
			}

			await command.undo();
			this.redoStack.push(command);
			this.notifyHistoryChanged();
			return true;
		} catch (error) {
			console.error(`Failed to undo command: ${command.getDescription()}`, error);
			// Put command back on undo stack
			this.undoStack.push(command);
			throw error;
		}
	}

	/**
	 * Redo the most recently undone command.
	 * Moves the command from redo stack back to undo stack.
	 */
	async redo(): Promise<boolean> {
		const command = this.redoStack.pop();
		if (!command) return false;

		try {
			await command.execute();
			this.undoStack.push(command);
			this.notifyHistoryChanged();
			return true;
		} catch (error) {
			console.error(`Failed to redo command: ${command.getDescription()}`, error);
			// Put command back on redo stack
			this.redoStack.push(command);
			throw error;
		}
	}

	/**
	 * Check if undo is available.
	 */
	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	/**
	 * Check if redo is available.
	 */
	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	/**
	 * Get description of the next command that would be undone.
	 */
	getUndoDescription(): string | null {
		const command = this.undoStack[this.undoStack.length - 1];
		return command ? command.getDescription() : null;
	}

	/**
	 * Get description of the next command that would be redone.
	 */
	getRedoDescription(): string | null {
		const command = this.redoStack[this.redoStack.length - 1];
		return command ? command.getDescription() : null;
	}

	/**
	 * Clear all command history.
	 * Useful when calendar is reset or major changes occur.
	 */
	clearHistory(): void {
		this.undoStack = [];
		this.redoStack = [];
		this.notifyHistoryChanged();
	}

	/**
	 * Get current history state for debugging.
	 */
	getHistoryState(): {
		undoCount: number;
		redoCount: number;
		undoDescriptions: string[];
		redoDescriptions: string[];
	} {
		return {
			undoCount: this.undoStack.length,
			redoCount: this.redoStack.length,
			undoDescriptions: this.undoStack.map((cmd) => cmd.getDescription()),
			redoDescriptions: this.redoStack.map((cmd) => cmd.getDescription()),
		};
	}

	/**
	 * Notify listeners that command history has changed.
	 * Can be extended to trigger UI updates.
	 */
	private notifyHistoryChanged(): void {
		// Emit custom event for UI updates
		window.dispatchEvent(
			new CustomEvent("calendar-history-changed", {
				detail: {
					canUndo: this.canUndo(),
					canRedo: this.canRedo(),
					undoDescription: this.getUndoDescription(),
					redoDescription: this.getRedoDescription(),
				},
			})
		);
	}
}
