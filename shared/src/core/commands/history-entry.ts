import { z } from "zod";

/**
 * A single recorded operation in a {@link import("./command-manager").CommandManager}'s
 * history — the user-visible unit the operation-history UI lists, and the unit
 * selective undo/redo addresses by `id`.
 */
export interface HistoryEntry {
	/** Unique within the manager, and stable across a persistence round-trip. */
	readonly id: string;
	readonly type: string;
	readonly description: string;
	/** Epoch ms, stamped when the entry was pushed. */
	readonly timestamp: number;
	readonly applied: boolean;
	/**
	 * False once the entry can no longer be replayed: it was restored from
	 * storage (the live `Command` did not survive the session), a replay threw,
	 * or `canUndo()` reported that the state it depended on has moved. The
	 * entry stays in the log as a record; the UI stops offering to replay it.
	 */
	readonly replayable: boolean;
}

/**
 * Descriptions are user-authored via `Command.describe()` and end up in a
 * persisted payload, so they are capped — an unbounded description would let a
 * single pathological command dominate the storage budget.
 */
export const MAX_DESCRIPTION_LENGTH = 200;

/**
 * Fallback label for a command that doesn't implement `describe()`:
 * `mark-as-undone` → `Mark as undone`, `MacroCommand` → `Macro command`.
 * All-caps words are left alone so acronyms (`ICS`, `CalDAV` → `CalDAV`
 * survives as-is only if already mixed) don't get flattened.
 */
export function humanizeCommandType(type: string): string {
	const spaced = type
		.replace(/[-_]+/g, " ")
		.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
		.trim();
	if (spaced.length === 0) return "Operation";

	const words = spaced
		.split(/\s+/)
		.map((word) => (word.length > 1 && word === word.toUpperCase() ? word : word.toLowerCase()));
	const [first, ...rest] = words;
	return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

/**
 * What actually reaches `localStorage`. Deliberately metadata-only: a `Command`
 * closes over live repositories and arbitrary updater closures, so it has no
 * serialized form — and even a snapshot that *could* be serialized would be
 * replayed against a vault that has moved on since, silently clobbering every
 * intervening edit. Restored entries are therefore a record, never a replay.
 */
export const PersistedHistorySchema = z.object({
	nextId: z.number().int().nonnegative(),
	entries: z.array(
		z.object({
			id: z.string(),
			type: z.string(),
			description: z.string(),
			timestamp: z.number(),
			applied: z.boolean(),
		})
	),
});

export type PersistedHistory = z.infer<typeof PersistedHistorySchema>;
