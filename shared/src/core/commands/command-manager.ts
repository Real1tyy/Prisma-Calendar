import { Notice } from "obsidian";

import { PromiseQueue } from "../../utils/async/promise-queue";
import { LocalKV, type KVBackend } from "../storage/local-kv";
import type { Command } from "./command";
import {
	humanizeCommandType,
	MAX_DESCRIPTION_LENGTH,
	PersistedHistorySchema,
	type HistoryEntry,
	type PersistedHistory,
} from "./history-entry";
import { createMonotonicSequencer, type Sequencer } from "./sequencer";

export interface HistoryPersistenceOptions {
	/** `LocalKV` namespace — convention `"<plugin-id>:<feature>:<purpose>"`. */
	namespace: string;
	/** Key within the namespace; one history log per scope (e.g. a calendar id). */
	scope: string;
	/** Back-end override; omit in production (falls through to `window.localStorage`). */
	backend?: KVBackend;
	/** Trailing-debounce window for writes. */
	debounceMs?: number;
}

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
const DEFAULT_PERSIST_DEBOUNCE_MS = 250;

interface HistoryRecord {
	meta: {
		id: string;
		type: string;
		description: string;
		timestamp: number;
		applied: boolean;
		replayable: boolean;
	};
	/** `null` ⇒ restored from storage; the live command didn't survive the session. */
	command: Command | null;
}

/**
 * Undo/redo over a linear log of {@link HistoryEntry} records.
 *
 * The history is a list with a per-entry `applied` flag rather than a single
 * cursor, which is what makes *selective* undo possible: undoing the 20th-last
 * operation flips that one entry and leaves the other nineteen applied.
 * Sequential `undo()`/`redo()` are defined on top of the flags (newest applied /
 * oldest undone), so a pure push/undo/redo sequence behaves exactly like the
 * cursor model it replaced.
 *
 * One deliberate departure: a new command no longer truncates undone entries.
 * They stay in the log and stay individually redoable — the point of selective
 * replay. See [[spec-operation-history-modal-with-selective-undo-redo-and-persisted-history-log]].
 */
export class CommandManager {
	private entries: HistoryRecord[] = [];
	private nextId = 0;
	private showNotices: boolean;
	private readonly maxHistorySize: number;
	private readonly sequencer: Sequencer;
	private activityOrder = 0;
	private readonly listeners = new Set<() => void>();
	private readonly kv: LocalKV<PersistedHistory> | null = null;
	private readonly persistScope: string = "";
	private readonly persistDebounceMs: number = DEFAULT_PERSIST_DEBOUNCE_MS;
	private persistTimer: ReturnType<typeof setTimeout> | null = null;
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
		this.maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
		this.showNotices = options.showNotices ?? false;
		this.sequencer = options.sequencer ?? createMonotonicSequencer();

