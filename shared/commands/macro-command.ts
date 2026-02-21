import type { Command } from "./command";

export interface MacroCommandOptions {
	rollbackOnError?: boolean;
}

export class MacroCommand implements Command {
	private commands: Command[] = [];
	private executedCommands: Command[] = [];
	private executionErrors: Array<{ command: Command; error: Error }> = [];
	private rollbackOnError: boolean;

	constructor(commands: Command[] = [], options?: MacroCommandOptions) {
		this.commands = [...commands];
		this.rollbackOnError = options?.rollbackOnError ?? false;
	}

	static fromExecuted(executedCommands: Command[]): MacroCommand {
		const macro = new MacroCommand(executedCommands);
		macro.executedCommands = [...executedCommands];
		return macro;
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

	private async undoExecuted(): Promise<void> {
		for (let i = this.executedCommands.length - 1; i >= 0; i--) {
			const command = this.executedCommands[i];
			try {
				await command.undo();
			} catch (error) {
				console.error(`Failed to undo command ${command.getType()}:`, error);
			}
		}
		this.executedCommands = [];
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
