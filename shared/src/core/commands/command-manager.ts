import { Notice } from "obsidian";

import { PromiseQueue } from "../../utils/async/promise-queue";
import type { Command } from "./command";
import { describeCommand, type HistoryEntry, type PersistedHistory } from "./history-entry";
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
 * Undo and redo are the same traversal in opposite directions. Everything that
 * differs between them lives here, so each algorithm — pick the next candidate,
 * act on one entry, act on a span — is written once. There are only ever the two
 * instances below.
 */
interface ReplayDirection {
	/** The `applied` state an entry must be in for this direction to act on it. */
	readonly actsOn: boolean;
	/** Which end of the log to start from when picking a candidate or walking a span. */
	readonly scan: "newest-first" | "oldest-first";
	run(command: Command): Promise<void>;
	/**
	 * Pre-flight check. Undo consults the command's own `canUndo()` — a command
	 * whose referenced file is gone reports false. Redo has no equivalent.
	 */
	canRun(command: Command): boolean | Promise<boolean>;
	/** Lowercase verb for log lines and single-entry notices ("undo" / "redo"). */
	readonly verb: string;
	/** Past tense for the success notice ("Undid" / "Redid"). */
	readonly past: string;
	/** Lowercase verb for the span operation ("revert" / "restore"). */
	readonly spanVerb: string;
	/** Past tense for the span notice ("Reverted" / "Restored"). */
	readonly spanPast: string;
}

const UNDO: ReplayDirection = {
	actsOn: true,
	scan: "newest-first",
	run: (command) => command.undo(),
	canRun: (command) => command.canUndo?.() ?? true,
	verb: "undo",
	past: "Undid",
	spanVerb: "revert",
	spanPast: "Reverted",
};

const REDO: ReplayDirection = {
	actsOn: false,
	scan: "oldest-first",
	run: (command) => command.execute(),
	canRun: () => true,
	verb: "redo",
	past: "Redid",
	spanVerb: "restore",
	spanPast: "Restored",
};

/** A log entry paired with the live command that can replay it. */
interface HistoryRecord {
	readonly meta: {
		readonly id: string;
		readonly type: string;
		readonly description: string;
		readonly timestamp: number;
		applied: boolean;
		replayable: boolean;
	};
	/** `null` ⇒ restored from storage; the live command didn't survive the session. */
	readonly command: Command | null;
}

/**
 * Undo/redo over a linear log of recorded operations.
 *
 * The log is a list with a per-entry `applied` flag rather than a single cursor,
 * which is what makes *selective* undo possible: flipping the 20th-last entry
 * leaves the other nineteen applied. Undo and redo are one implementation
 * parameterised by {@link ReplayDirection}, so `undo`/`redo`,
 * `undoEntry`/`redoEntry` and `revertTo`/`restoreTo` are each a single algorithm
 * rather than a mirrored pair. Sequential `undo()`/`redo()` resolve to "newest
 * applied" / "oldest undone", which degrades exactly to the cursor model this
 * replaced.
 *
 * One deliberate departure from that model: a new command no longer truncates
 * undone entries. They stay in the log and stay individually redoable — the
 * point of selective replay. See
 * [[spec-operation-history-modal-with-selective-undo-redo-and-persisted-history-log]].
 *
 * Durability is the one genuinely separate concern, and lives behind
 * {@link HistoryPersistence}.
 */
export class CommandManager {
	private entries: HistoryRecord[] = [];
	private nextId = 0;
	private readonly maxHistorySize: number;
	private readonly persistence: HistoryPersistence | null;
	private restorePending = false;
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
		this.maxHistorySize = options.maxHistorySize ?? DEFAULT_MAX_HISTORY_SIZE;
		this.showNotices = options.showNotices ?? false;
		this.sequencer = options.sequencer ?? createMonotonicSequencer();

