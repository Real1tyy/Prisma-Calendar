import type { Command } from "./command";

export function batchCommand(filePaths: string[], createOne: (filePath: string) => Command): MacroCommand {
	return new MacroCommand(filePaths.map(createOne));
}

export interface MacroCommandOptions {
	rollbackOnError?: boolean;
	/**
	 * Treat the supplied `commands` as already-executed — populate
	 * `executedCommands` immediately so the macro can be undone without first
	 * calling `execute()`. Use for wrapping commands that ran outside the
	 * macro (e.g. concurrent batch runners that report their own successes).
	 */
	markExecuted?: boolean;
}

export class MacroCommand implements Command {
	private commands: Command[] = [];
	private executedCommands: Command[] = [];
	private executionErrors: Array<{ command: Command; error: Error }> = [];
	private rollbackOnError: boolean;

	constructor(commands: Command[] = [], options?: MacroCommandOptions) {
		this.commands = [...commands];
		this.rollbackOnError = options?.rollbackOnError ?? false;
		if (options?.markExecuted) {
			this.executedCommands = [...this.commands];
		}
	}

	addCommand(command: Command): void {
		this.commands.push(command);
	}

	async execute(): Promise<void> {
		this.executedCommands = [];
		this.executionErrors = [];

		for (const command of this.commands) {
			try {
				await command.execute();
				this.executedCommands.push(command);
			} catch (error) {
				if (this.rollbackOnError) {
					await this.undoExecuted();
					throw error;
				}

				const errorObj = error instanceof Error ? error : new Error(String(error));
				this.executionErrors.push({ command, error: errorObj });
				console.warn(`Command ${command.getType()} failed:`, errorObj.message);
			}
		}

		if (this.executionErrors.length > 0) {
			const successCount = this.executedCommands.length;
			const failCount = this.executionErrors.length;
			const totalCount = this.commands.length;

			if (successCount === 0) {
				throw new Error(`All ${totalCount} operations failed`);
			}

			const errorMessages = this.executionErrors.map((e) => e.error.message).join("; ");
			throw new Error(`Completed ${successCount}/${totalCount} operations. ${failCount} failed: ${errorMessages}`);
		}
	}

	async undo(): Promise<void> {
		await this.undoExecuted();
	}

	async undoWithProgress(onProgress: (completed: number, total: number) => void): Promise<void> {
		await this.undoExecuted(onProgress);
	}

	async executeWithProgress(onProgress: (completed: number, total: number) => void): Promise<void> {
		this.executedCommands = [];
		this.executionErrors = [];
		const total = this.commands.length;

		for (let i = 0; i < total; i++) {
			const command = this.commands[i];
			try {
				await command.execute();
				this.executedCommands.push(command);
			} catch (error) {
				if (this.rollbackOnError) {
					await this.undoExecuted();
					throw error;
				}
				const errorObj = error instanceof Error ? error : new Error(String(error));
				this.executionErrors.push({ command, error: errorObj });
				console.warn(`Command ${command.getType()} failed:`, errorObj.message);
			}
			onProgress(i + 1, total);
		}
	}

	private async undoExecuted(onProgress?: (completed: number, total: number) => void): Promise<void> {
		// Snapshot the array before iterating: if anything mutates
		// `this.executedCommands` mid-await (concurrent execute() resetting it,
		// or a child's undo dispatching back through the command pipeline),
		// the local copy keeps `command` defined for every index. The wipe at
		// the end runs only against the original slots we owned.
		const toUndo = this.executedCommands;
		this.executedCommands = [];
		const total = toUndo.length;
		for (let i = total - 1; i >= 0; i--) {
			const command = toUndo[i];
			try {
				await command.undo();
			} catch (error) {
				console.error(`Failed to undo command ${command.getType()}:`, error);
			}
			onProgress?.(total - i, total);
		}
	}

	getType(): string {
		return "MacroCommand";
	}

	async canUndo(): Promise<boolean> {
		if (this.executedCommands.length === 0) {
			return false;
		}

		for (const command of this.executedCommands) {
			if (command.canUndo) {
				const canUndo = await command.canUndo();
				if (!canUndo) {
					return false;
				}
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

	getCommandCount(): number {
		return this.commands.length;
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
