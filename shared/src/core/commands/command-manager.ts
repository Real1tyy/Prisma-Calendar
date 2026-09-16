import { Notice } from "obsidian";

import { PromiseQueue } from "../../utils/async/promise-queue";
import type { Command } from "./command";
import type { HistoryEntry } from "./history-entry";
import { HistoryLog, REDO, UNDO, type HistoryRecord, type ReplayDirection } from "./history-log";
import { HistoryPersistence, type HistoryPersistenceOptions } from "./history-persistence";
import { createMonotonicSequencer, type Sequencer } from "./sequencer";

export interface CommandManagerOptions {
	maxHistorySize?: number;
	showNotices?: boolean;
	/**
	 * Shared ordering source for `lastActivityOrder`. Pass the same instance to
	 * every manager a caller owns (e.g. one per calendar) to make their
	 * activity comparable across managers. Defaults to a private per-instance
	 * sequencer, so an un-injected manager never ranks against unrelated ones.
	 */
	sequencer?: Sequencer;
	/**
	 * When set, the history *log* (metadata only — see
	 * {@link import("./history-entry").PersistedHistorySchema}) survives a
	 * reload. Restored entries are non-replayable by construction.
	 */
	persistence?: HistoryPersistenceOptions;
}

const DEFAULT_MAX_HISTORY_SIZE = 100;

/**
 * Undo/redo over a {@link HistoryLog}.
 *
 * This class owns *orchestration* — serialization, notices, activity ordering,
 * and driving the persistence seam. The log owns the entries and every
 * traversal over them; {@link HistoryPersistence} owns durability.
 *
 * Undo and redo are one implementation parameterised by {@link ReplayDirection},
 * so `undo`/`redo`, `undoEntry`/`redoEntry` and `revertTo`/`restoreTo` are each
 * a single algorithm rather than a mirrored pair. Sequential `undo()`/`redo()`
 * resolve to "newest applied" / "oldest undone", which degrades exactly to the
 * cursor model this replaced.
 *
 * One deliberate departure from that model: a new command no longer truncates
 * undone entries. They stay in the log and stay individually redoable — the
 * point of selective replay. See
 * [[spec-operation-history-modal-with-selective-undo-redo-and-persisted-history-log]].
 */
export class CommandManager {
	private readonly log: HistoryLog;
	private readonly persistence: HistoryPersistence | null;
	private showNotices: boolean;
	private readonly sequencer: Sequencer;
	private activityOrder = 0;
	private readonly listeners = new Set<() => void>();
	// Every history-mutating method routes through this queue so a second
	// invocation arriving while the first is still in flight (palette callbacks
	// are registered with `void cmd().then(...)` — Obsidian ignores the return
	// value, so two quick Ctrl+Z presses both call into here before the first
	// settles) waits its turn instead of racing the shared history state and
	// the underlying command state. Without this, concurrent undos on a
	// MacroCommand can read the same entry and re-enter `undoExecuted`
	// against the same `executedCommands` array — the first call's reset wipes
	// the slot the second is iterating, surfacing as `command.getType()` on
	// undefined. registerExecutedCommand and clearHistory are queued for the
	// same reason: a record/clear racing an in-flight undo would mutate the
	// log mid-iteration.
	private readonly queue = new PromiseQueue();

	constructor(options: CommandManagerOptions = {}) {
		this.log = new HistoryLog(options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE);
		this.showNotices = options.showNotices ?? false;
		this.sequencer = options.sequencer ?? createMonotonicSequencer();

		this.persistence = options.persistence ? new HistoryPersistence(options.persistence) : null;
		const stored = this.persistence?.load();
		if (stored) this.log.restore(stored);
	}

	private notify(message: string): void {
		if (this.showNotices) {
			new Notice(message);
		}
	}

	private markActivity(): void {
		this.activityOrder = this.sequencer.next();
	}

