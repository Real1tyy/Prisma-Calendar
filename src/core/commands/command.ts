/**
 * Base Command interface for invertible calendar operations.
 *
 * Each command encapsulates an action that can be executed and undone,
 * providing semantic undo functionality for calendar operations.
 */
export interface Command {
	/**
	 * Execute the command operation.
	 * Should be idempotent - safe to call multiple times.
	 */
	execute(): Promise<void>;

	/**
	 * Undo the command operation, restoring previous state.
	 * Should be idempotent and inverse of execute().
	 */
	undo(): Promise<void>;

	/**
	 * Human-readable description of the command for UI display.
	 * Examples: "Create Event", "Delete 3 Events", "Move Event to Next Week"
	 */
	getDescription(): string;

	/**
	 * Unique identifier for the command type.
	 * Used for debugging and potential command filtering.
	 */
	getType(): string;

	/**
	 * Optional: Check if the command can still be undone.
	 * Returns false if referenced files/events no longer exist.
	 */
	canUndo?(): Promise<boolean>;
}

/**
 * Macro command that groups multiple commands into a single undoable unit.
 * Perfect for batch operations where multiple events are modified together.
 */
export class MacroCommand implements Command {
	private commands: Command[] = [];

	constructor(
		private description: string,
		commands: Command[] = []
	) {
		this.commands = [...commands];
	}

	addCommand(command: Command): void {
		this.commands.push(command);
	}

	async execute(): Promise<void> {
		// Execute all commands in order
		for (const command of this.commands) {
			await command.execute();
		}
	}

	async undo(): Promise<void> {
		// Undo all commands in reverse order
		for (let i = this.commands.length - 1; i >= 0; i--) {
			await this.commands[i].undo();
		}
	}

	getDescription(): string {
		if (this.commands.length === 0) return this.description;
		if (this.commands.length === 1) return this.commands[0].getDescription();
		return `${this.description} (${this.commands.length} operations)`;
	}

	getType(): string {
		return "macro";
	}

	async canUndo(): Promise<boolean> {
		// All sub-commands must be undoable
		for (const command of this.commands) {
			if (command.canUndo && !(await command.canUndo())) {
				return false;
			}
		}
		return true;
	}

	getCommands(): readonly Command[] {
		return [...this.commands];
	}

	isEmpty(): boolean {
		return this.commands.length === 0;
	}
}