		this.persistence = options.persistence ? new HistoryPersistence(options.persistence) : null;
		// NOT loaded here. A CommandManager is constructed on its plugin's boot
		// path, and `localStorage` is synchronous — putting a read there makes an
		// operation log capable of slowing, or failing, plugin load itself. No
		// audit trail is worth that, so the read is deferred (see restoreOnce).
		this.restorePending = this.persistence !== null;
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

	/**
	 * Recorded operations, oldest → newest. Entries are copies; mutating them is
	 * a no-op.
	 *
	 * Also a restore point, for the case where nothing has been recorded yet —
	 * opening the history without having done anything must still show the
	 * previous session. Every other query filters to *replayable* entries, and a
	 * restored entry never is, so none of them needs to pay for storage.
	 */
	getHistory(): readonly HistoryEntry[] {
		this.restoreOnce();
		return this.entries.map((record) => ({ ...record.meta }));
	}

	/** Subscribe to history mutations (push / undo / redo / clear). Returns an unsubscribe. */
	onHistoryChange(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private changed(): void {
		// Before the first write, never after. Persisting without having read
		// first would drop the previous session's entries; reading *after* a
		// write would restore this session's own log on top of itself and
		// duplicate every row.
		this.restoreOnce();
		for (const listener of this.listeners) listener();
		this.persistence?.schedule(() => this.snapshot());
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

	/** Append a freshly-executed command, evicting the oldest entries past the cap. */
	private record(command: Command): void {
		this.entries.push({
			command,
			meta: {
				id: String(this.nextId++),
				type: command.getType(),
				description: describeCommand(command),
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
			const record = this.next(direction);
			if (!record) {
				this.notify(`Nothing to ${direction.verb}`);
				return false;
			}
			return await this.replay(record, direction);
		});
	}

	private stepEntry(id: string, direction: ReplayDirection): Promise<boolean> {
		return this.queue.enqueue(async () => {
			const record = this.entries.find((entry) => entry.meta.id === id);
			if (!record || record.meta.applied !== direction.actsOn) return false;
			return await this.replay(record, direction);
		});
	}

	private stepSpan(id: string, direction: ReplayDirection): Promise<number> {
		return this.queue.enqueue(async () => {
			const records = this.span(id, direction);
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
				// Retire it from replay but keep it in the log: in a UI whose whole
				// point is "here is what you did", deleting the row is worse than
				// showing it as un-replayable.
				meta.replayable = false;
				this.changed();
				return false;
			}

			await direction.run(command);
			meta.applied = !direction.actsOn;
			this.markActivity();
			if (!options?.silent) this.notify(`${direction.past}: ${meta.description}`);
			this.changed();
			return true;
		} catch (error) {
			console.error(`Failed to ${direction.verb} command: ${meta.type}`, error);
			if (!options?.silent) this.notify(`Failed to ${direction.verb}: ${meta.description}`);
			// Same reasoning as above: the command threw mid-flight, so the state it
			// was tracking is no longer one we can reason about.
			meta.replayable = false;
			this.changed();
			return false;
		}
	}

	// ─── Traversal ───────────────────────────────────────────────

	private actionable(record: HistoryRecord, direction: ReplayDirection): boolean {
		return record.meta.applied === direction.actsOn && record.meta.replayable;
	}

	/**
	 * The entry this direction's sequential undo()/redo() would act on: the first
	 * actionable one in scan order. Called on every `canUndo()`, so it walks by
	 * index and exits early rather than materializing an ordering.
	 */
	private next(direction: ReplayDirection): HistoryRecord | null {
		// Skipping non-replayable entries is what stops a single broken entry
		// wedging sequential undo against everything older than it.
		for (const record of this.inScanOrder(direction, this.entries.length)) {
			if (this.actionable(record, direction)) return record;
		}
		return null;
	}

	/**
	 * Every entry this direction can act on, from its scan end through `id`
	 * inclusive, in scan order — so a revert unwinds newest-first and a restore
	 * re-applies oldest-first. `null` when `id` isn't in the log.
	 *
	 * Materialized rather than lazy: the caller mutates each entry's `applied` as
	 * it goes, and a live view would then re-filter mid-walk.
	 */
	private span(id: string, direction: ReplayDirection): HistoryRecord[] | null {
		const target = this.entries.findIndex((record) => record.meta.id === id);
		if (target < 0) return null;

		const distance = direction.scan === "newest-first" ? this.entries.length - target : target + 1;
		const inRange: HistoryRecord[] = [];
		for (const record of this.inScanOrder(direction, distance)) {
			if (record.meta.applied === direction.actsOn) inRange.push(record);
		}
		return inRange;
	}

	/** The first `distance` entries in this direction's scan order, lazily. */
	private *inScanOrder(direction: ReplayDirection, distance: number): Generator<HistoryRecord> {
		const backwards = direction.scan === "newest-first";
		const start = backwards ? this.entries.length - 1 : 0;
		const step = backwards ? -1 : 1;
		for (let taken = 0, i = start; taken < distance && i >= 0 && i < this.entries.length; taken++, i += step) {
			yield this.entries[i];
		}
	}

	// ─── Queries ─────────────────────────────────────────────────

	canUndo(): boolean {
		return this.next(UNDO) !== null;
	}

	canRedo(): boolean {
		return this.next(REDO) !== null;
	}

	/** Entries that could still be undone — restored/broken entries don't count. */
	getUndoStackSize(): number {
		return this.entries.filter((record) => this.actionable(record, UNDO)).length;
	}

	/** Entries that could still be redone — restored/broken entries don't count. */
	getRedoStackSize(): number {
		return this.entries.filter((record) => this.actionable(record, REDO)).length;
	}

	peekUndo(): string | null {
		return this.next(UNDO)?.meta.type ?? null;
	}

	peekRedo(): string | null {
		return this.next(REDO)?.meta.type ?? null;
	}

	// ─── Persistence ─────────────────────────────────────────────

	private snapshot(): PersistedHistory {
		return {
			nextId: this.nextId,
			entries: this.entries.map(({ meta }) => ({
				id: meta.id,
				type: meta.type,
				description: meta.description,
				timestamp: meta.timestamp,
				applied: meta.applied,
			})),
		};
	}

	/**
	 * Read the persisted log back in, at most once.
	 *
	 * Deliberately not done in the constructor: that runs on the plugin's boot
	 * path, and `localStorage` is synchronous, so a read there lets the operation
	 * log slow — or break — plugin load itself. Instead it happens at the first
	 * moment it can actually matter: someone reads the history, or we are about
	 * to persist (see {@link changed}).
	 *
	 * Restored entries carry no command, so none can be replayed. Because this is
	 * lazy it may run *after* the session recorded operations; those are strictly
	 * newer, so the restored ones go in front — and are re-keyed, since a fresh
	 * session issues ids from zero and would otherwise collide. Nothing depends on
	 * a restored id matching what was stored: it only has to be unique in the log.
	 */
	private restoreOnce(): void {
		if (!this.restorePending) return;
		// Cleared first: a store that fails to read should be given up on, not
		// retried on every render.
		this.restorePending = false;
		const stored = this.persistence?.load();
		if (!stored) return;

		const restored: HistoryRecord[] = stored.entries.slice(-this.maxHistorySize).map((entry, index) => ({
			command: null,
			meta: { ...entry, id: `r${index}`, replayable: false },
		}));
		this.entries = [...restored, ...this.entries].slice(-this.maxHistorySize);
		this.nextId = Math.max(this.nextId, stored.nextId);
	}

	/** Write any pending debounced history immediately. */
	flushPersistence(): void {
		this.persistence?.flush();
	}

	// ─── Lifecycle ───────────────────────────────────────────────

	/** Erase the log — in memory *and* on disk. A user-facing "clear", not a teardown. */
	clearHistory(): Promise<void> {
		return this.queue.enqueue(() => {
			// Drop the pending restore too, or the log the user just cleared would
			// reappear the next time anything triggered a lazy read.
			this.restorePending = false;
			this.entries = [];
			this.nextId = 0;
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
		this.entries = [];
	}
}