	/**
	 * Strictly-increasing stamp of the last history mutation (execute / register /
	 * undo / redo). Higher means more recent. `0` means this manager has never
	 * been touched. Compare across managers to find the most recently active one.
	 */
	get lastActivityOrder(): number {
		return this.activityOrder;
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

	// ─── History log ─────────────────────────────────────────────

	/** Recorded operations, oldest → newest. Entries are copies; mutating them is a no-op. */
	getHistory(): readonly HistoryEntry[] {
		return this.log.view();
	}

	/** Subscribe to history mutations (push / undo / redo / clear). Returns an unsubscribe. */
	onHistoryChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private changed(): void {
		for (const listener of this.listeners) listener();
		this.persistence?.schedule(() => this.log.snapshot());
	}

	// ─── Execution ───────────────────────────────────────────────

	executeCommand(command: Command): Promise<void> {
		return this.queue.enqueue(() => this.doExecuteCommand(command));
	}

	private async doExecuteCommand(command: Command): Promise<void> {
		try {
			await command.execute();
			this.record(command);
		} catch (error) {
			console.error(`Failed to execute command: ${command.getType()}`, error);
			throw error;
		}
	}

	registerExecutedCommand(command: Command): Promise<void> {
		return this.queue.enqueue(() => {
			this.record(command);
			return Promise.resolve();
		});
	}

	private record(command: Command): void {
		this.log.record(command);
		this.markActivity();
		this.changed();
	}

	// ─── Undo / redo ─────────────────────────────────────────────

	undo(): Promise<boolean> {
		return this.step(UNDO);
	}

	redo(): Promise<boolean> {
		return this.step(REDO);
	}

	/** Undo one entry by id, leaving every other entry's applied state untouched. */
	undoEntry(id: string): Promise<boolean> {
		return this.stepEntry(id, UNDO);
	}

	/** Re-execute one undone entry by id, leaving every other entry alone. */
	redoEntry(id: string): Promise<boolean> {
		return this.stepEntry(id, REDO);
	}

	/**
	 * Undo every applied entry from the newest down to and including `id` —
	 * newest-first, so dependent operations unwind in the order they were
	 * applied. Returns how many were undone.
	 */
	revertTo(id: string): Promise<number> {
		return this.stepSpan(id, UNDO);
	}

	/**
	 * Re-execute every undone entry from the oldest up to and including `id`,
	 * oldest-first so they re-apply in their original order. Returns how many
	 * were re-applied.
	 */
	restoreTo(id: string): Promise<number> {
		return this.stepSpan(id, REDO);
	}

	private step(direction: ReplayDirection): Promise<boolean> {
		return this.queue.enqueue(async () => {
			const record = this.log.next(direction);
			if (!record) {
				this.notify(`Nothing to ${direction.verb}`);
				return false;
			}
			return await this.replay(record, direction);
		});
	}

	private stepEntry(id: string, direction: ReplayDirection): Promise<boolean> {
		return this.queue.enqueue(async () => {
			const record = this.log.byId(id);
			if (!record || record.meta.applied !== direction.actsOn) return false;
			return await this.replay(record, direction);
		});
	}

	private stepSpan(id: string, direction: ReplayDirection): Promise<number> {
		return this.queue.enqueue(async () => {
			const records = this.log.span(id, direction);
			if (!records) return 0;

			let done = 0;
			for (const record of records) {
				if (await this.replay(record, direction, { silent: true })) done++;
			}
			this.notify(done === 0 ? `Nothing to ${direction.spanVerb}` : `${direction.spanPast} ${done} operation(s)`);
			return done;
		});
	}

	/**
	 * Run one entry in one direction. `silent` suppresses the per-entry notice so
	 * a span reports a single aggregate instead of one Notice per operation.
	 */
	private async replay(
		record: HistoryRecord,
		direction: ReplayDirection,
		options?: { silent?: boolean }
	): Promise<boolean> {
		const { command, meta } = record;
		if (!command || !meta.replayable) return false;

		try {
			if (!(await direction.canRun(command))) {
				console.warn(`Cannot ${direction.verb} command: ${meta.type} - referenced resources no longer exist`);
				if (!options?.silent) this.notify(`Cannot ${direction.verb}: state has changed`);
				this.log.markBroken(record);
				this.changed();
				return false;
			}

			await direction.run(command);
			this.log.markReplayed(record, direction);
			this.markActivity();
			if (!options?.silent) this.notify(`${direction.past}: ${meta.description}`);
			this.changed();
			return true;
		} catch (error) {
			console.error(`Failed to ${direction.verb} command: ${meta.type}`, error);
			if (!options?.silent) this.notify(`Failed to ${direction.verb}: ${meta.description}`);
			// Keep the entry as a record of what happened, but stop offering a
			// replay: the command threw mid-flight, so the state it was tracking
			// is no longer one we can reason about.
			this.log.markBroken(record);
			this.changed();
			return false;
		}
	}

	// ─── Queries ─────────────────────────────────────────────────

	canUndo(): boolean {
		return this.log.next(UNDO) !== null;
	}

	canRedo(): boolean {
		return this.log.next(REDO) !== null;
	}

	/** Entries that could still be undone — restored/broken entries don't count. */
	getUndoStackSize(): number {
		return this.log.count(UNDO);
	}

	/** Entries that could still be redone — restored/broken entries don't count. */
	getRedoStackSize(): number {
		return this.log.count(REDO);
	}

	peekUndo(): string | null {
		return this.log.next(UNDO)?.meta.type ?? null;
	}

	peekRedo(): string | null {
		return this.log.next(REDO)?.meta.type ?? null;
	}

	// ─── Lifecycle ───────────────────────────────────────────────

	/** Erase the log — in memory *and* on disk. A user-facing "clear", not a teardown. */
	clearHistory(): Promise<void> {
		return this.queue.enqueue(() => {
			this.log.clear();
			// Notify directly rather than through `changed()`: this must not
			// schedule a write of the log it is erasing. `clear()` also discards
			// any write already queued by an earlier mutation.
			for (const listener of this.listeners) listener();
			this.persistence?.clear();
			return Promise.resolve();
		});
	}

	/**
	 * Teardown: flush any pending write and drop in-memory state, **keeping** the
	 * persisted log. Unloading a plugin must not erase the history it just wrote —
	 * call this from `destroy()`, never `clearHistory()`.
	 */
	dispose(): void {
		this.flushPersistence();
		this.listeners.clear();
		this.log.clear();
	}

	/** Write any pending debounced history immediately. */
	flushPersistence(): void {
		this.persistence?.flush();
	}
}