		if (options.persistence) {
			const { namespace, scope, backend, debounceMs } = options.persistence;
			this.kv = new LocalKV<PersistedHistory>({
				namespace,
				schema: PersistedHistorySchema,
				...(backend ? { backend } : {}),
			});
			this.persistScope = scope;
			this.persistDebounceMs = debounceMs ?? DEFAULT_PERSIST_DEBOUNCE_MS;
			this.hydrate();
		}
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
		return this.entries.map((record) => ({ ...record.meta }));
	}

	/** Subscribe to history mutations (push / undo / redo / clear). Returns an unsubscribe. */
	onHistoryChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private changed(): void {
		for (const listener of this.listeners) listener();
		this.schedulePersist();
	}

	private describe(command: Command): string {
		const raw = command.describe?.() ?? humanizeCommandType(command.getType());
		return raw.length > MAX_DESCRIPTION_LENGTH ? `${raw.slice(0, MAX_DESCRIPTION_LENGTH - 1)}…` : raw;
	}

	private record(command: Command): void {
		this.entries.push({
			command,
			meta: {
				id: String(this.nextId++),
				type: command.getType(),
				description: this.describe(command),
				timestamp: Date.now(),
				applied: true,
				replayable: true,
			},
		});
		if (this.entries.length > this.maxHistorySize) {
			this.entries.splice(0, this.entries.length - this.maxHistorySize);
		}
		this.markActivity();
		this.changed();
	}

	private findUndoable(): HistoryRecord | null {
		for (let i = this.entries.length - 1; i >= 0; i--) {
			const record = this.entries[i];
			if (record.meta.applied && record.meta.replayable) return record;
		}
		return null;
	}

	private findRedoable(): HistoryRecord | null {
		for (const record of this.entries) {
			if (!record.meta.applied && record.meta.replayable) return record;
		}
		return null;
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

	// ─── Undo / redo ─────────────────────────────────────────────

	undo(): Promise<boolean> {
		return this.queue.enqueue(async () => {
			const record = this.findUndoable();
			if (!record) {
				this.notify("Nothing to undo");
				return false;
			}
			return await this.applyUndo(record);
		});
	}

	redo(): Promise<boolean> {
		return this.queue.enqueue(async () => {
			const record = this.findRedoable();
			if (!record) {
				this.notify("Nothing to redo");
				return false;
			}
			return await this.applyRedo(record);
		});
	}

	/** Undo one entry by id, leaving every other entry's applied state untouched. */
	undoEntry(id: string): Promise<boolean> {
		return this.queue.enqueue(async () => {
			const record = this.entries.find((entry) => entry.meta.id === id);
			if (!record || !record.meta.applied) return false;
			return await this.applyUndo(record);
		});
	}

	/** Re-execute one undone entry by id, leaving every other entry alone. */
	redoEntry(id: string): Promise<boolean> {
		return this.queue.enqueue(async () => {
			const record = this.entries.find((entry) => entry.meta.id === id);
			if (!record || record.meta.applied) return false;
			return await this.applyRedo(record);
		});
	}

	/**
	 * Undo every applied entry from the newest down to and including `id` —
	 * newest-first, so dependent operations unwind in the order they were
	 * applied. Returns how many were undone.
	 */
	revertTo(id: string): Promise<number> {
		return this.queue.enqueue(async () => {
			const target = this.entries.findIndex((entry) => entry.meta.id === id);
			if (target < 0) return 0;

			let undone = 0;
			for (let i = this.entries.length - 1; i >= target; i--) {
				const record = this.entries[i];
				if (!record.meta.applied) continue;
				if (await this.applyUndo(record, { silent: true })) undone++;
			}
			this.notify(undone === 0 ? "Nothing to revert" : `Reverted ${undone} operation(s)`);
			return undone;
		});
	}

	/**
	 * Re-execute every undone entry from the oldest up to and including `id`,
	 * oldest-first so they re-apply in their original order. Returns how many
	 * were re-applied.
	 */
	restoreTo(id: string): Promise<number> {
		return this.queue.enqueue(async () => {
			const target = this.entries.findIndex((entry) => entry.meta.id === id);
			if (target < 0) return 0;

			let restored = 0;
			for (let i = 0; i <= target; i++) {
				const record = this.entries[i];
				if (record.meta.applied) continue;
				if (await this.applyRedo(record, { silent: true })) restored++;
			}
			this.notify(restored === 0 ? "Nothing to restore" : `Restored ${restored} operation(s)`);
			return restored;
		});
	}

	private async applyUndo(record: HistoryRecord, options?: { silent?: boolean }): Promise<boolean> {
		const { command, meta } = record;
		if (!command || !meta.replayable) return false;

		try {
			if (command.canUndo && !(await command.canUndo())) {
				console.warn(`Cannot undo command: ${meta.type} - referenced resources no longer exist`);
				if (!options?.silent) this.notify("Cannot undo: state has changed");
				meta.replayable = false;
				this.changed();
				return false;
			}

			await command.undo();
			meta.applied = false;
			this.markActivity();
			if (!options?.silent) this.notify(`Undid: ${meta.description}`);
			this.changed();
			return true;
		} catch (error) {
			console.error(`Failed to undo command: ${meta.type}`, error);
			if (!options?.silent) this.notify(`Failed to undo: ${meta.description}`);
			// Keep the entry as a record of what happened, but stop offering a
			// replay: the command threw mid-undo, so the state it was tracking
			// is no longer one we can reason about.
			meta.replayable = false;
			this.changed();
			return false;
		}
	}

	private async applyRedo(record: HistoryRecord, options?: { silent?: boolean }): Promise<boolean> {
		const { command, meta } = record;
		if (!command || !meta.replayable) return false;

		try {
			await command.execute();
			meta.applied = true;
			this.markActivity();
			if (!options?.silent) this.notify(`Redid: ${meta.description}`);
			this.changed();
			return true;
		} catch (error) {
			console.error(`Failed to redo command: ${meta.type}`, error);
			if (!options?.silent) this.notify(`Failed to redo: ${meta.description}`);
			meta.replayable = false;
			this.changed();
			return false;
		}
	}

	// ─── Queries ─────────────────────────────────────────────────

	canUndo(): boolean {
		return this.findUndoable() !== null;
	}

	canRedo(): boolean {
		return this.findRedoable() !== null;
	}

	/** Entries that could still be undone — restored/broken entries don't count. */
	getUndoStackSize(): number {
		return this.entries.filter((e) => e.meta.applied && e.meta.replayable).length;
	}

	/** Entries that could still be redone — restored/broken entries don't count. */
	getRedoStackSize(): number {
		return this.entries.filter((e) => !e.meta.applied && e.meta.replayable).length;
	}

	peekUndo(): string | null {
		return this.findUndoable()?.meta.type ?? null;
	}

	peekRedo(): string | null {
		return this.findRedoable()?.meta.type ?? null;
	}

	// ─── Lifecycle ───────────────────────────────────────────────

	/** Erase the log — in memory *and* on disk. A user-facing "clear", not a teardown. */
	clearHistory(): Promise<void> {
		return this.queue.enqueue(() => {
			this.entries = [];
			this.nextId = 0;
			this.cancelPendingPersist();
			this.kv?.delete(this.persistScope);
			for (const listener of this.listeners) listener();
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
		this.entries = [];
	}

	// ─── Persistence ─────────────────────────────────────────────

	private hydrate(): void {
		const stored = this.kv?.get(this.persistScope);
		if (!stored) return;

		this.entries = stored.entries.slice(-this.maxHistorySize).map((entry) => ({
			command: null,
			meta: { ...entry, replayable: false },
		}));
		this.nextId = stored.nextId;
	}

	private schedulePersist(): void {
		if (!this.kv) return;
		// Trailing debounce: a 200-file batch pushes 200 entries in a tick, and
		// serializing the whole log on each would be the jank source this
		// feature is most likely to introduce.
		if (this.persistTimer !== null) clearTimeout(this.persistTimer);
		this.persistTimer = setTimeout(() => {
			this.persistTimer = null;
			this.writeNow();
		}, this.persistDebounceMs);
	}

	private cancelPendingPersist(): void {
		if (this.persistTimer === null) return;
		clearTimeout(this.persistTimer);
		this.persistTimer = null;
	}

	/** Write any pending debounced history immediately. */
	flushPersistence(): void {
		if (this.persistTimer === null) return;
		this.cancelPendingPersist();
		this.writeNow();
	}

	private writeNow(): void {
		if (!this.kv) return;
		try {
			this.kv.set(this.persistScope, {
				nextId: this.nextId,
				entries: this.entries.map(({ meta }) => ({
					id: meta.id,
					type: meta.type,
					description: meta.description,
					timestamp: meta.timestamp,
					applied: meta.applied,
				})),
			});
		} catch (error) {
			// A full quota or a locked-down private-browsing store must never
			// take down the command that triggered the write.
			console.warn("[CommandManager] Failed to persist history", error);
		}
	}
}
