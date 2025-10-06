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
 *
 * Executes commands individually and continues on failure, collecting errors
 * to report at the end. Only successfully executed commands are tracked for undo.
 */
export class MacroCommand implements Command {
	private commands: Command[] = [];
	private executedCommands: Command[] = [];
	private executionErrors: Array<{ command: Command; error: Error }> = [];

	constructor(commands: Command[] = []) {
		this.commands = [...commands];
	}

	addCommand(command: Command): void {
		this.commands.push(command);
	}

	async execute(): Promise<void> {
		this.executedCommands = [];
		this.executionErrors = [];

		// Execute all commands, continuing on failure
		for (const command of this.commands) {
			try {
				await command.execute();
				this.executedCommands.push(command);
			} catch (error) {
				const errorObj = error instanceof Error ? error : new Error(String(error));
				this.executionErrors.push({ command, error: errorObj });
				console.warn(`Command ${command.getType()} failed:`, errorObj.message);
			}
		}

		// If some commands failed, throw an error with details
		if (this.executionErrors.length > 0) {
			const successCount = this.executedCommands.length;
			const failCount = this.executionErrors.length;
			const totalCount = this.commands.length;

			if (successCount === 0) {
				// All commands failed
				throw new Error(`All ${totalCount} operations failed`);
			}

			// Some commands succeeded, some failed
			const errorMessages = this.executionErrors.map((e) => e.error.message).join("; ");
			throw new Error(`Completed ${successCount}/${totalCount} operations. ${failCount} failed: ${errorMessages}`);
		}
	}

	async undo(): Promise<void> {
		// Only undo commands that were successfully executed
		for (let i = this.executedCommands.length - 1; i >= 0; i--) {
			await this.executedCommands[i].undo();
		}
	}

	getType(): string {
		return "macro";
	}

	async canUndo(): Promise<boolean> {
		// Only check commands that were successfully executed
		for (const command of this.executedCommands) {
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

	getExecutionSummary(): {
		successCount: number;
		failCount: number;
		errors: Array<{ command: Command; error: Error }>;
	} {
		return {
			successCount: this.executedCommands.length,
			failCount: this.executionErrors.length,
			errors: [...this.executionErrors],
		};
	}
}
