import { Notice } from "obsidian";

import { HistoryStack } from "../history-stack";
import type { Command } from "./command";

export interface CommandManagerOptions {
	maxHistorySize?: number;
	showNotices?: boolean;
}

const DEFAULT_MAX_HISTORY_SIZE = 50;

export class CommandManager {
	protected history: HistoryStack<Command>;
	private showNotices: boolean;

	constructor(options: CommandManagerOptions = {}) {
		this.history = new HistoryStack<Command>({
			maxSize: options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE,
		});
		this.showNotices = options.showNotices ?? false;
	}

	private notify(message: string): void {
		if (this.showNotices) {
			new Notice(message);
		}
	}

	async executeCommand(command: Command): Promise<void> {
		try {
			await command.execute();
			this.history.push(command);
		} catch (error) {
			console.error(`Failed to execute command: ${command.getType()}`, error);
			throw error;
		}
	}

	registerExecutedCommand(command: Command): void {
		this.history.push(command);
	}

	async undo(): Promise<boolean> {
		const command = this.history.current();
		if (!command) {
			this.notify("Nothing to undo");
			return false;
		}

		try {
			if (command.canUndo && !(await command.canUndo())) {
				console.warn(`Cannot undo command: ${command.getType()} - referenced resources no longer exist`);
				this.notify("Cannot undo: state has changed");
				this.history.dropCurrent();
				return false;
			}

			await command.undo();
			this.history.retreat();
			this.notify(`Undid: ${command.getType()}`);
			return true;
		} catch (error) {
			console.error(`Failed to undo command: ${command.getType()}`, error);
			this.notify(`Failed to undo: ${command.getType()}`);
			this.history.dropCurrent();
			return false;
		}
	}

	async redo(): Promise<boolean> {
		const command = this.history.forward();
		if (!command) {
			this.notify("Nothing to redo");
			return false;
		}

		try {
			await command.execute();
			this.notify(`Redid: ${command.getType()}`);
			return true;
		} catch (error) {
			console.error(`Failed to redo command: ${command.getType()}`, error);
			this.notify(`Failed to redo: ${command.getType()}`);
			this.history.dropCurrent();
			return false;
		}
	}

	canUndo(): boolean {
		return this.history.hasCurrent();
	}

	canRedo(): boolean {
		return this.history.canGoForward();
	}

	clearHistory(): void {
		this.history.clear();
	}

	getUndoStackSize(): number {
		return this.history.appliedCount;
	}

	getRedoStackSize(): number {
		return this.history.forwardCount;
	}

	peekUndo(): string | null {
		return this.history.current()?.getType() ?? null;
	}

	peekRedo(): string | null {
		return this.history.peekForward()?.getType() ?? null;
	}
}
