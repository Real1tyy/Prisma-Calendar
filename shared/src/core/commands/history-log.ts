import type { Command } from "./command";
import { describeCommand, type HistoryEntry, type PersistedHistory } from "./history-entry";

/**
 * Undo and redo are the same traversal in opposite directions. Everything that
 * differs between them lives here, so each algorithm — pick the next candidate,
 * act on one entry, act on a span — exists exactly once. See {@link UNDO} /
 * {@link REDO}; there are only ever those two.
 */
export interface ReplayDirection {
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

export const UNDO: ReplayDirection = {
	actsOn: true,
	scan: "newest-first",
	run: (command) => command.undo(),
	canRun: (command) => command.canUndo?.() ?? true,
	verb: "undo",
	past: "Undid",
	spanVerb: "revert",
	spanPast: "Reverted",
};

export const REDO: ReplayDirection = {
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
export interface HistoryRecord {
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
 * The recorded operations, and every query over them.
 *
 * A list with a per-entry `applied` flag rather than a single cursor — which is
 * what makes *selective* undo possible: flipping the 20th-last entry leaves the
 * other nineteen applied. Deliberately free of notices, serialization and
 * async: it owns the data and the traversal, and nothing else.
 */
export class HistoryLog {
	private entries: HistoryRecord[] = [];
	private nextId = 0;

	constructor(private readonly maxSize: number) {}

	/** Recorded operations, oldest → newest. Copies; mutating them is a no-op. */
	view(): readonly HistoryEntry[] {
		return this.entries.map((record) => ({ ...record.meta }));
	}

	/** Append a freshly-executed command, evicting the oldest entries past the cap. */
	record(command: Command): void {
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
		if (this.entries.length > this.maxSize) {
			this.entries.splice(0, this.entries.length - this.maxSize);
		}
	}

	byId(id: string): HistoryRecord | null {
		return this.entries.find((record) => record.meta.id === id) ?? null;
	}

	/**
	 * The entry this direction's sequential undo()/redo() would act on: the
	 * first actionable one in scan order. Called on every `canUndo()`, so it
	 * walks by index and exits early rather than materializing an ordering.
	 */
	next(direction: ReplayDirection): HistoryRecord | null {
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
	 * Materialized rather than lazy: the caller mutates each entry's `applied`
	 * as it goes, and a live view would then re-filter mid-walk.
	 */
	span(id: string, direction: ReplayDirection): HistoryRecord[] | null {
		const target = this.entries.findIndex((record) => record.meta.id === id);
		if (target < 0) return null;

		const distance = direction.scan === "newest-first" ? this.entries.length - target : target + 1;
		const inRange: HistoryRecord[] = [];
		for (const record of this.inScanOrder(direction, distance)) {
			if (record.meta.applied === direction.actsOn) inRange.push(record);
		}
		return inRange;
	}

	/** Entries this direction could still act on — restored/broken ones don't count. */
	count(direction: ReplayDirection): number {
		return this.entries.filter((record) => this.actionable(record, direction)).length;
	}

	/** Flip an entry's applied state after a successful replay. */
	markReplayed(record: HistoryRecord, direction: ReplayDirection): void {
		record.meta.applied = !direction.actsOn;
	}

	/**
	 * Retire an entry from replay while keeping it in the log. A failed or
	 * guard-rejected entry stays visible as a record of what happened — in a UI
	 * whose whole point is "here is what you did", deleting the row is worse
	 * than showing it as un-replayable.
	 */
	markBroken(record: HistoryRecord): void {
		record.meta.replayable = false;
	}

	clear(): void {
		this.entries = [];
		this.nextId = 0;
	}

	snapshot(): PersistedHistory {
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

	/** Adopt a persisted log. Restored entries carry no command, so none can be replayed. */
	restore(persisted: PersistedHistory): void {
		this.entries = persisted.entries.slice(-this.maxSize).map((entry) => ({
			command: null,
			meta: { ...entry, replayable: false },
		}));
		this.nextId = persisted.nextId;
	}

	private actionable(record: HistoryRecord, direction: ReplayDirection): boolean {
		return record.meta.applied === direction.actsOn && record.meta.replayable;
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
}
