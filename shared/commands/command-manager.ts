import { Notice } from "obsidian";
import type { Command } from "./command";

export interface CommandManagerOptions {
	maxHistorySize?: number;
	showNotices?: boolean;
}

export class CommandManager {
	protected undoStack: Command[] = [];
	protected redoStack: Command[] = [];
	protected maxHistorySize: number;
	private showNotices: boolean;

	constructor(options?: CommandManagerOptions);
	constructor(maxHistorySize?: number);
	constructor(optionsOrSize?: CommandManagerOptions | number) {
		if (typeof optionsOrSize === "object") {
			this.maxHistorySize = optionsOrSize.maxHistorySize ?? 50;
			this.showNotices = optionsOrSize.showNotices ?? false;
		} else {
			this.maxHistorySize = optionsOrSize ?? 50;
			this.showNotices = false;
		}
	}

	private notify(message: string): void {
		if (this.showNotices) {
			new Notice(message);
		}
	}

	setMaxHistorySize(size: number): void {
		this.maxHistorySize = size;

		while (this.undoStack.length > this.maxHistorySize) {
			this.undoStack.shift();
		}
	}

	async executeCommand(command: Command): Promise<void> {
		try {
			await command.execute();

			this.undoStack.push(command);
			this.redoStack = [];

			if (this.undoStack.length > this.maxHistorySize) {
				this.undoStack.shift();
			}
		} catch (error) {
			console.error(`Failed to execute command: ${command.getType()}`, error);
			throw error;
		}
	}

	registerExecutedCommand(command: Command): void {
		this.undoStack.push(command);
		this.redoStack = [];

		if (this.undoStack.length > this.maxHistorySize) {
			this.undoStack.shift();
		}
	}

	async undo(): Promise<boolean> {
		const command = this.undoStack.pop();
		if (!command) {
			this.notify("Nothing to undo");
			return false;
		}

		try {
			if (command.canUndo && !(await command.canUndo())) {
				console.warn(`Cannot undo command: ${command.getType()} - referenced resources no longer exist`);
				this.notify("Cannot undo: state has changed");
				return false;
			}

			await command.undo();
			this.redoStack.push(command);
			this.notify(`Undid: ${command.getType()}`);
			return true;
		} catch (error) {
			console.error(`Failed to undo command: ${command.getType()}`, error);
			this.notify(`Failed to undo: ${command.getType()}`);
			return false;
		}
	}

	async redo(): Promise<boolean> {
		const command = this.redoStack.pop();
		if (!command) {
			this.notify("Nothing to redo");
			return false;
		}

		try {
			await command.execute();
			this.undoStack.push(command);
			this.notify(`Redid: ${command.getType()}`);
			return true;
		} catch (error) {
			console.error(`Failed to redo command: ${command.getType()}`, error);
			this.notify(`Failed to redo: ${command.getType()}`);
			return false;
		}
	}

	canUndo(): boolean {
		return this.undoStack.length > 0;
	}

	canRedo(): boolean {
		return this.redoStack.length > 0;
	}

	clearHistory(): void {
		this.undoStack = [];
		this.redoStack = [];
	}

	getUndoStackSize(): number {
		return this.undoStack.length;
	}

	getRedoStackSize(): number {
		return this.redoStack.length;
	}

	peekUndo(): string | null {
		if (this.undoStack.length === 0) {
			return null;
		}
		return this.undoStack[this.undoStack.length - 1].getType();
	}

	peekRedo(): string | null {
		if (this.redoStack.length === 0) {
			return null;
		}
		return this.redoStack[this.redoStack.length - 1].getType();
	}
}
