import { Notice } from "obsidian";

import { PromiseQueue } from "../../utils/async/promise-queue";
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
	// Every history-mutating method routes through this queue so a second
	// invocation arriving while the first is still in flight (palette callbacks
	// are registered with `void cmd().then(...)` — Obsidian ignores the return
	// value, so two quick Ctrl+Z presses both call into here before the first
	// settles) waits its turn instead of racing the shared history cursor and
	// the underlying command state. Without this, concurrent undos on a
	// MacroCommand can read the same `current()` and re-enter `undoExecuted`
	// against the same `executedCommands` array — the first call's reset wipes
	// the slot the second is iterating, surfacing as `command.getType()` on
	// undefined. registerExecutedCommand and clearHistory are queued for the
	// same reason: a record/clear racing an in-flight undo would mutate the
	// stack mid-iteration.
	private readonly queue = new PromiseQueue();

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

	/**
	 * Resolves once every queued executeCommand / undo / redo / register /
	 * clear has settled. Use from tests to bridge the gap between palette
	 * fire-and-forget callbacks and the underlying async work — production
	 * code shouldn't need it.
	 */
	whenIdle(): Promise<void> {
		return this.queue.whenIdle();
	}

	executeCommand(command: Command): Promise<void> {
		return this.queue.enqueue(() => this.doExecuteCommand(command));
	}

	private async doExecuteCommand(command: Command): Promise<void> {
		try {
			await command.execute();
			this.history.push(command);
		} catch (error) {
			console.error(`Failed to execute command: ${command.getType()}`, error);
			throw error;
		}
	}

	registerExecutedCommand(command: Command): Promise<void> {
		return this.queue.enqueue(async () => {
			this.history.push(command);
		});
	}

	undo(): Promise<boolean> {
		return this.queue.enqueue(() => this.doUndo());
	}

	private async doUndo(): Promise<boolean> {
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

	redo(): Promise<boolean> {
		return this.queue.enqueue(() => this.doRedo());
	}

	private async doRedo(): Promise<boolean> {
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

	clearHistory(): Promise<void> {
		return this.queue.enqueue(async () => {
			this.history.clear();
		});
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
